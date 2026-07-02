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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Sparkles, Trophy, FileDown, MapPin, ChevronsUpDown, X, GraduationCap, Info } from "lucide-react";

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

  function toggleBranch(label: string) {
    setSelectedBranches((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label],
    );
  }

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
      else if (res.singleTop) toast.success(`Top college found for Rank ${r}`);
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
    const base = result.recommended && result.recommended.length ? result.recommended : result.all;
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter(
      (r) => r.college_name.toLowerCase().includes(q) || r.branch.toLowerCase().includes(q),
    );
  }, [result, search]);

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
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Prediction</h2>
            <SnqDialog />
          </div>
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
                    Tick branches in order of preference — the first branch you click
                    gets the highest priority in the mixed recommendation list.
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
              {result.singleTop && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold text-primary">
                    <Trophy className="h-4 w-4" /> Top College for your rank
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    For ranks 1–300 we show only the single strongest college that matches
                    your selected branch, district and category.
                  </p>
                </div>
              )}
              <div className="rounded-2xl border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                  <div>
                    <h3 className="text-lg font-semibold">Recommended Option Entry List</h3>
                    <p className="text-xs text-muted-foreground">
                      {tableRows.length} colleges · sorted by counseling priority
                    </p>
                  </div>
                  <div className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-8" placeholder="Search college or branch..."
                      value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Button variant="default" size="sm" onClick={pdf}>
                    <FileDown className="h-4 w-4 mr-1" /> Download PDF Report
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">S.No</TableHead>
                        <TableHead>College</TableHead>
                        <TableHead>Branch</TableHead>
                        <TableHead className="text-right">R1</TableHead>
                        <TableHead className="text-right">R2</TableHead>
                        <TableHead>Probability</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableRows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                            No matching colleges. Try widening branches, category or district.
                          </TableCell>
                        </TableRow>
                      ) : (
                        tableRows.map((r, i) => <ResultRow key={`${r.college_code}-${r.branch_label}-${i}`} sno={i + 1} r={r} />)
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

function ResultRow({ sno, r }: { sno: number; r: PredictionRow }) {
  const tone = r.bucket === "Sure-Shot" ? "bg-emerald text-emerald-foreground"
    : r.bucket === "Expected" ? "bg-primary text-primary-foreground"
      : "bg-accent text-accent-foreground";
  return (
    <TableRow>
      <TableCell className="text-center text-sm text-muted-foreground tabular-nums">{sno}</TableCell>
      <TableCell className="font-medium">
        <div className="line-clamp-2">{r.college_name}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {r.college_code}
          {r.district && <><span>·</span><MapPin className="h-3 w-3" />{r.district}</>}
        </div>
      </TableCell>
      <TableCell className="text-sm">{r.branch_label || r.branch}</TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {r.round1_cutoff != null && r.round1_cutoff > 0 ? r.round1_cutoff : "Not Available"}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {r.round2_cutoff != null && r.round2_cutoff > 0 ? r.round2_cutoff : "Not Available"}
      </TableCell>
      <TableCell><Badge className={tone}>{r.bucket} · {r.confidence}%</Badge></TableCell>
    </TableRow>
  );
}

function SnqDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="gap-1.5">
          <GraduationCap className="h-4 w-4" />
          <span className="hidden sm:inline">Need SNQ Info?</span>
          <span className="sm:hidden">SNQ</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            🎓 SNQ Quota Guide
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed">
          <section>
            <h4 className="font-semibold text-foreground">What is SNQ?</h4>
            <p className="mt-1 text-muted-foreground">
              SNQ (Supernumerary Quota) is a special fee-concession quota available for
              eligible Karnataka students admitted through KCET counseling. Students
              admitted under SNQ pay significantly reduced tuition fees compared to
              regular KCET fees.
            </p>
          </section>
          <section>
            <h4 className="font-semibold text-foreground">Eligibility Criteria</h4>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>Karnataka candidate</li>
              <li>Admission through KCET counseling</li>
              <li>Valid income certificate</li>
              <li>Family income within KEA-prescribed limits</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-foreground">Benefits</h4>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>Reduced tuition fees</li>
              <li>Same college, same branch, same degree certificate</li>
              <li>Same placement opportunities</li>
              <li>Same campus facilities</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-foreground">Required Documents</h4>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>Income Certificate</li>
              <li>KCET Details</li>
              <li>Aadhaar Card</li>
              <li>Study Certificates</li>
              <li>Caste Certificate (if applicable)</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-foreground">Important Points</h4>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground space-y-0.5">
              <li>SNQ seats are limited</li>
              <li>Approximately 5% seats per branch</li>
              <li>Eligibility does not guarantee allotment</li>
              <li>Seat allotment depends on rank, category, branch preference, option entry, and seat availability</li>
            </ul>
          </section>
          <section>
            <h4 className="font-semibold text-foreground">Does Every College Have SNQ Seats?</h4>
            <p className="mt-1 text-muted-foreground">
              Most participating colleges provide SNQ seats, but availability varies by
              college and branch.
            </p>
          </section>
          <section className="rounded-md border border-primary/20 bg-primary/5 p-3">
            <h4 className="flex items-center gap-1.5 font-semibold text-primary">
              <Info className="h-4 w-4" /> Important Notice
            </h4>
            <p className="mt-1 text-muted-foreground">
              This information is provided only for guidance. Students must verify
              eligibility, income limits, seat availability, fee structure, documents,
              and counseling rules through official KEA notifications.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
