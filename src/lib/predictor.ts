import { supabase } from "@/integrations/supabase/client";
import { BRANCHES, districtFor, canonicalBranchLabel, type Category, type PredictionMode } from "./kcet-constants";

export interface PredictionRow {
  college_code: string;
  college_name: string;
  district: string;
  branch: string;
  branch_label: string;
  category: string;
  round1_cutoff: number | null;
  round2_cutoff: number | null;
  reference_cutoff: number;
  quality_cutoff: number;
  confidence: number;
  bucket: "Top" | "Expected" | "Sure-Shot";
  branch_priority: number;
  avgPackage: string;
}

export interface PredictionResult {
  top: PredictionRow[];
  expected: PredictionRow[];
  sureShot: PredictionRow[];
  all: PredictionRow[];
}

function estimatePackage(qualityCutoff: number): string {
  if (qualityCutoff < 1500) return "₹18-30 LPA";
  if (qualityCutoff < 4000) return "₹12-20 LPA";
  if (qualityCutoff < 9000) return "₹8-14 LPA";
  if (qualityCutoff < 20000) return "₹6-10 LPA";
  if (qualityCutoff < 45000) return "₹4-7 LPA";
  return "₹3-5 LPA";
}

// Per-rank-tier upper bound for the initial fetch. Generous for very strong
// ranks so top colleges always come back. Fallback below still kicks in.
function maxCutoffFor(rank: number): number {
  if (rank < 100) return 50000;
  if (rank < 500) return 25000;
  if (rank < 1000) return 18000;
  if (rank < 3000) return 12000;
  if (rank < 6000) return 16000;
  if (rank < 10000) return 22000;
  if (rank < 15000) return 30000;
  if (rank < 25000) return 45000;
  if (rank < 50000) return rank + 20000;
  if (rank < 100000) return rank + 30000;
  return Number.POSITIVE_INFINITY;
}

// Aspirational colleges — always pulled regardless of upperBound.
const TOP_COLLEGE_KEYWORDS = [
  "R V COLLEGE", "R.V. COLLEGE", "RV COLLEGE",
  "B M S COLLEGE", "BMS COLLEGE",
  "M S RAMAIAH", "RAMAIAH INSTITUTE",
  "P E S", "PES UNIVERSITY", "PES INSTITUTE",
  "U V C E", "UNIVERSITY VISVESVARAYA",
  "DAYANANDA SAGAR",
  "B M S INSTITUTE", "BMS INSTITUTE",
  "NIE", "NATIONAL INSTITUTE OF ENGINEERING",
  "NITTE MEENAKSHI",
  "SIR M VISVESVARAYA", "SIR MV",
  "JSS",
  "BANGALORE INSTITUTE OF TECHNOLOGY",
  "RNS INSTITUTE",
  "SIDDAGANGA INSTITUTE",
];

export async function runPrediction(opts: {
  rank: number;
  category: Category;
  branches: string[];
  mode?: PredictionMode;
  district?: string;
  districts?: string[];
}): Promise<PredictionResult> {
  const { rank, category } = opts;
  const districtSet = new Set(
    (opts.districts && opts.districts.length ? opts.districts : opts.district ? [opts.district] : []).filter(Boolean),
  );

  // Selected branch LABELS (or all branches sentinel).
  const allBranches = opts.branches.includes("__all__");
  const selectedLabels = allBranches
    ? new Set(BRANCHES.map((b) => b.label))
    : new Set(
        opts.branches
          .map((label) => BRANCHES.find((b) => b.label === label)?.label)
          .filter((l): l is string => !!l),
      );
  const isStrict = !allBranches && selectedLabels.size > 0;

  // Branch display priority — order user clicked them.
  const branchPriority = new Map<string, number>();
  opts.branches.forEach((label, i) => branchPriority.set(label, i));

  const upperBound = maxCutoffFor(rank);
  const useUpperBound = Number.isFinite(upperBound);

  type Row = { college_code: string; college_name: string; branch: string; round: number; category: string; cutoff_rank: number };

  async function fetchRows(maxCutoff: number | null, branchFilter: boolean): Promise<Row[]> {
    const all: Row[] = [];
    const pageSize = 1000;
    for (let from = 0; from < 60000; from += pageSize) {
      let q = supabase
        .from("kcet_cutoffs")
        .select("college_code,college_name,branch,round,category,cutoff_rank")
        .eq("category", category)
        .in("round", [1, 2])
        .gte("cutoff_rank", 1)
        .order("cutoff_rank", { ascending: true })
        .range(from, from + pageSize - 1);
      if (maxCutoff != null && Number.isFinite(maxCutoff)) q = q.lte("cutoff_rank", maxCutoff);
      if (branchFilter && isStrict) {
        const patterns = Array.from(selectedLabels)
          .map((l) => BRANCHES.find((b) => b.label === l)?.pattern)
          .filter((p): p is string => !!p);
        if (patterns.length) {
          const ors = patterns.map((p) => `branch.ilike.%${p}%`).join(",");
          q = q.or(ors);
        }
      }
      const { data, error } = await q;
      if (error) throw error;
      if (!data || !data.length) break;
      all.push(...(data as Row[]));
      if (data.length < pageSize) break;
    }
    return all;
  }

  const primary = await fetchRows(useUpperBound ? upperBound : null, true);

  // Aspirational top colleges — always pulled regardless of upperBound.
  const aspOrs = TOP_COLLEGE_KEYWORDS.map((k) => `college_name.ilike.%${k}%`).join(",");
  let topQ = supabase
    .from("kcet_cutoffs")
    .select("college_code,college_name,branch,round,category,cutoff_rank")
    .eq("category", category)
    .in("round", [1, 2])
    .gte("cutoff_rank", 1)
    .or(aspOrs);
  if (isStrict) {
    const patterns = Array.from(selectedLabels)
      .map((l) => BRANCHES.find((b) => b.label === l)?.pattern)
      .filter((p): p is string => !!p);
    if (patterns.length) {
      const bors = patterns.map((p) => `branch.ilike.%${p}%`).join(",");
      topQ = topQ.or(bors);
    }
  }
  const { data: topData } = await topQ.limit(4000);

  type Group = {
    college_code: string;
    college_name: string;
    branch: string;
    branch_label: string;
    category: string;
    r1?: number;
    r2?: number;
  };

  const map = new Map<string, Group>();
  const ingest = (rows: Row[] | null | undefined) => {
    for (const r of rows ?? []) {
      const v = Number(r.cutoff_rank);
      if (!Number.isFinite(v) || v <= 0) continue;
      const label = canonicalBranchLabel(r.branch);
      if (!label) continue; // unknown / malformed branch
      if (isStrict && !selectedLabels.has(label)) continue; // STRICT filter
      const key = `${r.college_code}|${label}`;
      const g = map.get(key) ?? {
        college_code: r.college_code,
        college_name: r.college_name,
        branch: r.branch,
        branch_label: label,
        category: r.category,
      };
      if (r.round === 1) g.r1 = v;
      else if (r.round === 2) g.r2 = v;
      map.set(key, g);
    }
  };
  ingest(primary);
  ingest((topData as Row[] | null) ?? []);

  function priorityFor(label: string): number {
    return branchPriority.has(label) ? (branchPriority.get(label) as number) : 999;
  }

  function buildRow(g: Group): PredictionRow | null {
    const cutoffs: number[] = [];
    if (g.r1 != null) cutoffs.push(g.r1);
    if (g.r2 != null) cutoffs.push(g.r2);
    if (!cutoffs.length) return null;

    const dist = districtFor(g.college_name);
    if (districtSet.size && !districtSet.has(dist)) return null;

    const w1 = g.r1 != null ? 0.5 : 0;
    const w2 = g.r2 != null ? 0.5 : 0;
    const wsum = w1 + w2 || 1;
    const reference = ((g.r1 ?? 0) * w1 + (g.r2 ?? 0) * w2) / wsum;
    // For sure-shot classification we use the BEST (highest) cutoff the
    // student would still get in. Higher cutoff = easier seat.
    const admissionBasis = Math.max(g.r1 ?? 0, g.r2 ?? 0);
    const quality = Math.min(...cutoffs);
    const ratio = admissionBasis / Math.max(rank, 1);

    // Classification (ratio = cutoff/rank):
    //   ratio >= 1.30  → comfortably above rank      → Sure-Shot
    //   ratio >= 0.95  → reasonably close to cutoff  → Expected
    //   ratio <  0.95  → cutoff stronger than rank   → Top (aspirational)
    let confidence: number;
    let bucket: PredictionRow["bucket"];
    if (ratio >= 2.0)      { confidence = 99; bucket = "Sure-Shot"; }
    else if (ratio >= 1.5) { confidence = 95; bucket = "Sure-Shot"; }
    else if (ratio >= 1.3) { confidence = 88; bucket = "Sure-Shot"; }
    else if (ratio >= 1.1) { confidence = 78; bucket = "Expected"; }
    else if (ratio >= 0.95){ confidence = 62; bucket = "Expected"; }
    else if (ratio >= 0.80){ confidence = 42; bucket = "Top"; }
    else if (ratio >= 0.60){ confidence = 25; bucket = "Top"; }
    else if (ratio >= 0.40){ confidence = 14; bucket = "Top"; }
    else if (ratio >= 0.20){ confidence = 7;  bucket = "Top"; }
    else                   { confidence = 3;  bucket = "Top"; }

    return {
      college_code: g.college_code,
      college_name: g.college_name,
      district: dist,
      branch: g.branch,
      branch_label: g.branch_label,
      category: g.category,
      round1_cutoff: g.r1 ?? null,
      round2_cutoff: g.r2 ?? null,
      reference_cutoff: Math.round(reference),
      quality_cutoff: quality,
      confidence,
      bucket,
      branch_priority: priorityFor(g.branch_label),
      avgPackage: estimatePackage(quality),
    };
  }

  let rows: PredictionRow[] = [];
  for (const g of map.values()) {
    const row = buildRow(g);
    if (row) rows.push(row);
  }

  // Fallback: if too few results (or none), pull the full category set
  // with no upper bound. District + strict branch filters still apply.
  if (rows.length < 12) {
    const fallback = await fetchRows(null, true);
    const fmap = new Map<string, Group>();
    for (const r of fallback) {
      const v = Number(r.cutoff_rank);
      if (!Number.isFinite(v) || v <= 0) continue;
      const label = canonicalBranchLabel(r.branch);
      if (!label) continue;
      if (isStrict && !selectedLabels.has(label)) continue;
      const key = `${r.college_code}|${label}`;
      const g = fmap.get(key) ?? {
        college_code: r.college_code, college_name: r.college_name,
        branch: r.branch, branch_label: label, category: r.category,
      };
      if (r.round === 1) g.r1 = v;
      else if (r.round === 2) g.r2 = v;
      fmap.set(key, g);
    }
    const seen = new Set(rows.map((r) => `${r.college_code}|${r.branch_label}`));
    for (const g of fmap.values()) {
      const k = `${g.college_code}|${g.branch_label}`;
      if (seen.has(k)) continue;
      const row = buildRow(g);
      if (row) rows.push(row);
    }
  }

  // Sort: cutoff-competitiveness (lower = stronger) within branch priority.
  const sortRows = (arr: PredictionRow[]) => {
    arr.sort(
      (a, b) =>
        a.branch_priority - b.branch_priority ||
        a.quality_cutoff - b.quality_cutoff ||
        b.confidence - a.confidence,
    );
    return arr;
  };

  const top = sortRows(rows.filter((r) => r.bucket === "Top"));
  const expected = sortRows(rows.filter((r) => r.bucket === "Expected"));
  const sureShot = sortRows(rows.filter((r) => r.bucket === "Sure-Shot"));

  // Guarantee: never return all-empty for a valid rank. Promote best options
  // into Top so the student always sees something meaningful.
  if (!top.length && !expected.length && !sureShot.length && rows.length) {
    rows.sort((a, b) => a.quality_cutoff - b.quality_cutoff);
    for (const r of rows.slice(0, 12)) { r.bucket = "Top"; top.push(r); }
  }

  const tier = rank < 2000 ? 0 : rank < 8000 ? 1 : rank < 25000 ? 2 : rank < 60000 ? 3 : 4;
  const caps = [
    { top: 18, exp: 14, sure: 10 },
    { top: 18, exp: 20, sure: 14 },
    { top: 18, exp: 22, sure: 20 },
    { top: 18, exp: 24, sure: 26 },
    { top: 18, exp: 26, sure: 32 },
  ][tier];

  const topOut = top.slice(0, caps.top);
  const expOut = expected.slice(0, caps.exp);
  const sureOut = sureShot.slice(0, caps.sure);

  return { top: topOut, expected: expOut, sureShot: sureOut, all: [...topOut, ...expOut, ...sureOut] };
}

// ---------- PDF ----------
export interface PdfMeta {
  studentName: string;
  rank: number;
  category: string;
  branches: string[];
  districts?: string[];
  district?: string;
}

function cutoffText(v: number | null): string {
  return v != null && Number.isFinite(v) && v > 0 ? String(v) : "Not Available";
}

export async function downloadPredictionPdf(result: PredictionResult, meta: PdfMeta) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const now = new Date().toLocaleString();
  const districtList = (meta.districts && meta.districts.length ? meta.districts : meta.district ? [meta.district] : []).filter(Boolean);

  doc.setFontSize(16);
  doc.setTextColor(92, 59, 191);
  doc.text("KCET - College & Course Predictor", 105, 18, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text("Get Your Dream College and Course", 105, 25, { align: "center" });
  doc.text("Powered by Round 1, Round 2 & Seat Matrix Analysis", 105, 30, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(20);
  let y = 40;
  const writeLine = (s: string) => { doc.text(s, 14, y); y += 6; };
  writeLine(`Student Name: ${meta.studentName}`);
  writeLine(`KCET Rank: ${meta.rank}`);
  writeLine(`Category: ${meta.category}`);
  writeLine(`Selected Districts: ${districtList.length ? districtList.join(", ") : "All Karnataka"}`);
  writeLine(`Generated: ${now}`);
  y += 2;

  const branchList = meta.branches.filter((b) => b && b !== "__all__");
  doc.setFontSize(11);
  doc.setTextColor(92, 59, 191);
  doc.text(`Selected Branches${branchList.length > 10 ? ` (${branchList.length})` : ""}:`, 14, y);
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(20);
  const items = branchList.length ? branchList : ["All branches"];
  const pageHeight = doc.internal.pageSize.getHeight();
  for (const b of items) {
    const wrapped = doc.splitTextToSize(`• ${b}`, 180);
    for (const line of wrapped) {
      if (y > pageHeight - 25) { doc.addPage(); y = 20; }
      doc.text(line, 18, y);
      y += 5;
    }
  }
  y += 4;

  const renderSection = (title: string, rows: PredictionRow[]) => {
    if (!rows.length) return;
    if (y > pageHeight - 40) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(92, 59, 191);
    doc.text(title, 14, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["College", "Branch", "R1", "R2", "Probability"]],
      body: rows.map((r) => [
        `${r.college_name}${r.district ? "\n" + r.district : ""}`,
        r.branch_label || r.branch,
        cutoffText(r.round1_cutoff),
        cutoffText(r.round2_cutoff),
        r.confidence + "%",
      ]),
      styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
      headStyles: { fillColor: [92, 59, 191], textColor: 255 },
      columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 60 }, 2: { cellWidth: 18 }, 3: { cellWidth: 18 } },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error jspdf lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 10;
  };

  renderSection("Top Colleges (High Reach)", result.top);
  renderSection("Expected Colleges (Realistic Matches)", result.expected);
  renderSection("Sure-Shot Colleges (Safe Options)", result.sureShot);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Developed By — PAVAN S V", 105, 282, { align: "center" });
    doc.text("KCET - College & Course Predictor — Get Your Dream College and Course", 105, 287, { align: "center" });
    doc.text("Powered by Round 1, Round 2 & Seat Matrix Analysis.", 105, 292, { align: "center" });
  }

  doc.save(`KCET-Prediction-${meta.studentName.replace(/\s+/g, "_")}-${meta.rank}.pdf`);
}
