import { supabase } from "@/integrations/supabase/client";
import { BRANCHES, type Category, type PredictionMode } from "./kcet-constants";

export interface PredictionRow {
  college_code: string;
  college_name: string;
  branch: string;
  category: string;
  round1_cutoff: number | null;
  round2_cutoff: number | null;
  reference_cutoff: number; // best (max) cutoff across R1/R2
  confidence: number; // 0..100
  bucket: "Sure-Shot" | "Expected" | "Dream";
  avgPackage: string; // rough estimate
}

export interface PredictionResult {
  dream: PredictionRow[];
  expected: PredictionRow[];
  sureShot: PredictionRow[];
  all: PredictionRow[];
}

function patternsFor(selected: string[]): string[] {
  if (selected.includes("__all__")) return BRANCHES.map(b => b.pattern);
  return BRANCHES.filter(b => selected.includes(b.label)).map(b => b.pattern);
}

// Rough package estimate based on cutoff rank (lower rank = better college = higher package)
function estimatePackage(refCutoff: number): string {
  if (refCutoff < 2000) return "₹15-25 LPA";
  if (refCutoff < 5000) return "₹10-18 LPA";
  if (refCutoff < 10000) return "₹7-12 LPA";
  if (refCutoff < 25000) return "₹5-9 LPA";
  if (refCutoff < 50000) return "₹4-7 LPA";
  return "₹3-5 LPA";
}

export async function runPrediction(opts: {
  rank: number;
  category: Category;
  branches: string[]; // labels, or ["__all__"]
  mode: PredictionMode;
}): Promise<PredictionResult> {
  const { rank, category, mode } = opts;
  const patterns = patternsFor(opts.branches);

  // Fetch all cutoffs for this category whose cutoff_rank >= rank - margin
  // We allow some headroom; show colleges where their cutoff is roughly within range.
  // Window: dream = cutoff up to 35% better than rank, sure-shot = cutoff >= rank+20%.
  const lowerBound = Math.floor(rank * 0.5);
  const upperBound = Math.ceil(rank * 2.0);

  let query = supabase
    .from("kcet_cutoffs")
    .select("college_code,college_name,branch,round,category,cutoff_rank")
    .eq("category", category)
    .gte("cutoff_rank", lowerBound)
    .lte("cutoff_rank", upperBound);

  if (patterns.length && patterns.length < BRANCHES.length) {
    // Build OR for ILIKE patterns
    const ors = patterns.map(p => `branch.ilike.%${p}%`).join(",");
    query = query.or(ors);
  }

  const { data, error } = await query.limit(5000);
  if (error) throw error;

  // Group by college+branch
  const map = new Map<string, { row: typeof data[number]; r1?: number; r2?: number }>();
  for (const r of data ?? []) {
    const key = `${r.college_code}|${r.branch}`;
    const entry = map.get(key) ?? { row: r };
    if (r.round === 1) entry.r1 = Number(r.cutoff_rank);
    else if (r.round === 2) entry.r2 = Number(r.cutoff_rank);
    map.set(key, entry);
  }

  const rows: PredictionRow[] = [];
  for (const { row, r1, r2 } of map.values()) {
    // Reference cutoff: use round2 weighted more (latest), fall back to round1
    const cutoffs = [r1, r2].filter((v): v is number => v != null);
    if (!cutoffs.length) continue;
    const reference = Math.max(...cutoffs); // worst (highest) -- gives benefit of doubt
    // Confidence: if rank well within reference, high
    let confidence: number;
    if (rank <= reference * 0.7) confidence = 95;
    else if (rank <= reference * 0.9) confidence = 85;
    else if (rank <= reference) confidence = 70;
    else if (rank <= reference * 1.15) confidence = 50;
    else if (rank <= reference * 1.4) confidence = 30;
    else confidence = 15;

    let bucket: PredictionRow["bucket"];
    if (confidence >= 80) bucket = "Sure-Shot";
    else if (confidence >= 45) bucket = "Expected";
    else bucket = "Dream";

    rows.push({
      college_code: row.college_code,
      college_name: row.college_name,
      branch: row.branch,
      category: row.category,
      round1_cutoff: r1 ?? null,
      round2_cutoff: r2 ?? null,
      reference_cutoff: reference,
      confidence,
      bucket,
      avgPackage: estimatePackage(reference),
    });
  }

  // Mode-based sorting and trimming
  rows.sort((a, b) => b.confidence - a.confidence || a.reference_cutoff - b.reference_cutoff);

  // Bucket the rows
  const sureShot = rows.filter(r => r.bucket === "Sure-Shot");
  const expected = rows.filter(r => r.bucket === "Expected");
  const dream = rows.filter(r => r.bucket === "Dream");

  // Number of recommendations scales with rank quality (higher rank = lower number = fewer recommendations)
  // Actually per spec: "Students with lower ranks should receive fewer recommendations.
  // Students with higher ranks should receive more recommendations." In KCET, LOWER rank number = BETTER.
  // We interpret "higher ranks" as larger rank numbers (e.g. 80000) → more options to consider.
  let capPerBucket = 15;
  if (rank < 5000) capPerBucket = 8;
  else if (rank < 20000) capPerBucket = 12;
  else if (rank < 50000) capPerBucket = 18;
  else capPerBucket = 25;

  // Mode bias
  const collegeRank = (r: PredictionRow) => r.reference_cutoff; // lower = better college
  const sortByMode = (arr: PredictionRow[]) => {
    if (mode === "college") arr.sort((a, b) => collegeRank(a) - collegeRank(b));
    else if (mode === "branch") arr.sort((a, b) => b.confidence - a.confidence);
    else arr.sort((a, b) => b.confidence * 0.6 + (100000 - collegeRank(a)) / 1000 - (b.confidence * 0.6 + (100000 - collegeRank(b)) / 1000));
    return arr;
  };

  return {
    sureShot: sortByMode(sureShot).slice(0, capPerBucket),
    expected: sortByMode(expected).slice(0, capPerBucket),
    dream: sortByMode(dream).slice(0, Math.ceil(capPerBucket * 0.8)),
    all: [...sortByMode(sureShot), ...sortByMode(expected), ...sortByMode(dream)],
  };
}
