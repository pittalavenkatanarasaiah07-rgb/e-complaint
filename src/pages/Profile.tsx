import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { User, Mail, Phone, CheckCircle, XCircle, Camera, LogIn, Save, MapPin, Loader2, ShieldCheck } from "lucide-react";

const GOOGLE_API_KEY = "AIzaSyASY-gWNWZtkBySNO9dvdpMzz5NtyfgYzQ";

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Phone verification state
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [phoneVerifiedLocal, setPhoneVerifiedLocal] = useState(false);

  // Address location state
  const [fetchingAddress, setFetchingAddress] = useState(false);

  const emailVerified = !!user?.email_confirmed_at;
  const phoneVerified = phoneVerifiedLocal || !!user?.phone_confirmed_at;

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (data) {
      setFullName(data.full_name || user?.user_metadata?.full_name || "");
      setPhone(data.phone?.startsWith("OTP:") ? "" : (data.phone || ""));
      setAddress(data.address || "");
      setAvatarUrl(data.avatar_url);
    } else {
      setFullName(user?.user_metadata?.full_name || "");
    }
    setProfileLoaded(true);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("complaint-evidence")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Failed to upload photo");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("complaint-evidence")
      .getPublicUrl(path);

    const url = urlData.publicUrl;
    setAvatarUrl(url);

    await supabase
      .from("profiles")
      .update({ avatar_url: url })
      .eq("user_id", user.id);

    setUploading(false);
    toast.success("Profile photo updated!");
  };

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({
        user_id: user.id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        avatar_url: avatarUrl,
      }, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile");
    } else {
      toast.success("Profile saved!");
    }
  };

  // Phone verification
  const sendPhoneOtp = async () => {
    const rawPhone = phone.replace(/[^0-9]/g, "");
    if (rawPhone.length < 10) {
      toast.error("Enter a valid 10-digit phone number");
      return;
    }
    setSendingOtp(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-phone-otp", {
        body: { phone: "+91" + rawPhone.slice(-10), action: "send" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOtpSent(true);
      toast.success("OTP sent to your phone!");
    } catch (e: any) {
      toast.error(e.message || "Failed to send OTP");
    }
    setSendingOtp(false);
  };

  const verifyPhoneOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setVerifyingOtp(true);
    try {
      const rawPhone = phone.replace(/[^0-9]/g, "");
      const { data, error } = await supabase.functions.invoke("send-phone-otp", {
        body: { phone: "+91" + rawPhone.slice(-10), action: "verify", code: otp },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPhoneVerifiedLocal(true);
      setVerifyingPhone(false);
      setOtpSent(false);
      setOtp("");
      if (data?.phone) setPhone(data.phone);
      toast.success("Phone number verified!");
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    }
    setVerifyingOtp(false);
  };

  // Get address from current location via Google Maps Geocoding
  const fetchAddressFromLocation = () => {
    setFetchingAddress(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}`
          );
          const data = await res.json();
          if (data.status === "OK" && data.results?.[0]) {
            setAddress(data.results[0].formatted_address);
            toast.success("Address updated from your location!");
          } else {
            toast.error("Could not determine address");
          }
        } catch {
          toast.error("Failed to fetch address");
        }
        setFetchingAddress(false);
      },
      () => {
        toast.error("Location permission denied");
        setFetchingAddress(false);
      },
      { enableHighAccuracy: true }
    );
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader title="My Profile" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <LogIn className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Please log in to view your profile</p>
          <Button asChild><Link to="/auth">Login</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="My Profile" subtitle="View and manage your account" />
      <main className="flex-1 space-y-5 px-4 py-6 max-w-md mx-auto w-full">
        {/* Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <User className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
              <Camera className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </label>
          </div>
          {uploading && <p className="text-xs text-muted-foreground">Uploading...</p>}
          <p className="text-lg font-bold text-foreground">{fullName || "User"}</p>
        </div>

        {/* Verification Status */}
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Verification Status</h3>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.email || "No email"}</p>
            </div>
            {emailVerified ? (
              <div className="flex items-center gap-1 text-primary">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Not verified</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{user.phone || phone || "No phone"}</p>
            </div>
            {phoneVerified ? (
              <div className="flex items-center gap-1 text-primary">
                <CheckCircle className="h-4 w-4" />
                <span className="text-xs font-medium">Verified</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-destructive" />
                {phone && phone.replace(/[^0-9]/g, "").length >= 10 && !verifyingPhone ? (
                  <button
                    onClick={() => setVerifyingPhone(true)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Verify now
                  </button>
                ) : (
                  <span className="text-xs font-medium text-destructive">Not verified</span>
                )}
              </div>
            )}
          </div>

          {/* Phone Verification Flow */}
          {verifyingPhone && !phoneVerified && (
            <div className="mt-3 space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-xs font-semibold text-foreground">Verify Phone Number</p>
              </div>
              {!otpSent ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    We'll send a 6-digit code to <span className="font-medium text-foreground">+91 {phone.replace(/[^0-9]/g, "").slice(-10)}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={sendPhoneOtp} disabled={sendingOtp} className="rounded-lg flex-1">
                      {sendingOtp ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Sending...</> : "Send OTP"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setVerifyingPhone(false)} className="rounded-lg">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Enter the 6-digit code sent to your phone</p>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="rounded-lg text-center text-lg tracking-widest font-mono"
                    maxLength={6}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={verifyPhoneOtp} disabled={verifyingOtp || otp.length !== 6} className="rounded-lg flex-1">
                      {verifyingOtp ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Verifying...</> : "Verify"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={sendPhoneOtp} disabled={sendingOtp} className="rounded-lg">
                      Resend
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Edit Profile */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Edit Profile</h3>
          <div className="space-y-1">
            <Label className="text-sm">Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Phone Number (+91)</Label>
            <div className="flex gap-2">
              <span className="flex items-center rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground">+91</span>
              <Input
                value={phone.replace(/^\+91\s?/, "").replace(/[^0-9]/g, "")}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                  setPhone(val);
                  if (phoneVerifiedLocal) setPhoneVerifiedLocal(false);
                  setOtpSent(false);
                  setVerifyingPhone(false);
                }}
                placeholder="9876543210"
                className="rounded-xl flex-1"
                maxLength={10}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your address" className="rounded-xl" />
            <Button
              variant="outline"
              size="sm"
              onClick={fetchAddressFromLocation}
              disabled={fetchingAddress}
              className="mt-1 rounded-lg text-xs w-full"
            >
              {fetchingAddress ? (
                <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Getting location...</>
              ) : (
                <><MapPin className="mr-1 h-3 w-3" /> Use my current location</>
              )}
            </Button>
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full rounded-xl">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        </div>

        {/* Account Info */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Account Info</h3>
          <p className="text-xs text-muted-foreground">
            Signed in as: {user.email}
          </p>
          <p className="text-xs text-muted-foreground">
            Login provider: {user.app_metadata?.provider || "email"}
          </p>
          <p className="text-xs text-muted-foreground">
            Multiple device login is supported. Your account data syncs across all devices.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Profile;
