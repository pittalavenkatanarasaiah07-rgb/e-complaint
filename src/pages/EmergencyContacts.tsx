import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, Phone, LogIn, Contact } from "lucide-react";

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string | null;
}

const EmergencyContacts = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("");

  useEffect(() => {
    if (user) fetchContacts();
    else setLoading(false);
  }, [user]);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    if (!error && data) setContacts(data);
    setLoading(false);
  };

  const addContact = async () => {
    if (!user) return;
    if (!name.trim() || !phone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    const { error } = await supabase.from("emergency_contacts").insert({
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim(),
      relationship: relationship.trim() || null,
    });
    if (error) {
      toast.error("Failed to add contact");
      return;
    }
    toast.success("Contact added!");
    setName("");
    setPhone("");
    setRelationship("");
    setAdding(false);
    fetchContacts();
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from("emergency_contacts").delete().eq("id", id);
    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success("Contact removed");
    }
  };

  const pickFromDevice = async () => {
    try {
      if ("contacts" in navigator && "ContactsManager" in window) {
        const props = ["name", "tel"];
        const opts = { multiple: false };
        const deviceContacts = await (navigator as any).contacts.select(props, opts);
        if (deviceContacts && deviceContacts.length > 0) {
          const c = deviceContacts[0];
          setName(c.name?.[0] || "");
          setPhone(c.tel?.[0] || "");
          setAdding(true);
          return;
        }
      }
      toast.info("Contact picker not supported on this device. Please enter manually.");
      setAdding(true);
    } catch (e) {
      toast.info("Could not access contacts. Please enter manually.");
      setAdding(true);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <PageHeader title="Emergency Contacts" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4">
          <LogIn className="h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Please log in to manage emergency contacts</p>
          <Button asChild><Link to="/auth">Login</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PageHeader title="Emergency Contacts" subtitle="Contacts notified when SOS is activated" />
      <main className="flex-1 space-y-4 px-4 py-6">
        <div className="flex gap-2">
          <Button onClick={pickFromDevice} variant="outline" className="flex-1 rounded-xl">
            <Contact className="mr-2 h-4 w-4" /> From Device
          </Button>
          <Button onClick={() => setAdding(true)} variant="outline" className="flex-1 rounded-xl">
            <Plus className="mr-2 h-4 w-4" /> Add Manually
          </Button>
        </div>

        {adding && (
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact name" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Phone (+91)</Label>
              <div className="flex gap-2">
                <span className="flex items-center rounded-xl border border-input bg-muted px-3 text-sm text-muted-foreground">+91</span>
                <Input
                  value={phone.replace(/^\+91\s?/, "")}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                    setPhone("+91 " + val);
                  }}
                  placeholder="9876543210"
                  className="rounded-xl flex-1"
                  maxLength={10}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Relationship (optional)</Label>
              <Input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. Mother, Friend" className="rounded-xl" />
            </div>
            <div className="flex gap-2">
              <Button onClick={addContact} className="flex-1 rounded-xl"><UserPlus className="mr-2 h-4 w-4" /> Save</Button>
              <Button onClick={() => { setAdding(false); setName(""); setPhone(""); setRelationship(""); }} variant="ghost" className="rounded-xl">Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-center text-sm text-muted-foreground py-8">Loading contacts...</p>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Phone className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">No emergency contacts yet.<br />Add contacts to be notified when you activate SOS.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.phone}{c.relationship ? ` · ${c.relationship}` : ""}</p>
                </div>
                <button onClick={() => deleteContact(c.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center pt-2">
              These contacts will receive an SMS with your live location when SOS is activated.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default EmergencyContacts;
