import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/** Sends an SMS to any number the user types, through the app's messaging service. */
const SendSmsCard = () => {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("Your person is in trouble.");
  const [sending, setSending] = useState(false);

  const normalized = (value: string) => {
    const compact = value.replace(/[^\d+]/g, "");
    if (compact.startsWith("+")) return compact;
    const digits = compact.replace(/\D/g, "");
    return digits.length === 10 ? `+91${digits}` : `+${digits}`;
  };

  const send = async () => {
    const to = normalized(phone);
    if (!/^\+[1-9]\d{7,14}$/.test(to)) {
      toast.error("Enter a valid number with country code, e.g. +919876543210");
      return;
    }
    if (!message.trim()) {
      toast.error("Type a message to send");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-sms", {
      body: { to, message: message.trim() },
    });
    setSending(false);
    if (error) {
      toast.error("Could not send the message. Please try again.");
      return;
    }
    if (data?.success) {
      toast.success(data.message || `Message sent to ${to}`);
      setPhone("");
      return;
    }
    toast.error(data?.message || "Message could not be sent");
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} variant="outline" className="w-full rounded-xl">
        <MessageSquare className="mr-2 h-4 w-4" /> Send SMS to any number
      </Button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <MessageSquare className="h-4 w-4 text-primary" /> Send SMS to any number
      </h2>
      <div className="space-y-1">
        <Label className="text-sm font-medium">Phone number</Label>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          placeholder="+91 98765 43210"
          className="rounded-xl"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-sm font-medium">Message</Label>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          maxLength={500}
          className="rounded-xl"
        />
      </div>
      <div className="flex gap-2">
        <Button onClick={send} disabled={sending} className="flex-1 rounded-xl">
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {sending ? "Sending…" : "Send message"}
        </Button>
        <Button onClick={() => setOpen(false)} variant="ghost" className="rounded-xl">Close</Button>
      </div>
    </div>
  );
};

export default SendSmsCard;
