import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  CATEGORIES, BRANCHES, DISTRICTS,
  type Category,
} from "@/lib/kcet-constants";
import { runPrediction, downloadPredictionPdf, type PredictionResult, type PredictionRow } from "@/lib/predictor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Sparkles, Target, Trophy, Rocket, FileDown, MapPin, ChevronsUpDown, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Predict College — KCET" }] }),
  component: Dashboard,
});

const STEPS = [
  "Analyzing Round 1 Cutoffs...",
  "Analyzing Round 2 Cutoffs...",
  "Checking Seat Matrix...",
  "Evaluating Admission Chances...",
  "Generating Recommendations...",
];

function Dashboard() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Aspirant";

  const [rank, setRank] = useState<string>("");
  const [category, setCategory] = useState<Category>("GM");
  const [allBranches, setAllBranches] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtQuery, setDistrictQuery] = useState("");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [search, setSearch] = useState("");
  const [bucketFilter, setBucketFilter] = useState<"all" | "Sure-Shot" | "Expected" | "Top">("all");

  function toggleBranch(label: string) {
    setSelectedBranches((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  }

  // Animated progress while predicting
  useEffect(() => {
    if (!running) return;
    setProgress(0);
    setStep(0);
    const totalMs = 5500;
    const tickMs = 150;
    const inc = (tickMs / totalMs) * 100;
    const id = setInterval(() => {
      setProgress((p) => {
        const next = Math.min(99, p + inc);
        const s = Math.min(STEPS.length - 1, Math.floor((next / 100) * STEPS.length));
        setStep(s);
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [running]);

  async function predict() {
    const r = Number(rank);
    if (!r || r < 1) return toast.error("Enter a valid KCET rank");
    const branches = allBranches ? ["__all__"] : selectedBranches;
    if (!allBranches && !branches.length)
      return toast.error("Pick at least one branch (or choose All branches)");
    setRunning(true);
    const started = Date.now();
    try {
      const [res] = await Promise.all([
        runPrediction({ rank: r, category, branches, districts }),
        new Promise((rs) => setTimeout(rs, 5000)),
      ]);
      const elapsed = Date.now() - started;
      if (elapsed < 5400) await new Promise((rs) => setTimeout(rs, 5400 - elapsed));
      setProgress(100);
      setStep(STEPS.length - 1);
      await new Promise((rs) => setTimeout(rs, 300));
      setResult(res);
      if (!res.all.length) toast.warning("No matches — try widening branches, category or district.");
      else toast.success(`Found ${res.all.length} possible options`);
      if (user) {
        await supabase.from("predictions").insert({
          user_id: user.id, rank: r, category, mode: "balanced", branches,
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
    const base = bucketFilter === "all" ? result.all : result.all.filter((r) => r.bucket === bucketFilter);
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (r) => r.college_name.toLowerCase().includes(q) || r.branch.toLowerCase().includes(q),
    );
  }, [result, bucketFilter, search]);

  function pdf() {
    if (!result || !tableRows.length) return;
    downloadPredictionPdf(result, {
      studentName: name,
      rank: Number(rank),
      category,
      branches: allBranches ? ["All branches"] : selectedBranches,
      districts,
    });
  }

  const districtMatches = DISTRICTS.filter((d) =>
    !districtQuery.trim() ? true : d.toLowerCase().includes(districtQuery.toLowerCase()),
  );
  function toggleDistrict(d: string) {
    setDistricts((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-hero-gradient p-6 text-white shadow-elegant sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">Hello Future Engineer, {name}! 👋</h1>
        <p className="mt-1 text-white/85">Let's Find Your Dream College and Course</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold">Prediction inputs</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="rank">KCET Rank</Label>
              <Input id="rank" inputMode="numeric" placeholder="e.g. 15000" value={rank}
                onChange={(e) => setRank(e.target.value.replace(/\D/g, ""))} />
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
            <div>
              <Label>Districts (pick any number)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" type="button" className="mt-1 w-full justify-between font-normal">
                    <span className="truncate">
                      {districts.length === 0
                        ? "All Karnataka"
                        : districts.length <= 2
                          ? districts.join(", ")
                          : `${districts.length} districts selected`}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <div className="border-b border-border p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        autoFocus
                        placeholder="Search district..."
                        value={districtQuery}
                        onChange={(e) => setDistrictQuery(e.target.value)}
                        className="h-8 pl-7"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <button type="button" className="text-primary hover:underline"
                        onClick={() => setDistricts([])}>
                        Clear (All Karnataka)
                      </button>
                      <button type="button" className="text-primary hover:underline"
                        onClick={() => setDistricts([...DISTRICTS])}>
                        Select all
                      </button>
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {districtMatches.map((d) => {
                      const checked = districts.includes(d);
                      return (
                        <label key={d}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                          <Checkbox checked={checked} onCheckedChange={() => toggleDistrict(d)} />
                          <span className="flex-1">{d}</span>
                        </label>
                      );
                    })}
                    {!districtMatches.length && (
                      <div className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {districts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {districts.map((d) => (
                    <Badge key={d} variant="secondary" className="gap-1 pr-1">
                      {d}
                      <button type="button" onClick={() => toggleDistrict(d)}
                        className="rounded hover:bg-background/50">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
                <>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tick branches in order of preference — the order you click them is the order
                    the predictor will prioritise (1st pick first).
                  </p>
                  <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto rounded-md border border-border p-3">
                    {BRANCHES.map((b) => {
                      const idx = selectedBranches.indexOf(b.label);
                      return (
                        <label key={b.label} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={idx >= 0} onCheckedChange={() => toggleBranch(b.label)} />
                          <span className="flex-1">{b.label}</span>
                          {idx >= 0 && <Badge variant="outline" className="text-[10px]">#{idx + 1}</Badge>}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div>
              <Label>Prediction mode</Label>
              <div className="mt-2 grid gap-2">
                {PREDICTION_MODES.map((m) => (
                  <button key={m.id} type="button" onClick={() => setMode(m.id)}
                    className={`rounded-lg border p-3 text-left text-sm transition-colors ${mode === m.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <div className="font-medium">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.description}</div>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={predict} disabled={running} className="w-full">
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Predicting...</>
                : <><Sparkles className="h-4 w-4 mr-2" /> Predict colleges</>}
            </Button>
          </div>
        </div>

        <div>
          {running ? (
            <div className="rounded-2xl border border-border bg-surface p-10">
              <div className="mx-auto max-w-md text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{STEPS[step]}</h3>
                <Progress value={progress} className="mt-5" />
                <div className="mt-2 text-sm text-muted-foreground">{Math.round(progress)}%</div>
                <ol className="mt-6 space-y-1.5 text-left text-sm">
                  {STEPS.map((s, i) => (
                    <li key={s} className={`flex items-center gap-2 ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${i < step ? "bg-emerald text-emerald-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {i < step ? "✓" : i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : !result ? (
            <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
              <Trophy className="mx-auto h-10 w-10 text-primary/70" />
              <h3 className="mt-3 text-lg font-semibold">Your predictions appear here</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Fill in your rank, category, district and branches to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <BucketCard icon={Trophy} title="🏆 Top Colleges" count={result.top.length} tone="top" />
                <BucketCard icon={Target} title="🎯 Expected Colleges" count={result.expected.length} tone="expected" />
                <BucketCard icon={Rocket} title="✅ Sure-Shot Colleges" count={result.sureShot.length} tone="sure" />
              </div>

              <div className="rounded-2xl border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search college or branch..."
                      value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Tabs value={bucketFilter} onValueChange={(v) => setBucketFilter(v as typeof bucketFilter)}>
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="Top">Top</TabsTrigger>
                      <TabsTrigger value="Expected">Expected</TabsTrigger>
                      <TabsTrigger value="Sure-Shot">Sure</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  <Button variant="default" size="sm" onClick={pdf}>
                    <FileDown className="h-4 w-4 mr-1" /> Download PDF Report
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>College</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">R1 / R2</TableHead>
                        <TableHead>Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-10">
                            No matching colleges. Try widening branches, category or district.
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

function BucketCard({ icon: Icon, title, count, tone }: {
  icon: typeof Trophy; title: string; count: number; tone: "top" | "expected" | "sure";
}) {
  const toneClass =
    tone === "top" ? "bg-accent border-accent text-accent-foreground"
      : tone === "expected" ? "bg-primary/10 text-primary border-primary/30"
        : "bg-emerald/10 text-emerald border-emerald/30";
  return (
    <div className="rounded-2xl border bg-surface p-5">
      <div className={`inline-grid h-10 w-10 place-items-center rounded-lg ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-3 text-2xl font-bold">{count}</div>
      <div className="text-sm text-muted-foreground">{title}</div>
    </div>
  );
}

function ResultRow({ r }: { r: PredictionRow }) {
  const tone = r.bucket === "Sure-Shot" ? "bg-emerald text-emerald-foreground"
    : r.bucket === "Expected" ? "bg-primary text-primary-foreground"
      : "bg-accent text-accent-foreground";
  return (
    <TableRow>
      <TableCell className="font-medium">
        <div className="line-clamp-2">{r.college_name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {r.college_code}
          {r.district && <><span>·</span><MapPin className="h-3 w-3" />{r.district}</>}
        </div>
      </TableCell>
      <TableCell className="text-sm">{r.branch}</TableCell>
      <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        <div>R1: {r.round1_cutoff ?? "Not Available"}</div>
        <div className="text-muted-foreground">R2: {r.round2_cutoff ?? "Not Available"}</div>
      </TableCell>
      <TableCell><Badge className={tone}>{r.bucket} · {r.confidence}%</Badge></TableCell>
    </TableRow>
  );
}
