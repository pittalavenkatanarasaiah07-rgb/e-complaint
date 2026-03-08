import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import shieldIcon from "@/assets/shield-icon.png";
import { ArrowLeft, Phone, Shield } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

type Step = "phone" | "verify-phone";

const Auth = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [step, setStep] = useState<Step>("phone");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendPhoneOtp = async () => {
    if (!phone || !fullName) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        data: { full_name: fullName }
      }
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("OTP sent to your phone!");
      setStep("verify-phone");
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otp) {
      toast.error("Enter the OTP");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms"
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Phone verified! You're all set.");
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => navigate("/")} className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-3">
            <img src={shieldIcon} alt="SafeGuard" className="h-16 w-16" />
            <h1 className="text-2xl font-extrabold text-foreground">{t("appName")}</h1>
          </div>


          {step === "phone" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">{t("createAccount")}</h2>
                <p className="text-sm text-muted-foreground">{t("verifyPhoneDesc")}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>{t("fullName")}</Label>
                  <Input 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)} 
                    placeholder={t("fullNamePlaceholder")} 
                    className="rounded-xl" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("phoneNumber")}</Label>
                  <Input 
                    type="tel" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="+91 XXXXX XXXXX" 
                    className="rounded-xl" 
                  />
                </div>
              </div>
              <Button 
                onClick={handleSendPhoneOtp} 
                disabled={loading} 
                className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated"
              >
                {loading ? t("sendingOtp") : t("sendOtp")}
              </Button>
            </div>
          )}

          {step === "verify-phone" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10"><Shield className="h-8 w-8 text-primary" /></div>
                <h2 className="text-lg font-bold text-foreground">{t("enterOtp")}</h2>
                <p className="text-sm text-muted-foreground">{t("enterOtpDesc")} <span className="font-medium text-foreground">{phone}</span></p>
              </div>
              <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="rounded-xl text-center text-lg tracking-widest" maxLength={6} />
              <Button onClick={handleVerifyPhoneOtp} disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">{loading ? t("verifying") : t("verifyAndContinue")}</Button>
              <button onClick={handleSendPhoneOtp} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">{t("resendOtp")}</button>
            </div>
          )}

          {step === "login" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-bold text-foreground">{t("welcomeBack")}</h2>
                <p className="text-sm text-muted-foreground">{t("loginDesc")}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5"><Label>{t("email")}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} className="rounded-xl" /></div>
                <div className="space-y-1.5"><Label>{t("password")}</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("yourPassword")} className="rounded-xl" /></div>
              </div>
              <Button onClick={handleLogin} disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">{loading ? t("loggingIn") : t("login")}</Button>
              <p className="text-center text-sm text-muted-foreground">
                {t("dontHaveAccount")}{" "}
                <button onClick={() => setStep("signup")} className="font-medium text-primary hover:underline">{t("signUp")}</button>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Auth;
