import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const TWILIO_FROM_NUMBER = "+15717280228";

const normalizePhone = (phone: string) => (phone || "").replace(/\D/g, "");

const isValidSmsPhone = (phone: string) => {
  const compact = (phone || "").replace(/\s/g, "");
  if (compact.startsWith("+91")) return /^\+91[6-9]\d{9}$/.test(compact);
  return /^\+[1-9]\d{7,14}$/.test(compact);
};

const getSmsSenderNumber = async (lovableApiKey: string, twilioApiKey: string) => {
  const resp = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json?PageSize=20`, {
    headers: {
      "Authorization": `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": twilioApiKey,
    },
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Twilio phone number lookup failed [${resp.status}]: ${JSON.stringify(data)}`);
  }

  const numbers = Array.isArray(data?.incoming_phone_numbers) ? data.incoming_phone_numbers : [];
  const requested = numbers.find((n) => n?.phone_number === TWILIO_FROM_NUMBER && n?.capabilities?.sms);
  const smsCapable = requested || numbers.find((n) => n?.capabilities?.sms);
  return smsCapable?.phone_number as string | undefined;
};

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

    let fromNumber = TWILIO_FROM_NUMBER;
    try {
      const accountSmsNumber = await getSmsSenderNumber(LOVABLE_API_KEY, TWILIO_API_KEY);
      if (!accountSmsNumber) {
        return new Response(JSON.stringify({
          success: false,
          message: "No SMS-capable Twilio phone number found on the connected account",
          notified: 0,
          total: contacts.length,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fromNumber = accountSmsNumber;
      if (fromNumber !== TWILIO_FROM_NUMBER) {
        console.warn(`Configured Twilio From number ${TWILIO_FROM_NUMBER} is not available on this account. Using ${fromNumber}.`);
      }
    } catch (e) {
      console.error("Failed to resolve Twilio sender number:", e);
      return new Response(JSON.stringify({
        success: false,
        message: "Could not verify Twilio sender number",
        notified: 0,
        total: contacts.length,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Detect Twilio trial status + verified caller IDs
    let isTrial = false;
    const verifiedSet = new Set<string>();
    const normalize = (p: string) => normalizePhone(p).slice(-10);
    try {
      const acctResp = await fetch(`${GATEWAY_URL}/.json`, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      });
      const acctData = await acctResp.json();
      if (acctResp.ok && typeof acctData?.type === "string") {
        isTrial = acctData.type.toLowerCase() === "trial";
      }
    } catch (e) {
      console.error("Failed to fetch Twilio account info:", e);
    }
    try {
      const vResp = await fetch(`${GATEWAY_URL}/OutgoingCallerIds.json?PageSize=100`, {
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": TWILIO_API_KEY,
        },
      });
      const vData = await vResp.json();
      if (vResp.ok && Array.isArray(vData?.outgoing_caller_ids)) {
        for (const c of vData.outgoing_caller_ids) {
          if (c?.phone_number) verifiedSet.add(normalize(c.phone_number));
        }
      }
    } catch (e) {
      console.error("Failed to fetch Twilio verified caller IDs:", e);
    }

    const unverifiedContacts = isTrial
      ? contacts
          .filter((c) => !verifiedSet.has(normalize(c.phone)))
          .map((c) => ({ name: c.name, phone: c.phone }))
      : [];

    const results: { name: string; phone: string; sent: boolean; errorCode?: number; errorMessage?: string }[] = [];

    for (const contact of contacts) {
      const toNumber = (contact.phone || "").replace(/\s/g, "");
      if (!isValidSmsPhone(toNumber)) {
        results.push({
          name: contact.name,
          phone: contact.phone,
          sent: false,
          errorMessage: "Invalid phone number. Use country code plus the full phone number, for example +919876543210.",
        });
        continue;
      }

      try {
        const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: toNumber,
            From: fromNumber,
            Body: smsBody,
          }),
        });
        const data = await resp.json();
        results.push({
          name: contact.name,
          phone: contact.phone,
          sent: resp.ok,
          errorCode: resp.ok ? undefined : data?.code,
          errorMessage: resp.ok ? undefined : data?.message,
        });
        if (!resp.ok) {
          console.error(`SMS to ${contact.phone} failed [${resp.status}]:`, JSON.stringify(data));
        }
      } catch (e) {
        console.error(`SMS to ${contact.phone} error:`, e);
        results.push({ name: contact.name, phone: contact.phone, sent: false });
      }
    }

    const notified = results.filter(r => r.sent).length;
    const trialErrorContacts = results
      .filter((r) => r.errorCode === 21608)
      .map((r) => ({ name: r.name, phone: r.phone }));
    const allUnverifiedContacts = [...unverifiedContacts, ...trialErrorContacts].filter(
      (contact, index, arr) => arr.findIndex((c) => normalizePhone(c.phone) === normalizePhone(contact.phone)) === index,
    );

    return new Response(JSON.stringify({
      success: true,
      message: `SOS alerts sent to ${notified}/${contacts.length} contacts`,
      notified,
      total: contacts.length,
      results,
      isTrial: isTrial || trialErrorContacts.length > 0,
      unverifiedContacts: allUnverifiedContacts,
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
