import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FileText, Clock, CheckCircle, AlertTriangle, LogIn, XCircle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { generateComplaintPdf } from "@/lib/complaintPdf";

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

  const exportPdf = (items: Complaint[]) => {
    if (items.length === 0) return;
    try {
      generateComplaintPdf(items, {
        name: (user?.user_metadata?.full_name as string) || null,
        email: user?.email || null,
      });
      toast.success("PDF report downloaded");
    } catch {
      toast.error("Could not generate the PDF report");
    }
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
          <Button onClick={() => exportPdf(complaints)} className="w-full rounded-xl">
            <Download className="mr-2 h-4 w-4" /> Export all as PDF report
          </Button>
          {complaints.map((c) => {
            const status = statusConfig[c.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground capitalize">{c.complaint_type.replace(/-/g, " ")}</h3>
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
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportPdf([c])} className="flex-1 rounded-xl text-xs">
                    <Download className="mr-1 h-3.5 w-3.5" /> PDF
                  </Button>
                  {(c.status === "pending" || c.status === "in_progress") && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={withdrawingId === c.id}
                      onClick={() => withdrawComplaint(c.id)}
                      className="flex-1 rounded-xl text-xs text-destructive hover:bg-destructive/10"
                    >
                      {withdrawingId === c.id ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
                      Withdraw
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          </>
        )}
      </main>
    </div>
  );
};

export default MyComplaints;
