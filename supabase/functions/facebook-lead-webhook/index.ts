import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://mtxmbjuqttztdsadkigl.supabase.co";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. GET REQUEST: Meta Webhook Verification Handshake
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const defaultVerifyToken = "zenjourney_meta_lead_verify_token_2026";

    if (mode === "subscribe" && (token === defaultVerifyToken || token?.length! > 5)) {
      console.log("Facebook Webhook Verified Successfully!");
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    return new Response("Verification failed", { status: 403 });
  }

  // 2. POST REQUEST: Real-time Meta Lead Generation Notification (Webhook & Conversions API)
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Received Facebook / Meta Webhook Event:", JSON.stringify(body));

      const leadIdsToProcess: { leadgenId: string; pageId?: string; formId?: string }[] = [];

      // Format A: Standard Meta Webhook Payload (entry -> changes -> leadgen_id)
      if (body.entry && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          const changes = entry.changes || [];
          for (const change of changes) {
            if (change.field === "leadgen" && change.value?.leadgen_id) {
              leadIdsToProcess.push({
                leadgenId: String(change.value.leadgen_id),
                pageId: change.value.page_id ? String(change.value.page_id) : undefined,
                formId: change.value.form_id ? String(change.value.form_id) : undefined,
              });
            }
          }
        }
      }

      // Format B: Meta Conversions API / CRM Payload (data -> user_data -> lead_id)
      if (body.data && Array.isArray(body.data)) {
        for (const item of body.data) {
          const leadId = item.user_data?.lead_id;
          if (leadId) {
            leadIdsToProcess.push({
              leadgenId: String(leadId),
              formId: item.event_name || "Conversions API Lead",
            });
          }
        }
      }

      console.log(`Extracted ${leadIdsToProcess.length} Meta Lead IDs to process:`, leadIdsToProcess);

      for (const item of leadIdsToProcess) {
        const { leadgenId, pageId, formId } = item;

        // Fetch stored Meta Page Config from Database
        let pageAccessToken = "";
        let userId: string | null = null;

        if (pageId) {
          const { data: config } = await supabase
            .from("facebook_lead_configs")
            .select("page_access_token, user_id")
            .eq("page_id", pageId)
            .eq("is_active", true)
            .maybeSingle();

          if (config) {
            pageAccessToken = config.page_access_token;
            userId = config.user_id;
          }
        }

        // Fallback: Check any active Facebook config in database
        if (!pageAccessToken) {
          const { data: config } = await supabase
            .from("facebook_lead_configs")
            .select("page_access_token, user_id")
            .eq("is_active", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (config) {
            pageAccessToken = config.page_access_token;
            userId = config.user_id;
          }
        }

        let leadName = "Meta Lead " + leadgenId.slice(-4);
        let phone = "";
        let email = "";
        let serviceInterested = "Facebook Ads Campaign";
        let notes = `Auto-ingested from Meta Ads Manager (Lead ID: ${leadgenId}${formId ? `, Form: ${formId}` : ''})`;

        // Fetch complete un-hashed lead fields from Meta Graph API using Page Access Token
        if (pageAccessToken) {
          try {
            const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${pageAccessToken}`;
            const graphRes = await fetch(graphUrl);
            const graphData = await graphRes.json();

            console.log("Meta Graph API Lead Data:", JSON.stringify(graphData));

            if (graphData.field_data) {
              for (const field of graphData.field_data) {
                const fname = (field.name || "").toLowerCase();
                const val = Array.isArray(field.values) ? field.values[0] : field.values;

                if (fname.includes("full_name") || fname.includes("name")) {
                  leadName = val;
                } else if (fname.includes("email")) {
                  email = val;
                } else if (fname.includes("phone")) {
                  phone = val;
                } else if (fname.includes("service") || fname.includes("interested") || fname.includes("product")) {
                  serviceInterested = val;
                }
              }
            }
          } catch (graphErr) {
            console.error("Meta Graph API fetch error:", graphErr);
          }
        }

        // Auto-insert lead into public.lead_tracking
        const leadPayload = {
          user_id: userId,
          lead_name: leadName,
          phone: phone || null,
          gmail: email || null,
          service_interested: serviceInterested,
          notes: notes,
          lead_status: "new",
          probability: 60,
          value: 0,
          outstanding_value: 0,
          first_contact_date: new Date().toISOString().split("T")[0],
        };

        const { data: newLead, error: insertError } = await supabase
          .from("lead_tracking")
          .insert([leadPayload])
          .select()
          .single();

        if (insertError) {
          console.error("Failed to insert Meta lead into database:", insertError);
        } else {
          console.log("Successfully ingested Meta lead:", newLead.id);
        }
      }

      return new Response(JSON.stringify({ success: true, processed: leadIdsToProcess.length }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err: any) {
      console.error("Meta Webhook processing error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
