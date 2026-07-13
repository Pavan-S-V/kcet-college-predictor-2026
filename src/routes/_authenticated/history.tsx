import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { downloadPredictionPdf, type PredictionResult, type PredictionRow } from "@/lib/predictor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Eye, Trash2, FileDown, History as HistoryIcon, MapPin } from "lucide-react";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "Prediction History — KCET" }] }),
  component: HistoryPage,
});

interface PredictionRecord {
  id: string;
  created_at: string;
  rank: number;
  category: string;
  branches: string[];
  districts: string[];
  results: PredictionRow[];
}

function HistoryPage() {
  const { user } = useAuth();
  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Student";
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PredictionRecord[]>([]);
  const [viewing, setViewing] = useState<PredictionRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("predictions")
      .select("id,created_at,rank,category,branches,districts,results")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else {
      setRows(
        (data ?? []).map((r) => ({
          ...r,
          districts: r.districts ?? [],
          results: Array.isArray(r.results) ? (r.results as unknown as PredictionRow[]) : [],
        })),
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    if (user) load();
  }, [user]);

  async function doDelete(id: string) {
    const { error } = await supabase.from("predictions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Prediction deleted");
  }

  function downloadPdf(rec: PredictionRecord) {
    if (!rec.results.length) return toast.error("This prediction has no saved results to export");
    const fakeResult: PredictionResult = {
      top: [], expected: [], sureShot: [],
      all: rec.results, recommended: rec.results, singleTop: false,
    };
    downloadPredictionPdf(fakeResult, {
      studentName: name,
      rank: rec.rank,
      category: rec.category,
      branches: rec.branches.filter((b) => b !== "__all__"),
      districts: rec.districts,
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="rounded-2xl bg-hero-gradient p-6 text-white shadow-elegant sm:p-8">
        <div className="flex items-center gap-3">
          <HistoryIcon className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">📊 Prediction History</h1>
            <p className="mt-1 text-white/85 text-sm">
              Every prediction you generate is saved here — search, filter, review, or export any time.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Label>Search</Label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Rank, branch, category or college..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Branch</Label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All branches</SelectItem>
                {BRANCHES.map((b) => <SelectItem key={b.label} value={b.label}>{b.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Category</Label>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All categories</SelectItem>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} of {rows.length} predictions</span>
          <button type="button" onClick={resetFilters} className="text-primary hover:underline">
            Reset filters
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading history...
          </div>
        ) : !rows.length ? (
          <div className="p-10 text-center">
            <HistoryIcon className="mx-auto h-10 w-10 text-primary/70" />
            <h3 className="mt-3 text-lg font-semibold">No prediction history found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate your first prediction to see it here.
            </p>
          </div>
        ) : !filtered.length ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No predictions match your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Rank</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>District</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const branchList = r.branches.includes("__all__")
                    ? ["All branches"]
                    : r.branches;
                  const districtList = r.districts.length ? r.districts : ["All Karnataka"];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {new Date(r.created_at).toLocaleDateString()}
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">{r.rank}</TableCell>
                      <TableCell><Badge variant="secondary">{r.category}</Badge></TableCell>
                      <TableCell className="max-w-[240px]">
                        <div className="flex flex-wrap gap-1">
                          {branchList.slice(0, 2).map((b) => (
                            <Badge key={b} variant="outline" className="text-[10px]">{b}</Badge>
                          ))}
                          {branchList.length > 2 && (
                            <Badge variant="outline" className="text-[10px]">+{branchList.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-muted-foreground">
                        {districtList.slice(0, 2).join(", ")}
                        {districtList.length > 2 && ` +${districtList.length - 2}`}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => setViewing(r)}>
                            <Eye className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">View</span>
                          </Button>
                          {r.results.length > 0 && (
                            <Button size="sm" variant="outline" onClick={() => downloadPdf(r)}>
                              <FileDown className="h-3.5 w-3.5 sm:mr-1" />
                              <span className="hidden sm:inline">PDF</span>
                            </Button>
                          )}
                          <Button size="sm" variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingId(r.id)}>
                            <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Prediction from {viewing && new Date(viewing.created_at).toLocaleString()}
            </DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-4">
              <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm sm:grid-cols-3">
                <div><span className="text-muted-foreground">Rank:</span> <b>{viewing.rank}</b></div>
                <div><span className="text-muted-foreground">Category:</span> <b>{viewing.category}</b></div>
                <div>
                  <span className="text-muted-foreground">Districts:</span>{" "}
                  <b>{viewing.districts.length ? viewing.districts.join(", ") : "All Karnataka"}</b>
                </div>
                <div className="sm:col-span-3">
                  <span className="text-muted-foreground">Branches:</span>{" "}
                  <b>{viewing.branches.includes("__all__") ? "All branches" : viewing.branches.join(", ")}</b>
                </div>
              </div>
              {viewing.results.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  This saved prediction has no stored college list.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
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
                      {viewing.results.map((row, i) => (
                        <TableRow key={`${row.college_code}-${row.branch_label}-${i}`}>
                          <TableCell className="text-center text-sm text-muted-foreground tabular-nums">{i + 1}</TableCell>
                          <TableCell className="font-medium">
                            <div className="line-clamp-2">{row.college_name}</div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {row.college_code}
                              {row.district && <><span>·</span><MapPin className="h-3 w-3" />{row.district}</>}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{row.branch_label || row.branch}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {row.round1_cutoff != null && row.round1_cutoff > 0 ? row.round1_cutoff : "Not Available"}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {row.round2_cutoff != null && row.round2_cutoff > 0 ? row.round2_cutoff : "Not Available"}
                          </TableCell>
                          <TableCell><Badge variant="secondary">{row.bucket} · {row.confidence}%</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {viewing.results.length > 0 && (
                <div className="flex justify-end">
                  <Button onClick={() => downloadPdf(viewing)}>
                    <FileDown className="mr-1 h-4 w-4" /> Download PDF Report
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this prediction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the saved prediction from your history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deletingId) await doDelete(deletingId);
                setDeletingId(null);
              }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
