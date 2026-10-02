import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Users, UserCheck, TrendingUp, Clock, Activity, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getAdminAnalytics } from "@/lib/admin.functions";
import { syncAllUsers } from "@/lib/ext-sync.functions";
import { toast } from "sonner";
import { VerificationReport } from "@/components/admin/VerificationReport";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Analytics — KCET College & Course Predictor" },
      { name: "description", content: "Administrator-only user analytics." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");
const DAY = 86400000;

function AdminPage() {
  const fetchData = useServerFn(getAdminAnalytics);
  const syncAll = useServerFn(syncAllUsers);
  const [syncing, setSyncing] = useState(false);
  const q = useQuery({ queryKey: ["admin-analytics"], queryFn: () => fetchData(), retry: false });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"created" | "login">("login");

  const rows = useMemo(() => {
    const list = (q.data?.users ?? []).filter((u) =>
      (u.name + " " + u.email).toLowerCase().includes(search.toLowerCase()));
    const key = sort === "created" ? "created_at" : "last_sign_in_at";
    return [...list].sort((a, b) => (b[key] ?? "").localeCompare(a[key] ?? ""));
  }, [q.data, search, sort]);

  if (q.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page is only for the site administrator.</p>
        <Button asChild className="mt-6"><Link to="/dashboard">Back to dashboard</Link></Button>
      </div>
    );
  }
  if (q.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading analytics…</div>;

  const users = q.data!.users;
  const now = Date.now();
  const recent = users.filter((u) => u.last_sign_in_at && now - +new Date(u.last_sign_in_at) < 7 * DAY).length;
  const fresh = users.filter((u) => now - +new Date(u.created_at) < 7 * DAY).length;
  const latest = users.map((u) => u.last_sign_in_at).filter(Boolean).sort().pop() ?? null;

  const cards = [
    { label: "Total Users", value: users.length, icon: Users },
    { label: "Recent Users (7 days)", value: recent, icon: UserCheck },
    { label: "New Users (7 days)", value: fresh, icon: TrendingUp },
    { label: "Active Users (15 min)", value: q.data!.activeUsers, icon: Activity },
    { label: "Latest Login", value: fmt(latest), icon: Clock },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin Analytics</h1>
        <Button size="sm" disabled={syncing} onClick={async () => {
          setSyncing(true);
          try { const r = await syncAll(); toast.success(`Synced ${r.synced} users and ${r.logins} recent logins`); }
          catch (e) { toast.error(e instanceof Error ? e.message : "Sync failed"); }
          finally { setSyncing(false); }
        }}>{syncing ? "Syncing…" : "Sync all users"}</Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><c.icon className="h-4 w-4 text-primary" />{c.label}</div>
            <div className="mt-2 text-xl font-semibold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:max-w-xs" />
        <div className="flex gap-2">
          <Button size="sm" variant={sort === "login" ? "default" : "outline"} onClick={() => setSort("login")}>Sort by last login</Button>
          <Button size="sm" variant={sort === "created" ? "default" : "outline"} onClick={() => setSort("created")}>Sort by registered</Button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Name", "Email", "Provider", "Registered", "Last Login", "Predictions", "Last Prediction"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-4 py-3">{u.name || "—"}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3 capitalize">{u.provider}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmt(u.created_at)}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmt(u.last_sign_in_at)}</td>
                <td className="px-4 py-3">{u.prediction_count}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmt(u.last_prediction_at)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">No users found</td></tr>}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 text-lg font-semibold">Login Activity <span className="text-sm font-normal text-muted-foreground">(latest 200 · {q.data!.totalPredictions} predictions total)</span></h2>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>{["Name", "Email", "Provider", "Logged in at"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {q.data!.logins.map((l, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-4 py-3">{l.name || "—"}</td>
                <td className="px-4 py-3">{l.email || "—"}</td>
                <td className="px-4 py-3 capitalize">{l.provider}</td>
                <td className="px-4 py-3 whitespace-nowrap">{fmt(l.at)}</td>
              </tr>
            ))}
            {q.data!.logins.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No logins recorded yet</td></tr>}
          </tbody>
        </table>
      </div>
      <VerificationReport />
    </div>
  );
}
