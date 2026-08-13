import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Download, Loader2, LogIn, RefreshCw } from "lucide-react";

const kindFor = (name: string) => {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg", "png", "webp", "gif", "bmp"].includes(ext)) return "image";
  if (["mp4", "mov", "webm", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (["mp3", "wav", "m4a", "aac", "ogg", "oga", "opus"].includes(ext)) return "audio";
  return "file";
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EvidenceView = () => {
  const [params] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const userId = params.get("u") || "";
  const complaintId = params.get("c") || "";
  const name = params.get("f") || "";
  const path = `${userId}/${complaintId}/${name}`;
  const kind = kindFor(name);

  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  const sign = useCallback(async () => {
    if (!userId || !complaintId || !name) {
      setState("error");
      setMessage("This evidence link is incomplete or malformed.");
      return;
    }
    setState("loading");
    setMessage("");
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase.storage
        .from("complaint-evidence")
        .createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) {
        setUrl(data.signedUrl);
        setState("ready");
        return;
      }
      lastError = error?.message || "Could not prepare the file link.";
      if (attempt < 2) await sleep(400 * 2 ** attempt);
    }
    setState("error");
    setMessage(lastError);
  }, [path, userId, complaintId, name]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState("error");
      setMessage("Sign in with the account that filed this complaint to open the evidence.");
      return;
    }
    sign();
  }, [authLoading, user, sign]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="Evidence" subtitle={name || "Complaint evidence"} />
      <main className="flex-1 space-y-4 px-4 py-6 sm:px-5">
        {state === "loading" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Preparing your evidence file…</p>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-foreground">Evidence could not be opened</p>
            <p className="text-xs text-muted-foreground">{message}</p>
            {user ? (
              <Button onClick={sign} className="w-full rounded-xl">
                <RefreshCw className="mr-2 h-4 w-4" /> Try again
              </Button>
            ) : (
              <Button asChild className="w-full rounded-xl">
                <Link to="/auth"><LogIn className="mr-2 h-4 w-4" /> Sign in to continue</Link>
              </Button>
            )}
          </div>
        )}

        {state === "ready" && url && (
          <div className="space-y-4">
            {kind === "image" && (
              <img
                src={url}
                alt={`Complaint evidence ${name}`}
                className="w-full rounded-2xl border border-border object-contain"
                onError={() => { setState("error"); setMessage("The file link expired while loading. Tap try again."); }}
              />
            )}
            {kind === "video" && (
              <video
                src={url}
                controls
                playsInline
                className="w-full rounded-2xl border border-border bg-black"
                onError={() => { setState("error"); setMessage("Playback failed — the link may have expired. Tap try again."); }}
              />
            )}
            {kind === "audio" && (
              <audio
                src={url}
                controls
                className="w-full"
                onError={() => { setState("error"); setMessage("Playback failed — the link may have expired. Tap try again."); }}
              />
            )}
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1 rounded-xl">
                <a href={url} download={name} target="_blank" rel="noreferrer">
                  <Download className="mr-2 h-4 w-4" /> Download
                </a>
              </Button>
              <Button variant="outline" onClick={sign} className="rounded-xl">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Links are refreshed each time you open this page, so shared reports keep working.
            </p>
          </div>
        )}

        <Button asChild variant="ghost" className="w-full rounded-xl">
          <Link to="/my-complaints">Back to my complaints</Link>
        </Button>
      </main>
    </div>
  );
};

export default EvidenceView;
