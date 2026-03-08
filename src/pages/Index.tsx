import { FileText, AlertTriangle, MapPin, Phone, ClipboardList, LogOut, Heart } from "lucide-react";
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
      <header className="flex items-center justify-between px-6 py-4">
        <div>
          {user && (
            <button onClick={signOut} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              {t("logout")}
            </button>
          )}
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex justify-center">
            <div className="animate-float">
              <img src={shieldIcon} alt="SafeGuard shield" className="h-24 w-24 drop-shadow-lg" />
            </div>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground">{t("appName")}</h1>
            <p className="text-lg font-medium text-primary">{t("tagline")}</p>
            <p className="mx-auto max-w-xs text-sm text-muted-foreground">{t("heroDesc")}</p>
            {user && (
              <p className="text-sm font-medium text-primary">
                {t("welcome")}, {user.user_metadata?.full_name || user.email}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FeatureCard icon={FileText} title={t("fileComplaint")} description={t("reportIncident")} to="/file-complaint" />
            <FeatureCard icon={AlertTriangle} title={t("sosEmergency")} description={t("instantAlert")} variant="emergency" to="/sos-emergency" />
            <FeatureCard icon={MapPin} title={t("nearbyStations")} description={t("findPoliceHelp")} to="/nearby-stations" />
            <FeatureCard icon={Heart} title={t("nearbyHospitals")} description={t("findMedicalHelp")} to="/nearby-hospitals" />
            {user ? (
              <FeatureCard icon={ClipboardList} title={t("myComplaints")} description={t("trackStatus")} to="/my-complaints" />
            ) : (
              <FeatureCard icon={Phone} title={t("emergencyCall")} description={t("quickDial")} variant="emergency" to="/sos-emergency" />
            )}
          </div>

          <div className="space-y-3 pt-2">
            {user ? (
              <Button asChild className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                <Link to="/file-complaint">{t("fileComplaint")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                  <Link to="/auth">{t("getStarted")}</Link>
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  {t("alreadyHaveAccount")}{" "}
                  <Link to="/auth" className="font-medium text-primary hover:underline">{t("login")}</Link>
                </p>
              </>
            )}
          </div>

          <Link to="/sos-emergency" className="fixed bottom-8 right-8">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-ring rounded-full bg-emergency" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-emergency text-emergency-foreground shadow-elevated transition-transform hover:scale-105 active:scale-95">
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
