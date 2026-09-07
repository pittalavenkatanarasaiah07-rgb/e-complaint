import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const TWILIO_SENDER = "+15717280228";

const isValidSmsPhone = (phone: string) => {
  const compact = (phone || "").replace(/\s/g, "");
  if (compact.startsWith("+91")) return /^\+91[6-9]\d{9}$/.test(compact);
  return /^\+[1-9]\d{7,14}$/.test(compact);
};

const BodySchema = z.object({
  to: z.string().min(8).max(20),
  message: z.string().min(1).max(500),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) return json({ error: "Invalid token" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);

    const to = parsed.data.to.replace(/\s/g, "");
    if (!isValidSmsPhone(to)) {
      return json({ success: false, message: "Enter the number with country code, e.g. +919876543210" });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY_1");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      console.error("Twilio credentials missing");
      return json({ success: false, message: "Twilio SMS service not configured" });
    }
    const twilioHeaders = {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const resp = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: twilioHeaders,
      body: new URLSearchParams({ To: to, From: TWILIO_SENDER, Body: parsed.data.message }),
    });
    const responseText = await resp.text();
    let data: Record<string, unknown> = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      data = { message: responseText };
    }
    if (!resp.ok) {
      console.error(`SMS to ${to} failed [${resp.status}]:`, JSON.stringify(data));
      return json({
        success: false,
       message: typeof data.message === "string" ? data.message : "Twilio rejected the message",
      });
    }
    return json({ success: true, message: `Message sent to ${to}`, id: data.id });
  } catch (e) {
    console.error("send-sms error:", e);
    return json({ error: "Internal error" }, 500);
  }
});
