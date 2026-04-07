import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!);
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
        notified: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const userName = user.user_metadata?.full_name || user.email || "Someone";
    const message = `🚨 SOS EMERGENCY ALERT!\n\n${userName} has activated an emergency SOS alert and needs help!\n\nLive Location: ${mapsLink}\n\nPlease contact them immediately or call emergency services (100 - Police, 108 - Ambulance).`;

    // Check if Twilio is configured
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: { name: string; phone: string; sent: boolean; method: string }[] = [];

    if (twilioSid && twilioToken && twilioFrom) {
      // Send via Twilio
      for (const contact of contacts) {
        try {
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
          const resp = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": "Basic " + btoa(`${twilioSid}:${twilioToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: contact.phone,
              From: twilioFrom,
              Body: message,
            }),
          });
          results.push({ name: contact.name, phone: contact.phone, sent: resp.ok, method: "sms" });
        } catch (e) {
          results.push({ name: contact.name, phone: contact.phone, sent: false, method: "sms" });
        }
      }
    } else {
      // No SMS provider configured - log the alert
      for (const contact of contacts) {
        console.log(`[SOS ALERT] Would send SMS to ${contact.name} (${contact.phone}): ${message}`);
        results.push({ name: contact.name, phone: contact.phone, sent: false, method: "no_sms_provider" });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: twilioSid ? "SOS alerts sent via SMS" : "SOS alert recorded. Configure SMS provider for real notifications.",
      notified: results.filter(r => r.sent).length,
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
