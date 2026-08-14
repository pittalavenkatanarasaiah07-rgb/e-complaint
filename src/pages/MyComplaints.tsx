import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FileText, Clock, CheckCircle, AlertTriangle, LogIn, XCircle, Loader2, Download, Share2, Trash2, Table, Search, Mail } from "lucide-react";
import { toast } from "sonner";
import { generateComplaintPdf, shareComplaintPdfToWhatsApp, shareComplaintPdfByEmail, complaintsToCsv, formatReferenceId, loadComplaintEvidence } from "@/lib/complaintPdf";

interface Complaint {
  id: string;
  complaint_type: string;
  description: string;
  location: string | null;
  status: string;
  created_at: string;
}

const MyComplaints = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
    pending: { icon: Clock, color: "text-yellow-600", label: t("pending") },
    in_progress: { icon: AlertTriangle, color: "text-primary", label: t("inProgress") },
    resolved: { icon: CheckCircle, color: "text-success", label: t("resolved") },
    withdrawn: { icon: XCircle, color: "text-muted-foreground", label: "Withdrawn" },
  };

  const withdrawComplaint = async (id: string) => {
    setWithdrawingId(id);
    const { error } = await supabase.from("complaints").update({ status: "withdrawn" }).eq("id", id);
    setWithdrawingId(null);
    if (error) {
      toast.error("Could not withdraw complaint. Please try again.");
      return;
    }
    setComplaints((prev) => prev.map((c) => (c.id === id ? { ...c, status: "withdrawn" } : c)));
    toast.success("Complaint withdrawn");
  };

  const withEvidence = async (items: Complaint[]) => {
    if (!user) return items;
    return Promise.all(
      items.map(async (c) => ({ ...c, evidence: await loadComplaintEvidence(user.id, c.id) })),
    );
  };

  const exportPdf = async (items: Complaint[]) => {
    if (items.length === 0) return;
    try {
      const password = generateComplaintPdf(await withEvidence(items), {
        name: (user?.user_metadata?.full_name as string) || null,
        email: user?.email || null,
      });
      toast.success(`PDF downloaded — password: ${password}`, { duration: 8000 });
    } catch {
      toast.error("Could not generate the PDF report");
    }
  };

  const shareWhatsApp = async (items: Complaint[]) => {
    if (items.length === 0) return;
    try {
      const { result, password } = await shareComplaintPdfToWhatsApp(await withEvidence(items), {
        name: (user?.user_metadata?.full_name as string) || null,
        email: user?.email || null,
      });
      if (result === "downloaded") toast.info(`PDF downloaded (password: ${password}) — attach it in the WhatsApp chat that opened`, { duration: 8000 });
    } catch {
      toast.error("Could not share the PDF report");
    }
  };

  const shareEmail = async (items: Complaint[]) => {
    if (items.length === 0) return;
    try {
      const { password } = shareComplaintPdfByEmail(await withEvidence(items), {
        name: (user?.user_metadata?.full_name as string) || null,
        email: user?.email || null,
      });
      toast.info(`PDF downloaded (password: ${password}) — attach it to the email that opened`, { duration: 8000 });
    } catch {
      toast.error("Could not prepare the email");
    }
  };

  const exportCsv = () => {
    if (complaints.length === 0) return;
    try {
      complaintsToCsv(complaints);
      toast.success("CSV file downloaded");
    } catch {
      toast.error("Could not generate the CSV file");
    }
  };

  const removeComplaint = async (id: string) => {
    setRemovingId(id);
    const { error } = await supabase.from("complaints").delete().eq("id", id);
    setRemovingId(null);
    setConfirmRemoveId(null);
    if (error) {
      toast.error("Could not remove the complaint request. Please try again.");
      return;
    }
    setComplaints((prev) => prev.filter((c) => c.id !== id));
    toast.success("Complaint request removed");
  };

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    const fetchComplaints = async () => {
      const { data } = await supabase.from("complaints").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      setComplaints((data as Complaint[]) || []);
      setLoading(false);
    };
    fetchComplaints();
  }, [user]);

  const query = search.trim().replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const filtered = query
    ? complaints.filter((c) => formatReferenceId(c.id).includes(query))
    : complaints;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("myComplaints")} subtitle={t("trackComplaints")} />
      <main className="flex-1 space-y-3 px-4 py-6 sm:px-5">
        {!user ? (
          <div className="flex flex-col items-center gap-4 py-12 text-center">
            <LogIn className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Please log in to view your complaints</p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/auth">{t("login")}</Link>
            </Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("noComplaints")}</p>
          </div>
        ) : (
          <>
          <div className="space-y-2">
            <Button onClick={() => exportPdf(complaints)} className="w-full rounded-xl">
              <Download className="mr-2 h-4 w-4" /> Export all as PDF report
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportCsv} className="flex-1 rounded-xl text-xs">
                <Table className="mr-1.5 h-4 w-4" /> Export CSV
              </Button>
              <Button variant="outline" onClick={() => shareWhatsApp(complaints)} className="flex-1 rounded-xl text-xs">
                <Share2 className="mr-1.5 h-4 w-4" /> Share on WhatsApp
              </Button>
            </div>
            <Button variant="outline" onClick={() => shareEmail(complaints)} className="w-full rounded-xl text-xs">
              <Mail className="mr-1.5 h-4 w-4" /> Share by email (with PDF password)
            </Button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by reference number"
              className="rounded-xl pl-9"
            />
          </div>
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No complaint found for that reference number</p>
          )}
          {filtered.map((c) => {
            const status = statusConfig[c.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground capitalize">{c.complaint_type.replace(/-/g, " ")}</h3>
                    <p className="font-mono text-xs text-primary">#{formatReferenceId(c.id)}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium shrink-0 ml-2 ${status.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />{status.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {c.location && <span className="truncate">📍 {c.location}</span>}
                  <span className="shrink-0">{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportPdf([c])} className="flex-1 rounded-xl text-xs">
                    <Download className="mr-1 h-3.5 w-3.5" /> PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => shareWhatsApp([c])} className="flex-1 rounded-xl text-xs">
                    <Share2 className="mr-1 h-3.5 w-3.5" /> WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => shareEmail([c])} className="flex-1 rounded-xl text-xs">
                    <Mail className="mr-1 h-3.5 w-3.5" /> Email
                  </Button>
                  {(c.status === "pending" || c.status === "in_progress") && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={withdrawingId === c.id}
                      onClick={() => withdrawComplaint(c.id)}
                      className="w-full rounded-xl text-xs text-destructive hover:bg-destructive/10"
                    >
                      {withdrawingId === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                      Withdraw complaint
                    </Button>
                  )}
                  {c.status === "withdrawn" && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={removingId === c.id}
                      onClick={() => setConfirmRemoveId(c.id)}
                      className="w-full rounded-xl text-xs text-destructive hover:bg-destructive/10"
                    >
                      {removingId === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                      Remove complaint request
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          </>
        )}
      </main>
      <AlertDialog open={!!confirmRemoveId} onOpenChange={(o) => !o && setConfirmRemoveId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this complaint request?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the withdrawn complaint
              {confirmRemoveId ? ` #${formatReferenceId(confirmRemoveId)}` : ""} and its record. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={!!removingId}
              onClick={(e) => {
                e.preventDefault();
                if (confirmRemoveId) removeComplaint(confirmRemoveId);
              }}
            >
              {removingId ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyComplaints;
