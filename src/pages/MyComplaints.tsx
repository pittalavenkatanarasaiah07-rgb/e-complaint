import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import PageHeader from "@/components/PageHeader";
import { FileText, Clock, CheckCircle, AlertTriangle } from "lucide-react";

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

  const statusConfig: Record<string, { icon: typeof Clock; color: string; labelKey: "pending" | "inProgress" | "resolved" }> = {
    pending: { icon: Clock, color: "text-yellow-600", labelKey: "pending" },
    in_progress: { icon: AlertTriangle, color: "text-primary", labelKey: "inProgress" },
    resolved: { icon: CheckCircle, color: "text-success", labelKey: "resolved" },
  };

  useEffect(() => {
    if (!user) return;
    const fetchComplaints = async () => {
      const { data } = await supabase.from("complaints").select("*").order("created_at", { ascending: false });
      setComplaints((data as Complaint[]) || []);
      setLoading(false);
    };
    fetchComplaints();
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("myComplaints")} subtitle={t("trackComplaints")} />
      <main className="flex-1 space-y-3 px-5 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : complaints.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">{t("noComplaints")}</p>
          </div>
        ) : (
          complaints.map((c) => {
            const status = statusConfig[c.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground capitalize">{c.complaint_type.replace(/-/g, " ")}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                  </div>
                  <span className={`flex items-center gap-1 text-xs font-medium ${status.color}`}>
                    <StatusIcon className="h-3.5 w-3.5" />{t(status.labelKey)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  {c.location && <span>📍 {c.location}</span>}
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
};

export default MyComplaints;
