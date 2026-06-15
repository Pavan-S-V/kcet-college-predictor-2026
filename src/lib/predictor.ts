import { supabase } from "@/integrations/supabase/client";
import { BRANCHES, districtFor, type Category, type PredictionMode } from "./kcet-constants";

export interface PredictionRow {
  college_code: string;
  college_name: string;
  district: string;
  branch: string;
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

function patternsFor(selected: string[]): { label: string; pattern: string }[] {
  if (selected.includes("__all__")) return BRANCHES.map((b) => ({ label: b.label, pattern: b.pattern }));
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

export async function runPrediction(opts: {
  rank: number;
  category: Category;
  branches: string[];
  mode: PredictionMode;
  district?: string; // legacy single
  districts?: string[]; // [] or undefined = All Karnataka
}): Promise<PredictionResult> {
  const { rank, category, mode } = opts;
  const districtSet = new Set(
    (opts.districts && opts.districts.length ? opts.districts : opts.district ? [opts.district] : []).filter(Boolean),
  );
  const isCollegeMode = mode === "college";
  const orderedBranches = isCollegeMode ? patternsFor(["__all__"]) : patternsFor(opts.branches);
  const branchPriority = new Map<string, number>();
  orderedBranches.forEach((b, i) => branchPriority.set(b.pattern, i));

  // Dynamic upper bound: realistic ceiling so we don't recommend colleges
  // that admit far below the student's rank (i.e. far weaker than they can target).
  // Lower-rank students get a tighter cap to keep recommendations realistic.
  const upperBound = rank < 2000 ? 30000
    : rank < 8000 ? Math.max(rank * 4, 35000)
    : rank < 25000 ? rank * 3
    : rank < 60000 ? rank * 2.5
    : rank * 2;

  let query = supabase
    .from("kcet_cutoffs")
    .select("college_code,college_name,branch,round,category,cutoff_rank")
    .eq("category", category)
    .in("round", [1, 2])
    .gte("cutoff_rank", 1)
    .lte("cutoff_rank", upperBound);

  if (!isCollegeMode && orderedBranches.length && orderedBranches.length < BRANCHES.length) {
    const ors = orderedBranches.map((p) => `branch.ilike.%${p.pattern}%`).join(",");
    query = query.or(ors);
  }

  const { data, error } = await query.limit(10000);
  if (error) throw error;

  type Group = {
    college_code: string;
    college_name: string;
    branch: string;
    category: string;
    r1?: number;
    r2?: number;
  };
  const map = new Map<string, Group>();
  const ingest = (rows: typeof data) => {
    for (const r of rows ?? []) {
      const key = `${r.college_code}|${r.branch}`;
      const g = map.get(key) ?? ({
        college_code: r.college_code,
        college_name: r.college_name,
        branch: r.branch,
        category: r.category,
      } as Group);
      const v = Number(r.cutoff_rank);
      if (r.round === 1) g.r1 = v;
      else if (r.round === 2) g.r2 = v;
      map.set(key, g);
    }
  };
  ingest(data);

  // Always pull data for curated aspirational top colleges so students see
  // realistic stretch goals — even very low ranks should see RVCE/BMSCE/etc.
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
    "BANGALORE INSTITUTE OF TECHNOLOGY", "B.I.T.",
    "RNS INSTITUTE",
  ];
  if (rank < 25000) {
    let tq = supabase
      .from("kcet_cutoffs")
      .select("college_code,college_name,branch,round,category,cutoff_rank")
      .eq("category", category)
      .in("round", [1, 2])
      .gte("cutoff_rank", 1);
    const ors = TOP_COLLEGE_KEYWORDS.map((k) => `college_name.ilike.%${k}%`).join(",");
    tq = tq.or(ors);
    if (!isCollegeMode && orderedBranches.length && orderedBranches.length < BRANCHES.length) {
      const bors = orderedBranches.map((p) => `branch.ilike.%${p.pattern}%`).join(",");
      tq = tq.or(bors);
    }
    const { data: topData } = await tq.limit(4000);
    ingest(topData);
  }

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
    if (!cutoffs.length) continue;

    const dist = districtFor(g.college_name);
    if (districtSet.size && !districtSet.has(dist)) continue;

    // Strict branch enforcement (safety net for the .or query above)
    if (!isCollegeMode && orderedBranches.length && orderedBranches.length < BRANCHES.length) {
      const up = g.branch.toUpperCase();
      const matches = orderedBranches.some((p) => up.includes(p.pattern));
      if (!matches) continue;
    }

    const w1 = g.r1 != null ? 0.5 : 0;
    const w2 = g.r2 != null ? 0.5 : 0;
    const wsum = w1 + w2 || 1;
    const reference = ((g.r1 ?? 0) * w1 + (g.r2 ?? 0) * w2) / wsum;
    const admissionBasis = Math.max(g.r1 ?? 0, g.r2 ?? 0);
    const quality = Math.min(...cutoffs);

    const ratio = admissionBasis / Math.max(rank, 1);

    // Skip colleges whose cutoff is excessively distant from rank
    // (admits many ranks below student → far weaker than necessary).
    const distantCap = rank < 2000 ? 8 : rank < 8000 ? 6 : rank < 25000 ? 4.5 : rank < 60000 ? 3.5 : 3;
    if (ratio > distantCap) continue;

    let confidence: number;
    let bucket: PredictionRow["bucket"];
    if (ratio >= 1.6) { confidence = 96; bucket = "Sure-Shot"; }
    else if (ratio >= 1.2) { confidence = 88; bucket = "Sure-Shot"; }
    else if (ratio >= 1.0) { confidence = 72; bucket = "Expected"; }
    else if (ratio >= 0.85) { confidence = 55; bucket = "Expected"; }
    else if (ratio >= 0.7) { confidence = 38; bucket = "Top"; }
    else if (ratio >= 0.5) { confidence = 22; bucket = "Top"; }
    else if (ratio >= 0.3) { confidence = 12; bucket = "Top"; }
    else if (ratio >= 0.15) { confidence = 6; bucket = "Top"; }
    else { confidence = 3; bucket = "Top"; }

    if (reference < quality * 1.5 && bucket !== "Top") confidence = Math.min(99, confidence + 2);

    rows.push({
      college_code: g.college_code,
      college_name: g.college_name,
      district: dist,
      branch: g.branch,
      category: g.category,
      round1_cutoff: g.r1 ?? null,
      round2_cutoff: g.r2 ?? null,
      reference_cutoff: Math.round(reference),
      quality_cutoff: quality,
      confidence,
      bucket,
      branch_priority: priorityFor(g.branch),
      avgPackage: estimatePackage(quality),
    });
  }

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

  const tier = rank < 2000 ? 0 : rank < 8000 ? 1 : rank < 25000 ? 2 : rank < 60000 ? 3 : 4;
  const caps = [
    { top: 12, exp: 10, sure: 8 },
    { top: 14, exp: 14, sure: 12 },
    { top: 16, exp: 18, sure: 18 },
    { top: 16, exp: 20, sure: 22 },
    { top: 16, exp: 22, sure: 28 },
  ][tier];

  const topOut = top.slice(0, caps.top);
  const expOut = expected.slice(0, caps.exp);
  const sureOut = sureShot.slice(0, caps.sure);

  return { top: topOut, expected: expOut, sureShot: sureOut, all: [...topOut, ...expOut, ...sureOut] };
}

// PDF Report
export interface PdfMeta {
  studentName: string;
  rank: number;
  category: string;
  branches: string[];
  district: string; // free-text summary line
}

export async function downloadPredictionPdf(result: PredictionResult, meta: PdfMeta) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const now = new Date().toLocaleString();

  doc.setFontSize(16);
  doc.setTextColor(92, 59, 191);
  doc.text("KCET Counselling 2026", 105, 18, { align: "center" });
  doc.setFontSize(11);
  doc.setTextColor(60);
  doc.text("Get your College and Branch — Predicted Option Entry", 105, 26, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(20);
  const meta1 = [
    `Student Name: ${meta.studentName}`,
    `KCET Rank: ${meta.rank}`,
    `Category: ${meta.category}`,
    `Districts: ${meta.district || "All Karnataka"}`,
    `Branches: ${meta.branches.length ? meta.branches.join(", ") : "All"}`,
    `Generated: ${now}`,
  ];
  meta1.forEach((line, i) => doc.text(line, 14, 36 + i * 6));

  let y = 36 + meta1.length * 6 + 4;

  const renderSection = (title: string, rows: PredictionRow[]) => {
    if (!rows.length) return;
    doc.setFontSize(12);
    doc.setTextColor(92, 59, 191);
    doc.text(title, 14, y);
    y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["College", "Branch", "R1", "R2", "Probability"]],
      body: rows.map((r) => [
        `${r.college_name}${r.district ? "\n" + r.district : ""}`,
        r.branch,
        r.round1_cutoff ?? "-",
        r.round2_cutoff ?? "-",
        r.confidence + "%",
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [92, 59, 191], textColor: 255 },
      columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 65 } },
      margin: { left: 14, right: 14 },
    });
    // @ts-expect-error jspdf lastAutoTable
    y = (doc.lastAutoTable?.finalY ?? y) + 10;
    if (y > 260) { doc.addPage(); y = 20; }
  };

  renderSection("Top Colleges (High Reach)", result.top);
  renderSection("Expected Colleges (Realistic Matches)", result.expected);
  renderSection("Sure-Shot Colleges (Safe Options)", result.sureShot);

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Developed by — PAVAN S V", 105, 290, { align: "center" });
  }

  doc.save(`KCET-Prediction-${meta.studentName.replace(/\s+/g, "_")}-${meta.rank}.pdf`);
}
