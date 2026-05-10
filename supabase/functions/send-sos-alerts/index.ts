import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const TWILIO_FROM_NUMBER = "+15717280228";

const BodySchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { latitude, longitude } = parsed.data;

    // Fetch emergency contacts
    const { data: contacts, error: contactsError } = await supabase
      .from("emergency_contacts")
      .select("*")
      .eq("user_id", user.id);

    if (contactsError || !contacts || contacts.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: "No emergency contacts found. Add contacts in Emergency Contacts page.",
        notified: 0,
        total: 0,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const smsBody = `Your person is in trouble.\nLocation: ${mapsLink}`;

    // Check for Twilio gateway credentials
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY is not configured");
      return new Response(JSON.stringify({
        success: false,
        message: "SMS service not configured",
        notified: 0,
        total: contacts.length,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    if (!TWILIO_API_KEY) {
      console.error("TWILIO_API_KEY is not configured");
      return new Response(JSON.stringify({
        success: false,
        message: "SMS service not configured",
        notified: 0,
        total: contacts.length,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromNumber = TWILIO_FROM_NUMBER;

    const results: { name: string; phone: string; sent: boolean }[] = [];

    for (const contact of contacts) {
      try {
        const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: contact.phone,
            From: fromNumber,
            Body: smsBody,
          }),
        });
        const data = await resp.json();
        results.push({ name: contact.name, phone: contact.phone, sent: resp.ok });
        if (!resp.ok) {
          console.error(`SMS to ${contact.phone} failed [${resp.status}]:`, JSON.stringify(data));
        }
      } catch (e) {
        console.error(`SMS to ${contact.phone} error:`, e);
        results.push({ name: contact.name, phone: contact.phone, sent: false });
      }
    }

    const notified = results.filter(r => r.sent).length;

    return new Response(JSON.stringify({
      success: true,
      message: `SOS alerts sent to ${notified}/${contacts.length} contacts`,
      notified,
      total: contacts.length,
      results,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("SOS alert error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
