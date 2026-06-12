import { supabase } from "@/integrations/supabase/client";
import { BRANCHES, type Category, type PredictionMode } from "./kcet-constants";

export interface PredictionRow {
  college_code: string;
  college_name: string;
  branch: string;
  category: string;
  round1_cutoff: number | null;
  round2_cutoff: number | null;
  round3_cutoff: number | null;
  reference_cutoff: number; // weighted cutoff used for quality / probability
  quality_cutoff: number; // best (lowest) cutoff seen — proxy for college quality
  confidence: number; // admission probability 0..100
  bucket: "Top" | "Expected" | "Sure-Shot";
  branch_priority: number; // 0 = highest priority
  avgPackage: string;
}

export interface PredictionResult {
  top: PredictionRow[];
  expected: PredictionRow[];
  sureShot: PredictionRow[];
  all: PredictionRow[];
}

function patternsFor(selected: string[]): { label: string; pattern: string }[] {
  if (selected.includes("__all__")) return BRANCHES.map((b) => ({ label: b.label, pattern: b.pattern }));
  // Preserve user's selection order — this is the preference order.
  return selected
    .map((label) => BRANCHES.find((b) => b.label === label))
    .filter((b): b is (typeof BRANCHES)[number] => !!b)
    .map((b) => ({ label: b.label, pattern: b.pattern }));
}

function estimatePackage(qualityCutoff: number): string {
  if (qualityCutoff < 1500) return "₹18-30 LPA";
  if (qualityCutoff < 4000) return "₹12-20 LPA";
  if (qualityCutoff < 9000) return "₹8-14 LPA";
  if (qualityCutoff < 20000) return "₹6-10 LPA";
  if (qualityCutoff < 45000) return "₹4-7 LPA";
  return "₹3-5 LPA";
}

/**
 * Counselor-style prediction:
 *  - Eligible = colleges whose previous-year cutoff is within reach for this rank.
 *  - We fetch a wide window so very low ranks (<1000) still see the top institutes.
 *  - We weight Round 1 & Round 2 heavily (0.45 each) and Round 3 lightly (0.10)
 *    when computing the reference cutoff used for probability bucketing.
 *  - quality_cutoff = best (lowest) seen cutoff — proxy for college reputation.
 *  - Branches honour the user's selection order: preference #1 ranked above #2.
 *  - "college" mode ignores branch preference entirely; we sort by quality.
 */
export async function runPrediction(opts: {
  rank: number;
  category: Category;
  branches: string[]; // ordered labels; or ["__all__"]
  mode: PredictionMode;
}): Promise<PredictionResult> {
  const { rank, category, mode } = opts;
  const isCollegeMode = mode === "college";
  // In college-priority mode we ignore the branch filter (per spec).
  const orderedBranches = isCollegeMode
    ? patternsFor(["__all__"])
    : patternsFor(opts.branches);
  const branchPriority = new Map<string, number>();
  orderedBranches.forEach((b, i) => branchPriority.set(b.pattern, i));

  // Generous window: never miss top institutes for low ranks, never miss safe options for high ranks.
  // Lower bound = 1 (always include the very best colleges so rank<1000 students see them).
  // Upper bound = max(rank * 3, 25000) — covers safe colleges even for very low ranks.
  const lowerBound = 1;
  const upperBound = Math.max(rank * 3, 25000);

  let query = supabase
    .from("kcet_cutoffs")
    .select("college_code,college_name,branch,round,category,cutoff_rank")
    .eq("category", category)
    .gte("cutoff_rank", lowerBound)
    .lte("cutoff_rank", upperBound);

  if (!isCollegeMode && orderedBranches.length && orderedBranches.length < BRANCHES.length) {
    const ors = orderedBranches.map((p) => `branch.ilike.%${p.pattern}%`).join(",");
    query = query.or(ors);
  }

  const { data, error } = await query.limit(10000);
  if (error) throw error;

  // Group by college+branch; capture rounds individually
  type Group = {
    college_code: string;
    college_name: string;
    branch: string;
    category: string;
    r1?: number;
    r2?: number;
    r3?: number;
  };
  const map = new Map<string, Group>();
  for (const r of data ?? []) {
    const key = `${r.college_code}|${r.branch}`;
    const g =
      map.get(key) ??
      ({
        college_code: r.college_code,
        college_name: r.college_name,
        branch: r.branch,
        category: r.category,
      } as Group);
    const v = Number(r.cutoff_rank);
    if (r.round === 1) g.r1 = v;
    else if (r.round === 2) g.r2 = v;
    else if (r.round === 3) g.r3 = v;
    map.set(key, g);
  }

  // Match branch pattern → branch priority
  function priorityFor(branchName: string): number {
    if (isCollegeMode) return 0;
    const upper = branchName.toUpperCase();
    let best = Number.MAX_SAFE_INTEGER;
    for (const [pattern, idx] of branchPriority.entries()) {
      if (upper.includes(pattern) && idx < best) best = idx;
    }
    return best === Number.MAX_SAFE_INTEGER ? 999 : best;
  }

  const rows: PredictionRow[] = [];
  for (const g of map.values()) {
    const cutoffs: number[] = [];
    if (g.r1 != null) cutoffs.push(g.r1);
    if (g.r2 != null) cutoffs.push(g.r2);
    if (g.r3 != null) cutoffs.push(g.r3);
    if (!cutoffs.length) continue;

    // Reference cutoff: weighted average. R1 & R2 are primary; R3 is supporting.
    const w1 = g.r1 != null ? 0.45 : 0;
    const w2 = g.r2 != null ? 0.45 : 0;
    const w3 = g.r3 != null ? 0.1 : 0;
    const wsum = w1 + w2 + w3 || 1;
    const reference =
      ((g.r1 ?? 0) * w1 + (g.r2 ?? 0) * w2 + (g.r3 ?? 0) * w3) / wsum;
    // Admission decision basis = the most generous (highest) of R1/R2 — counselors give benefit of doubt.
    const admissionBasis = Math.max(g.r1 ?? 0, g.r2 ?? 0, g.r3 ?? 0);
    const quality = Math.min(...cutoffs); // best seen — proxy for college reputation

    // ratio > 1 → your rank is comfortably better than cutoff (safer).
    const ratio = admissionBasis / Math.max(rank, 1);

    let confidence: number;
    let bucket: PredictionRow["bucket"];
    if (ratio >= 1.6) {
      confidence = 96;
      bucket = "Sure-Shot";
    } else if (ratio >= 1.2) {
      confidence = 88;
      bucket = "Sure-Shot";
    } else if (ratio >= 1.0) {
      confidence = 72;
      bucket = "Expected";
    } else if (ratio >= 0.85) {
      confidence = 55;
      bucket = "Expected";
    } else if (ratio >= 0.7) {
      confidence = 38;
      bucket = "Top";
    } else if (ratio >= 0.55) {
      confidence = 22;
      bucket = "Top";
    } else {
      continue; // too far out of reach
    }

    // Slight reference-based polish
    if (reference < quality * 1.5 && bucket !== "Top") confidence = Math.min(99, confidence + 2);

    rows.push({
      college_code: g.college_code,
      college_name: g.college_name,
      branch: g.branch,
      category: g.category,
      round1_cutoff: g.r1 ?? null,
      round2_cutoff: g.r2 ?? null,
      round3_cutoff: g.r3 ?? null,
      reference_cutoff: Math.round(reference),
      quality_cutoff: quality,
      confidence,
      bucket,
      branch_priority: priorityFor(g.branch),
      avgPackage: estimatePackage(quality),
    });
  }

  // Sorting strategy — counselor style:
  //  - In college-priority mode: best colleges first (lowest quality_cutoff).
  //  - Otherwise: branch preference first, then college quality.
  const sortRows = (arr: PredictionRow[]) => {
    if (isCollegeMode) {
      arr.sort((a, b) => a.quality_cutoff - b.quality_cutoff);
    } else if (mode === "branch") {
      arr.sort(
        (a, b) =>
          a.branch_priority - b.branch_priority ||
          a.quality_cutoff - b.quality_cutoff ||
          b.confidence - a.confidence,
      );
    } else {
      // balanced — preference matters but reputation is co-equal
      arr.sort((a, b) => {
        const aScore = a.branch_priority * 5000 + a.quality_cutoff - a.confidence * 30;
        const bScore = b.branch_priority * 5000 + b.quality_cutoff - b.confidence * 30;
        return aScore - bScore;
      });
    }
    return arr;
  };

  const top = sortRows(rows.filter((r) => r.bucket === "Top"));
  const expected = sortRows(rows.filter((r) => r.bucket === "Expected"));
  const sureShot = sortRows(rows.filter((r) => r.bucket === "Sure-Shot"));

  // Dynamic caps based on rank tier & how many qualified rows exist.
  // Low rank (<2000): student has many top options — show a focused list.
  // High rank (>60000): widen so they see all realistic safe colleges.
  const tier = rank < 2000 ? 0 : rank < 8000 ? 1 : rank < 25000 ? 2 : rank < 60000 ? 3 : 4;
  const caps = [
    { top: 10, exp: 10, sure: 8 },
    { top: 12, exp: 14, sure: 12 },
    { top: 14, exp: 18, sure: 18 },
    { top: 15, exp: 20, sure: 22 },
    { top: 15, exp: 22, sure: 28 },
  ][tier];

  const topOut = top.slice(0, caps.top);
  const expOut = expected.slice(0, caps.exp);
  const sureOut = sureShot.slice(0, caps.sure);

  return {
    top: topOut,
    expected: expOut,
    sureShot: sureOut,
    all: [...topOut, ...expOut, ...sureOut],
  };
}
