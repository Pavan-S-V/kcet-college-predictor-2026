import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyExternalSync } from "@/lib/ext-sync.functions";

type Report = Awaited<ReturnType<typeof verifyExternalSync>>;

function Section({ title, rows, cols }: { title: string; rows: Record<string, unknown>[]; cols: string[] }) {
  const ok = rows.length === 0;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 font-medium">
        {ok ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <AlertTriangle className="h-4 w-4 text-destructive" />}
        {title} <span className="text-sm text-muted-foreground">({rows.length})</span>
      </div>
      {!ok && (
        <div className="mt-3 max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr>{cols.map((c) => <th key={c} className="px-2 py-1 font-medium capitalize">{c}</th>)}</tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{cols.map((c) => <td key={c} className="px-2 py-1">{String(r[c] ?? "—")}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function VerificationReport() {
  const verify = useServerFn(verifyExternalSync);
  const [r, setR] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Verification Report</h2>
        <Button size="sm" variant="outline" disabled={busy} onClick={async () => {
          setBusy(true); setErr("");
          try { setR(await verify()); } catch (e) { setErr(e instanceof Error ? e.message : "Check failed"); }
          finally { setBusy(false); }
        }}>{busy ? "Checking…" : "Run verification"}</Button>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Compares users, logins and prediction counts between this site and your external tables.</p>
      {err && <p className="mt-3 text-sm text-destructive">{err}</p>}
      {r && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Users", r.totals.appUsers, r.totals.extUsers], ["Logins", r.totals.appLogins, r.totals.extLogins], ["Predictions", r.totals.appPredictions, r.totals.extPredictions]].map(([l, a, e]) => (
              <div key={l as string} className="rounded-xl border border-border bg-card p-4 text-sm">
                <div className="text-muted-foreground">{l}</div>
                <div className="mt-1 font-semibold">App {a} · External {e} {a === e ? "✓" : "⚠"}</div>
              </div>
            ))}
          </div>
          <Section title="Users missing in external table" rows={r.missingUsers} cols={["email", "id"]} />
          <Section title="Duplicate user rows in external table" rows={r.duplicateUsers} cols={["email", "id", "count"]} />
          <Section title="External users not found in app" rows={r.orphanUsers} cols={["email", "id"]} />
          <Section title="Prediction count mismatches" rows={r.predictionMismatches} cols={["email", "app", "external"]} />
          <Section title="Login count mismatches" rows={r.loginMismatches} cols={["email", "app", "external"]} />
          <Section title="Duplicate login records in external table" rows={r.duplicateLogins} cols={["email", "at", "count"]} />
          <p className="text-xs text-muted-foreground">Checked {new Date(r.checkedAt).toLocaleString("en-IN")}</p>
        </div>
      )}
    </div>
  );
}
