import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import shieldIcon from "@/assets/shield-icon.png";
import { ArrowLeft, Mail, Phone, Shield } from "lucide-react";

type Step = "signup" | "verify-email" | "phone" | "verify-phone" | "login";

const Auth = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Check your email for verification link!");
      setStep("verify-email");
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Please fill all fields");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Welcome back!");
      navigate("/");
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!phone) {
      toast.error("Enter your phone number");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ phone });
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
      type: "phone_change",
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
        <button
          onClick={() => navigate("/")}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
        <div className="w-full max-w-sm space-y-6">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <img src={shieldIcon} alt="SafeGuard" className="h-16 w-16" />
            <h1 className="text-2xl font-extrabold text-foreground">SafeGuard</h1>
          </div>

          {/* Signup */}
          {step === "signup" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-bold text-foreground">Create Account</h2>
                <p className="text-sm text-muted-foreground">Sign up to report incidents and get help</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" className="rounded-xl" />
                </div>
              </div>
              <Button onClick={handleSignup} disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                <Mail className="mr-2 h-5 w-5" />
                {loading ? "Creating..." : "Sign Up"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <button onClick={() => setStep("login")} className="font-medium text-primary hover:underline">Login</button>
              </p>
            </div>
          )}

          {/* Verify Email */}
          {step === "verify-email" && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Verify Your Email</h2>
              <p className="text-sm text-muted-foreground">
                We've sent a verification link to <span className="font-medium text-foreground">{email}</span>. Click the link to verify your email.
              </p>
              <Button onClick={() => setStep("login")} variant="outline" className="w-full rounded-xl py-6">
                I've verified — Continue to Login
              </Button>
            </div>
          )}

          {/* Phone number */}
          {step === "phone" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Verify Phone Number</h2>
                <p className="text-sm text-muted-foreground">Add your phone number for emergency alerts</p>
              </div>
              <div className="space-y-1.5">
                <Label>Phone Number</Label>
                <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" className="rounded-xl" />
              </div>
              <Button onClick={handleSendPhoneOtp} disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                {loading ? "Sending OTP..." : "Send OTP"}
              </Button>
              <button onClick={() => navigate("/")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                Skip for now
              </button>
            </div>
          )}

          {/* Verify Phone OTP */}
          {step === "verify-phone" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Enter OTP</h2>
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit code sent to <span className="font-medium text-foreground">{phone}</span>
                </p>
              </div>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit OTP"
                className="rounded-xl text-center text-lg tracking-widest"
                maxLength={6}
              />
              <Button onClick={handleVerifyPhoneOtp} disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                {loading ? "Verifying..." : "Verify & Continue"}
              </Button>
              <button onClick={handleSendPhoneOtp} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                Resend OTP
              </button>
            </div>
          )}

          {/* Login */}
          {step === "login" && (
            <div className="space-y-4">
              <div className="space-y-1 text-center">
                <h2 className="text-lg font-bold text-foreground">Welcome Back</h2>
                <p className="text-sm text-muted-foreground">Log in to your SafeGuard account</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" className="rounded-xl" />
                </div>
              </div>
              <Button onClick={handleLogin} disabled={loading} className="w-full rounded-xl py-6 text-base font-semibold shadow-elevated">
                {loading ? "Logging in..." : "Login"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button onClick={() => setStep("signup")} className="font-medium text-primary hover:underline">Sign Up</button>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Auth;
