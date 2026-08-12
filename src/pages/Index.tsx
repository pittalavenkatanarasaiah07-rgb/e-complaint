import { FileText, AlertTriangle, MapPin, Phone, ClipboardList, LogOut, Heart, LogIn, UserPlus, User, Baby, Shield, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import FeatureCard from "@/components/FeatureCard";
import shieldIcon from "@/assets/shield-icon.png";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";

const Index = () => {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div>
          {user ? (
            <div className="flex items-center gap-3">
              <Link to="/profile" className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium">
                <User className="h-4 w-4" />
                Profile
              </Link>
              <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <LogOut className="h-4 w-4" />
                {t("logout")}
              </button>
            </div>
          ) : (
            <Link to="/auth" className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium">
              <LogIn className="h-4 w-4" />
              {t("login")}
            </Link>
          )}
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8 sm:px-6 sm:pb-12">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="flex justify-center">
            <div className="animate-float">
              <img src={shieldIcon} alt="E-COMPLAINT shield" className="h-20 w-20 sm:h-24 sm:w-24 drop-shadow-lg" />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">{t("appName")}</h1>
            <p className="text-base sm:text-lg font-medium text-primary">{t("tagline")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("heroDesc")}</p>
            {user && (
              <p className="text-sm font-medium text-primary">
                {t("welcome")}, {user.user_metadata?.full_name || user.email}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FeatureCard icon={FileText} title={t("fileComplaint")} description={t("reportIncident")} to="/file-complaint" />
            <FeatureCard icon={AlertTriangle} title={t("sosEmergency")} description={t("instantAlert")} variant="emergency" to="/sos-emergency" />
            <FeatureCard icon={MapPin} title={t("nearbyStations")} description={t("findPoliceHelp")} to="/nearby-stations" />
            <FeatureCard icon={Heart} title={t("nearbyHospitals")} description={t("findMedicalHelp")} to="/nearby-hospitals" />
            <FeatureCard icon={ClipboardList} title={t("myComplaints")} description={t("trackStatus")} to="/my-complaints" />
            <FeatureCard icon={UserPlus} title="Emergency Contacts" description="Save & manage contacts" to="/emergency-contacts" />
          </div>

          {/* Emergency Quick Dial */}
          <div className="w-full rounded-2xl border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-sm font-bold text-emergency flex items-center gap-2">
              <Phone className="h-4 w-4" /> Emergency Numbers — Tap to Call
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <a href="tel:100" className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:bg-muted active:scale-[0.98]">
                <Shield className="h-5 w-5 text-emergency shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Police</p>
                  <p className="text-xs text-muted-foreground">100</p>
                </div>
              </a>
              <a href="tel:108" className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:bg-muted active:scale-[0.98]">
                <Phone className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Ambulance</p>
                  <p className="text-xs text-muted-foreground">108</p>
                </div>
              </a>
              <a href="tel:181" className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:bg-muted active:scale-[0.98]">
                <Users className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Women Help</p>
                  <p className="text-xs text-muted-foreground">181</p>
                </div>
              </a>
              <a href="tel:1098" className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-all hover:bg-muted active:scale-[0.98]">
                <Baby className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Child Helpline</p>
                  <p className="text-xs text-muted-foreground">1098</p>
                </div>
              </a>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {user ? (
              <Button asChild className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                <Link to="/file-complaint">{t("fileComplaint")}</Link>
              </Button>
            ) : (
              <Button asChild className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                <Link to="/auth">{t("getStarted")}</Link>
              </Button>
            )}
          </div>

          <Link to="/sos-emergency?auto=1" aria-label="Send SOS alert" className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency" />
              <div className="relative flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-full bg-emergency text-emergency-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95">
                <span className="text-xs font-bold leading-tight">SOS</span>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
};

export default Index;
