import { serve } from 'https://deno.land/std@0.177.1/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Verify Vital Signature (Normally via Svix, mocked for MVP scaffold)
    const signature = req.headers.get('svix-signature');
    if (!signature) {
      console.warn('Warning: Missing svix-signature header');
    }

    const body = await req.json();
    const { event_type, data } = body;

    console.log(`Received Vital webhook [${event_type}] for vital_user_id: ${data.user_id}`);

    // 2. Initialize Service Role Supabase Client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 3. Process the Event
    if (event_type === 'daily.data.created' || event_type === 'daily.data.updated') {
      console.log('Processing daily data:', data.date);
      // Data Normalization and DB Upsert logic goes here...
      // e.g. Mapping Vital's `data.user_id` -> our `auth.users.id`
    } else if (event_type === 'workout.created') {
      console.log('Processing new workout from wearable:', data.title);
      // e.g. Inserting a new workout record
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Vital Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
