import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, districtFor, type Category } from "@/lib/kcet-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MapPin, School, Target } from "lucide-react";

export const Route = createFileRoute("/_authenticated/college-chances")({
  head: () => ({ meta: [{ title: "College Chances — KCET" }] }),
  component: CollegeChances,
});

interface College { code: string; name: string }
interface BranchRow {
  branch: string;
  r1: number | null;
  r2: number | null;
  probability: number;
  label: "Top Pick" | "Expected" | "Sure-Shot" | "Out of Range";
}

function computeRow(rank: number, r1: number | null, r2: number | null): { probability: number; label: BranchRow["label"] } {
  const basis = Math.max(r1 ?? 0, r2 ?? 0);
  if (!basis) return { probability: 0, label: "Out of Range" };
  const ratio = basis / Math.max(rank, 1);
  let probability = 0;
  let label: BranchRow["label"] = "Out of Range";
  if (ratio >= 1.6) { probability = 100; label = "Sure-Shot"; }
  else if (ratio >= 1.2) { probability = 90; label = "Sure-Shot"; }
  else if (ratio >= 1.0) { probability = 70; label = "Expected"; }
  else if (ratio >= 0.85) { probability = 55; label = "Expected"; }
  else if (ratio >= 0.7) { probability = 38; label = "Top Pick"; }
  else if (ratio >= 0.55) { probability = 22; label = "Top Pick"; }
  else { probability = Math.max(2, Math.round(ratio * 20)); label = "Out of Range"; }
  return { probability, label };
}

function CollegeChances() {
  const [colleges, setColleges] = useState<College[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<College | null>(null);
  const [rank, setRank] = useState("");
  const [category, setCategory] = useState<Category>("GM");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BranchRow[] | null>(null);

  // Load distinct college list (code+name)
  useEffect(() => {
    supabase.from("kcet_cutoffs").select("college_code,college_name").limit(10000)
      .then(({ data, error }) => {
        if (error) return toast.error(error.message);
        const seen = new Map<string, College>();
        for (const r of data ?? []) {
          if (!seen.has(r.college_code)) seen.set(r.college_code, { code: r.college_code, name: r.college_name });
        }
        setColleges(Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name)));
      });
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return colleges.slice(0, 15);
    return colleges
      .filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
      .slice(0, 20);
  }, [colleges, query]);

  async function check() {
    if (!picked) return toast.error("Pick a college");
    const r = Number(rank);
    if (!r) return toast.error("Enter a valid KCET rank");
    setLoading(true);
    setRows(null);
    try {
      const { data, error } = await supabase
        .from("kcet_cutoffs")
        .select("branch,round,cutoff_rank")
        .eq("college_code", picked.code)
        .eq("category", category)
        .in("round", [1, 2])
        .limit(2000);
      if (error) throw error;
      const map = new Map<string, { r1: number | null; r2: number | null }>();
      for (const x of data ?? []) {
        const cur = map.get(x.branch) ?? { r1: null, r2: null };
        if (x.round === 1) cur.r1 = Number(x.cutoff_rank);
        else if (x.round === 2) cur.r2 = Number(x.cutoff_rank);
        map.set(x.branch, cur);
      }
      const out: BranchRow[] = Array.from(map.entries()).map(([branch, v]) => {
        const { probability, label } = computeRow(r, v.r1, v.r2);
        return { branch, r1: v.r1, r2: v.r2, probability, label };
      });
      out.sort((a, b) => b.probability - a.probability);
      setRows(out);
      if (!out.length) toast.warning("No data for this college / category combo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-hero-gradient p-6 text-white shadow-elegant sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">College Chances 🎯</h1>
        <p className="mt-1 text-white/85">Pick a college, see your admission probability for every branch.</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
          <div>
            <Label>Search college (name or code)</Label>
            <Input placeholder="e.g. RV College, E005..." value={query}
              onChange={(e) => { setQuery(e.target.value); setPicked(null); }} />
            {!picked && (
              <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
                {filtered.map((c) => (
                  <button key={c.code} type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => { setPicked(c); setQuery(c.name); }}>
                    <div className="font-medium line-clamp-1">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.code}{districtFor(c.name) && ` · ${districtFor(c.name)}`}</div>
                  </button>
                ))}
                {!filtered.length && <div className="p-3 text-sm text-muted-foreground">No matches</div>}
              </div>
            )}
            {picked && (
              <div className="mt-2 rounded-md border border-primary bg-primary/5 p-3 text-sm">
                <div className="font-medium">{picked.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  {picked.code}{districtFor(picked.name) && <><span>·</span><MapPin className="h-3 w-3" />{districtFor(picked.name)}</>}
                </div>
              </div>
            )}
          </div>
          <div>
            <Label>KCET Rank</Label>
            <Input inputMode="numeric" value={rank} onChange={(e) => setRank(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 8000" />
          </div>
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={check} disabled={loading || !picked} className="w-full">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Checking...</> : <><Target className="h-4 w-4 mr-2" />Check My Chances</>}
          </Button>
        </div>

        <div>
          {!rows ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
              <School className="mx-auto h-10 w-10 text-primary/60" />
              <h3 className="mt-3 text-lg font-semibold">Branch-wise chances appear here</h3>
              <p className="mt-1 text-sm text-muted-foreground">Pick a college, enter your rank and category.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
              {picked && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold">{picked.name}</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    {picked.code}{districtFor(picked.name) && <><span>·</span><MapPin className="h-3 w-3" />{districtFor(picked.name)}</>}
                  </p>
                </div>
              )}
              <ul className="divide-y divide-border">
                {rows.map((r) => (
                  <li key={r.branch} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-medium text-sm">{r.branch}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        R1: {r.r1 ?? "—"} · R2: {r.r2 ?? "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold tabular-nums">{r.probability}%</div>
                      <Badge className={
                        r.label === "Sure-Shot" ? "bg-emerald text-emerald-foreground"
                          : r.label === "Expected" ? "bg-primary text-primary-foreground"
                            : r.label === "Top Pick" ? "bg-accent text-accent-foreground"
                              : "bg-muted text-muted-foreground"
                      }>{r.label}</Badge>
                    </div>
                  </li>
                ))}
                {!rows.length && <li className="py-6 text-center text-sm text-muted-foreground">No branch data for this combination.</li>}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
