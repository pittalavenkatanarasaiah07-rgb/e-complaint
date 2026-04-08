import { corsHeaders } from '@supabase/supabase-js/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { z } from 'https://esm.sh/zod@3.25.76';

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/twilio';

const BodySchema = z.object({
  phone: z.string().min(10).max(15),
  action: z.enum(['send', 'verify']),
  code: z.string().length(6).optional(),
});

// Simple in-memory OTP store (edge functions are short-lived, so we use Supabase for persistence)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const TWILIO_API_KEY = Deno.env.get('TWILIO_API_KEY');
    if (!TWILIO_API_KEY) throw new Error('TWILIO_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { phone, action, code } = parsed.data;
    const formattedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\s/g, '')}`;

    if (action === 'send') {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // Store OTP in profile phone field temporarily with prefix
      await supabase.from('profiles').upsert({
        user_id: user.id,
        phone: `OTP:${otp}:${formattedPhone}`,
      }, { onConflict: 'user_id' });

      // Get a Twilio phone number
      const numbersRes = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json?PageSize=1`, {
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
        },
      });
      const numbersData = await numbersRes.json();
      const fromNumber = numbersData?.incoming_phone_numbers?.[0]?.phone_number;
      if (!fromNumber) throw new Error('No Twilio phone number available');

      // Send SMS
      const smsRes = await fetch(`${GATEWAY_URL}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'X-Connection-Api-Key': TWILIO_API_KEY,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedPhone,
          From: fromNumber,
          Body: `Your SafeGuard verification code is: ${otp}. Valid for 10 minutes.`,
        }),
      });

      if (!smsRes.ok) {
        const errData = await smsRes.json();
        throw new Error(`SMS failed [${smsRes.status}]: ${JSON.stringify(errData)}`);
      }

      return new Response(JSON.stringify({ success: true, message: 'OTP sent' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify') {
      if (!code) {
        return new Response(JSON.stringify({ error: 'Code required' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Retrieve stored OTP
      const { data: profile } = await supabase
        .from('profiles')
        .select('phone')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.phone?.startsWith('OTP:')) {
        return new Response(JSON.stringify({ error: 'No pending verification' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const parts = profile.phone.split(':');
      const storedOtp = parts[1];
      const storedPhone = parts[2];

      if (code !== storedOtp) {
        return new Response(JSON.stringify({ error: 'Invalid code' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Update phone to verified number
      await supabase.from('profiles').update({ phone: storedPhone }).eq('user_id', user.id);

      // Update auth user phone
      await supabase.auth.admin.updateUserById(user.id, {
        phone: storedPhone,
        phone_confirm: true,
      });

      return new Response(JSON.stringify({ success: true, message: 'Phone verified', phone: storedPhone }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Phone OTP error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
