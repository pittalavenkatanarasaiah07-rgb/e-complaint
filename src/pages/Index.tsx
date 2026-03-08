import { FileText, AlertTriangle, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import FeatureCard from "@/components/FeatureCard";
import shieldIcon from "@/assets/shield-icon.png";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-end px-6 py-4">
        <LanguageSwitcher />
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md space-y-8">
          {/* Shield Icon */}
          <div className="flex justify-center">
            <div className="animate-float">
              <img src={shieldIcon} alt="SafeGuard shield" className="h-24 w-24 drop-shadow-lg" />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
              SafeGuard
            </h1>
            <p className="text-lg font-medium text-primary">
              Your Safety, Our Priority
            </p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">
              Report crimes, access emergency services, and get help — all in one app. Completely free.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard
              icon={FileText}
              title="File Complaint"
              description="Report an incident"
            />
            <FeatureCard
              icon={AlertTriangle}
              title="SOS Emergency"
              description="Instant alert"
              variant="emergency"
            />
            <FeatureCard
              icon={MapPin}
              title="Nearby Stations"
              description="Find police help"
            />
            <FeatureCard
              icon={Phone}
              title="Emergency Call"
              description="Quick dial"
              variant="emergency"
            />
          </div>

          {/* CTA */}
          <div className="space-y-3 pt-2">
            <Button className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
              Get Started
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <a href="#" className="font-medium text-primary hover:underline">
                Login
              </a>
            </p>
          </div>

          {/* SOS floating button */}
          <div className="fixed bottom-8 right-8">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency" />
              <button className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emergency text-emergency-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95">
                <span className="text-xs font-bold leading-tight">SOS</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
