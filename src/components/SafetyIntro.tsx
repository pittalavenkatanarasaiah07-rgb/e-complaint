import { useEffect, useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import safetyIntro from "@/assets/safety-intro.mp4.asset.json";

const SafetyIntro = () => {
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);

  // Show the intro video on every visit until the user signs in.
  useEffect(() => {
    if (loading || user) return;
    setOpen(true);
  }, [loading, user]);

  useEffect(() => {
    if (user) setOpen(false);
  }, [user]);

  const closeIntro = () => {
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="safety-intro-title"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-elevated">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={closeIntro}
          aria-label="Close safety story"
          className="absolute right-3 top-3 z-10 rounded-full bg-background/90 shadow-card"
        >
          <X className="h-4 w-4" />
        </Button>

        <video
          className="aspect-[9/16] w-full bg-muted object-cover"
          src={safetyIntro.url}
          autoPlay
          muted
          playsInline
          controls
          onEnded={closeIntro}
          aria-label="Safety story showing SOS alert and complaint filing"
        />

        <div className="space-y-3 p-5">
          <div className="flex items-start gap-3">
            <PlayCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h2 id="safety-intro-title" className="text-base font-bold text-foreground">
                Stay safe with E-COMPLAINT
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                See how SOS alerts your contacts and how to file a complaint when you need help.
              </p>
            </div>
          </div>
          <Button type="button" onClick={closeIntro} className="w-full rounded-xl">
            Continue to E-COMPLAINT
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SafetyIntro;