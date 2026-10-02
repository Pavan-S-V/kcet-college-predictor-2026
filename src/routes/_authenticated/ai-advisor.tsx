import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CATEGORIES, BRANCHES } from "@/lib/kcet-constants";
import { runPrediction } from "@/lib/predictor";
import { explainPrediction } from "@/lib/ai-explain.functions";

export const Route = createFileRoute("/_authenticated/ai-advisor")({
  head: () => ({
    meta: [
      { title: "AI College Advisor — KCET College & Course Predictor" },
      { name: "description", content: "Get an AI-powered explanation of your predicted KCET college options." },
      { property: "og:title", content: "AI College Advisor — KCET" },
      { property: "og:description", content: "AI explanations of your KCET college predictions." },
    ],
  }),
  component: AdvisorPage,
});

function AdvisorPage() {
  const explain = useServerFn(explainPrediction);
  const [rank, setRank] = useState("");
  const [category, setCategory] = useState<string>("GM");
  const [branches, setBranches] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const toggle = (l: string) =>
    setBranches((b) => (b.includes(l) ? b.filter((x) => x !== l) : [...b, l]));

  async function run() {
    const r = Number(rank);
    if (!r || r < 1) { setError("Please enter a valid KCET rank."); return; }
    setBusy(true); setError(""); setText("");
    try {
      const res = await runPrediction({ rank: r, category: category as never, branches: branches.length ? branches : ["__all__"] });
      const options = res.recommended.slice(0, 25).map((o) => ({
        college: o.college_name, branch: o.branch_label, bucket: o.bucket,
        r1: o.round1_cutoff, r2: o.round2_cutoff,
      }));
      const out = await explain({ data: { rank: r, category, branches, options } });
      if (out.ok) setText(out.text); else setError(out.error);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold"><Sparkles className="h-6 w-6 text-primary" />AI College Advisor</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter your rank, category and preferred courses. AI will explain your predicted options in plain words.</p>
      <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">KCET Rank
            <Input type="number" min={1} value={rank} onChange={(e) => setRank(e.target.value)} placeholder="e.g. 12500" className="mt-1" />
          </label>
          <label className="text-sm font-medium">Category
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div>
          <div className="text-sm font-medium">Preferred courses <span className="font-normal text-muted-foreground">(tap in order of preference; none = all)</span></div>
          <div className="mt-2 flex flex-wrap gap-2">
            {BRANCHES.map((b) => {
              const i = branches.indexOf(b.label);
              return (
                <button key={b.label} type="button" onClick={() => toggle(b.label)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${i >= 0 ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}>
                  {i >= 0 ? `${i + 1}. ` : ""}{b.label}
                </button>
              );
            })}
          </div>
        </div>
        <Button onClick={run} disabled={busy}>
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analysing…</> : <><Sparkles className="mr-2 h-4 w-4" />Explain my options</>}
        </Button>
      </div>
      {error && <div className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
      {text && (
        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <Badge variant="secondary">AI-powered explanation</Badge>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{text.replace(/\*\*/g, "")}</div>
          <p className="mt-4 text-xs text-muted-foreground">Based on previous years' Round 1 and Round 2 cutoffs. Not a seat guarantee.</p>
        </div>
      )}
    </div>
  );
}
