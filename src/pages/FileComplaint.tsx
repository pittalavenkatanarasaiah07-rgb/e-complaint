import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { FileText, Upload, CheckCircle, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";

const crimeTypeKeys = ["theft", "assault", "fraud", "harassment", "domesticViolence", "missingPerson", "other"] as const;

const FileComplaint = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [submitted, setSubmitted] = useState(false);
  const [refId, setRefId] = useState("");
  const [loading, setLoading] = useState(false);
  const [complaintType, setComplaintType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); toast.success("Location detected!"); },
      () => toast.error("Could not get location")
    );
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("Please log in first"); navigate("/auth"); return; }
    if (!complaintType || !description) { toast.error("Please fill required fields"); return; }
    setLoading(true);
    const { data, error } = await supabase.from("complaints").insert({ user_id: user.id, complaint_type: complaintType, description, location, latitude: coords?.lat, longitude: coords?.lng }).select().single();
    setLoading(false);
    if (error) { toast.error(error.message); } else { setRefId(data.id.slice(0, 8).toUpperCase()); setSubmitted(true); }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader title={t("fileComplaint")} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10"><CheckCircle className="h-10 w-10 text-success" /></div>
          <h2 className="text-xl font-bold text-foreground">{t("complaintFiled")}</h2>
          <p className="text-center text-sm text-muted-foreground">{t("complaintFiledDesc")}</p>
          <p className="text-sm font-medium text-primary">Reference #SG-{refId}</p>
          <Button onClick={() => navigate("/my-complaints")} variant="outline" className="rounded-xl">{t("viewMyComplaints")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("fileComplaint")} subtitle={t("reportIncident")} />
      <main className="flex-1 space-y-5 px-5 py-6">
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t("crimeType")}</Label>
          <Select onValueChange={setComplaintType}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("selectCrimeType")} /></SelectTrigger>
            <SelectContent>
              {crimeTypeKeys.map((key) => (
                <SelectItem key={key} value={key}>{t(key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t("location")}</Label>
          <div className="flex gap-2">
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("enterLocation")} className="rounded-xl flex-1" />
            <Button type="button" variant="outline" onClick={detectLocation} className="rounded-xl shrink-0"><MapPin className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t("description")}</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("describeIncident")} className="min-h-[120px] rounded-xl" />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t("evidence")}</Label>
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/50 p-4">
            <Upload className="h-5 w-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{t("uploadEvidence")}</span>
          </div>
        </div>
        <Button className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated" onClick={handleSubmit} disabled={loading}>
          <FileText className="mr-2 h-5 w-5" />{loading ? t("submitting") : t("submitComplaint")}
        </Button>
      </main>
    </div>
  );
};

export default FileComplaint;
