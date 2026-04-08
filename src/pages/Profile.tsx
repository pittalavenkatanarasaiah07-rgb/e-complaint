import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { User, Mail, Phone, CheckCircle, XCircle, Camera, LogIn, Save } from "lucide-react";

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

  const emailVerified = !!user?.email_confirmed_at;
  const phoneVerified = !!user?.phone_confirmed_at;

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
      setPhone(data.phone || "");
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
              <div className="flex items-center gap-1 text-green-600">
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
        </div>

        {/* Edit Profile */}
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Edit Profile</h3>
          <div className="space-y-1">
            <Label className="text-sm">Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Your address" className="rounded-xl" />
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
