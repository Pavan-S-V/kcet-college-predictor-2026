import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  CATEGORIES,
  BRANCHES,
  PREDICTION_MODES,
  type Category,
  type PredictionMode,
} from "@/lib/kcet-constants";
import { runPrediction, type PredictionResult, type PredictionRow } from "@/lib/predictor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Sparkles, Target, Trophy, Rocket, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — KCET Predictor" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Aspirant";

  const [rank, setRank] = useState<string>("");
  const [category, setCategory] = useState<Category>("GM");
  const [mode, setMode] = useState<PredictionMode>("balanced");
  const [allBranches, setAllBranches] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | "Sure-Shot" | "Expected" | "Top">(
    "all",
  );

  function toggleBranch(label: string) {
    setSelectedBranches((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  }

  async function predict() {
    const r = Number(rank);
    if (!r || r < 1) return toast.error("Enter a valid KCET rank");
    const branches = allBranches ? ["__all__"] : selectedBranches;
    if (!allBranches && !branches.length)
      return toast.error("Pick at least one branch (or choose All branches)");
    setRunning(true);
    try {
      const res = await runPrediction({ rank: r, category, branches, mode });
      setResult(res);
      if (!res.all.length) toast.warning("No matches — try expanding branches or category.");
      else toast.success(`Found ${res.all.length} possible options`);
      // persist
      if (user) {
        await supabase.from("predictions").insert({
          user_id: user.id,
          rank: r,
          category,
          mode,
          branches,
          results: res.all.slice(0, 50) as never,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setRunning(false);
    }
  }

  const tableRows = useMemo(() => {
    if (!result) return [];
    const base =
      bucketFilter === "all" ? result.all : result.all.filter((r) => r.bucket === bucketFilter);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (r) => r.college_name.toLowerCase().includes(q) || r.branch.toLowerCase().includes(q),
    );
  }, [result, bucketFilter, search]);

  function downloadCSV() {
    if (!result || !tableRows.length) return;
    const head =
      "College,Branch,Category,Round 1 Cutoff,Round 2 Cutoff,Bucket,Confidence,Avg Package\n";
    const rows = tableRows
      .map((r) =>
        [
          r.college_name,
          r.branch,
          r.category,
          r.round1_cutoff ?? "-",
          r.round2_cutoff ?? "-",
          r.bucket,
          r.confidence + "%",
          r.avgPackage,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");
    const blob = new Blob([head + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kcet-prediction-rank-${rank}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-hero-gradient p-6 text-white shadow-elegant sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Hello Future Engineer, {name}! 👋</h1>
        <p className="mt-1 text-white/85">Let's Find Your Dream College and Course</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        {/* Input panel */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Prediction inputs</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="rank">KCET Rank</Label>
              <Input
                id="rank"
                inputMode="numeric"
                placeholder="e.g. 15000"
                value={rank}
                onChange={(e) => setRank(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Branches</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={allBranches} onCheckedChange={(v) => setAllBranches(!!v)} />
                  All branches
                </label>
              </div>
              {!allBranches && (
                <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-border p-3">
                  {BRANCHES.map((b) => (
                    <label key={b.label} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedBranches.includes(b.label)}
                        onCheckedChange={() => toggleBranch(b.label)}
                      />
                      {b.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Prediction mode</Label>
              <div className="mt-2 grid gap-2">
                {PREDICTION_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMode(m.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${mode === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={predict} disabled={running} className="w-full">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Predicting...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" /> Predict colleges
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Results panel */}
        <div>
          {!result ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
              <Trophy className="mx-auto h-10 w-10 text-primary/70" />
              <h3 className="mt-3 text-lg font-semibold">Your predictions appear here</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Fill in your rank, category and branches to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <BucketCard
                  icon={Trophy}
                  title="🏆 Top Colleges"
                  count={result.top.length}
                  tone="top"
                />
                <BucketCard
                  icon={Target}
                  title="🎯 Expected Colleges"
                  count={result.expected.length}
                  tone="expected"
                />
                <BucketCard
                  icon={Rocket}
                  title="✅ Sure-Shot Colleges"
                  count={result.sureShot.length}
                  tone="sure"
                />
              </div>

              <div className="rounded-2xl border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      placeholder="Search college or branch..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Tabs
                    value={bucketFilter}
                    onValueChange={(v) => setBucketFilter(v as typeof bucketFilter)}
                  >
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="Top">Top</TabsTrigger>
                      <TabsTrigger value="Expected">Expected</TabsTrigger>
                      <TabsTrigger value="Sure-Shot">Sure</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="outline" size="sm" onClick={downloadCSV}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>College</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Cutoffs (R1 / R2 / R3)</TableHead>
                        <TableHead>Avg Package</TableHead>
                        <TableHead>Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-sm text-muted-foreground py-10"
                          >
                            No matching colleges for this combination. Try widening branches or
                            switching category.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tableRows.map((r, i) => <ResultRow key={i} r={r} />)
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BucketCard({
  icon: Icon,
  title,
  count,
  tone,
}: {
  icon: typeof Trophy;
  title: string;
  count: number;
  tone: "top" | "expected" | "sure";
}) {
  const toneClass =
    tone === "top"
      ? "bg-accent border-accent text-accent-foreground"
      : tone === "expected"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-emerald/10 text-emerald border-emerald/30";
  return (
    <div className={`rounded-2xl border bg-surface p-5`}>
      <div className={`inline-grid h-10 w-10 place-items-center rounded-lg ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-2xl font-bold">{count}</div>
      <div className="text-sm text-muted-foreground">{title}</div>
    </div>
  );
}

function ResultRow({ r }: { r: PredictionRow }) {
  const tone =
    r.bucket === "Sure-Shot"
      ? "bg-emerald text-emerald-foreground"
      : r.bucket === "Expected"
        ? "bg-primary text-primary-foreground"
        : "bg-accent text-accent-foreground";
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="line-clamp-2">{r.college_name}</div>
        <div className="text-xs text-muted-foreground">{r.college_code}</div>
      </TableCell>
      <TableCell className="text-sm">{r.branch}</TableCell>
      <TableCell>
        <Badge variant="outline">{r.category}</Badge>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        <div>R1: {r.round1_cutoff ?? "—"}</div>
        <div className="text-muted-foreground">R2: {r.round2_cutoff ?? "—"}</div>
        <div className="text-muted-foreground">R3: {r.round3_cutoff ?? "—"}</div>
      </TableCell>
      <TableCell className="text-sm">{r.avgPackage}</TableCell>
      <TableCell>
        <Badge className={tone}>
          {r.bucket} · {r.confidence}%
        </Badge>
      </TableCell>
    </TableRow>
  );
}
