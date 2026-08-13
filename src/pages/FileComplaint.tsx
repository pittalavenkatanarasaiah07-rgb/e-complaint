import { useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "@/components/PageHeader";
import { FileText, Upload, CheckCircle, MapPin, LogIn, Camera, X, Image, Mic, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { formatReferenceId } from "@/lib/complaintPdf";

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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const detectLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocation(`${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`); toast.success("Location detected!"); },
      () => toast.error("Could not get location")
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedFiles.length > 5) {
      toast.error("Maximum 5 files allowed");
      return;
    }
    setSelectedFiles((prev) => [...prev, ...files]);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], `recording_${Date.now()}.webm`, { type: "audio/webm" });
        if (selectedFiles.length < 5) {
          setSelectedFiles((prev) => [...prev, audioFile]);
          toast.success("Audio recording saved!");
        } else {
          toast.error("Maximum 5 files allowed");
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      toast.info("Recording started...");
    } catch (e) {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const uploadFiles = async (complaintId: string): Promise<string[]> => {
    if (!user || selectedFiles.length === 0) return [];
    const urls: string[] = [];
    for (const file of selectedFiles) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${complaintId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("complaint-evidence").upload(path, file);
      if (!error) urls.push(path);
      else console.error("Upload error:", error);
    }
    return urls;
  };

  const handleSubmit = async () => {
    if (!user) { toast.error("Please log in to file a complaint"); return; }
    if (!complaintType || !description) { toast.error("Please fill required fields"); return; }
    setLoading(true);
    setUploading(selectedFiles.length > 0);
    const { data, error } = await supabase.from("complaints").insert({ user_id: user.id, complaint_type: complaintType, description, location, latitude: coords?.lat, longitude: coords?.lng }).select().single();
    if (error) { toast.error(error.message); setLoading(false); setUploading(false); return; }
    if (selectedFiles.length > 0) await uploadFiles(data.id);
    setUploading(false);
    setLoading(false);
    setRefId(formatReferenceId(data.id));
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader title={t("fileComplaint")} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 sm:px-6">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10"><CheckCircle className="h-10 w-10 text-success" /></div>
          <h2 className="text-xl font-bold text-foreground">{t("complaintFiled")}</h2>
          <p className="text-center text-sm text-muted-foreground">{t("complaintFiledDesc")}</p>
          <p className="text-sm font-medium text-primary">Reference #{refId}</p>
          <Button onClick={() => navigate("/my-complaints")} variant="outline" className="rounded-xl">{t("viewMyComplaints")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title={t("fileComplaint")} subtitle={t("reportIncident")} />
      <main className="flex-1 space-y-5 px-4 py-6 sm:px-5">
        {!user && (
          <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <LogIn className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Login required to submit</p>
              <p className="text-xs text-muted-foreground">You can fill the form, but must login to submit.</p>
            </div>
            <Button asChild size="sm" variant="outline" className="rounded-lg shrink-0">
              <Link to="/auth">{t("login")}</Link>
            </Button>
          </div>
        )}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">{t("crimeType")}</Label>
          <Select onValueChange={setComplaintType}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder={t("selectCrimeType")} /></SelectTrigger>
            <SelectContent>
              {crimeTypeKeys.map((key) => (<SelectItem key={key} value={key}>{t(key)}</SelectItem>))}
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
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => cameraInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" /> Take Photo
              </Button>
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => fileInputRef.current?.click()}>
                <Image className="mr-2 h-4 w-4" /> Gallery
              </Button>
            </div>
            <div className="flex gap-2">
              {!recording ? (
                <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={startRecording}>
                  <Mic className="mr-2 h-4 w-4" /> Record Audio
                </Button>
              ) : (
                <Button type="button" variant="destructive" className="flex-1 rounded-xl animate-pulse" onClick={stopRecording}>
                  <Square className="mr-2 h-4 w-4" /> Stop Recording
                </Button>
              )}
              <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={() => audioInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Audio File
              </Button>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
            <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
            <input ref={audioInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileSelect} />
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-2">
                    {file.type.startsWith("image/") ? (
                      <img src={URL.createObjectURL(file)} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : file.type.startsWith("audio/") ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-primary/10"><Mic className="h-4 w-4 text-primary" /></div>
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted"><Upload className="h-4 w-4 text-muted-foreground" /></div>
                    )}
                    <span className="flex-1 text-xs text-foreground truncate">{file.name}</span>
                    <button onClick={() => removeFile(i)} className="shrink-0 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">{selectedFiles.length}/5 files selected</p>
              </div>
            )}
            {selectedFiles.length === 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-secondary/50 p-4">
                <Upload className="h-5 w-5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{t("uploadEvidence")}</span>
              </div>
            )}
          </div>
        </div>
        <Button className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated" onClick={handleSubmit} disabled={loading || recording}>
          <FileText className="mr-2 h-5 w-5" />{uploading ? "Uploading evidence..." : loading ? t("submitting") : t("submitComplaint")}
        </Button>
      </main>
    </div>
  );
};

export default FileComplaint;
