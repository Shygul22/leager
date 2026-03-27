import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import PaytmChecksum from "npm:paytmchecksum"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("Request Body:", body)
    
    const { quotationId } = body
    if (!quotationId) throw new Error("Quotation ID is required")

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ""
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ""
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch Quotation
    console.log("Fetching Quotation:", quotationId)
    const { data: quo, error: quoErr } = await supabase
      .from('quotations')
      .select('*, quotation_items(*)')
      .eq('id', quotationId)
      .single()

    if (quoErr) {
      console.error("Quotation Fetch Error:", quoErr)
      throw new Error(`Quotation fetch failed: ${quoErr.message}`)
    }
    if (!quo) throw new Error("Quotation not found")

    // 2. Fetch Merchant Profile
    console.log("Fetching Profile for User:", quo.user_id)
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', quo.user_id)
      .single()

    if (profErr) {
      console.error("Profile Fetch Error:", profErr)
      throw new Error(`Profile fetch failed: ${profErr.message}`)
    }
    if (!profile) throw new Error("Merchant profile not found")
    
    if (!profile.paytm_merchant_id || !profile.paytm_merchant_key) {
      console.error("Missing Credentials:", { mid: !!profile.paytm_merchant_id, key: !!profile.paytm_merchant_key })
      throw new Error("Paytm credentials not configured in your profile. Please check Settings.")
    }

    const subtotal = quo.quotation_items?.reduce((s: any, i: any) => s + i.quantity * i.rate, 0) || 0
    const gstTotal = quo.quotation_items?.reduce((s: any, i: any) => s + (i.quantity * i.rate * (i.gst / 100)), 0) || 0
    const amount = (subtotal + gstTotal).toFixed(2)
    console.log("Calculated Amount:", amount)

    // 3. Prepare Hosted Payment Page Params
    const paytmParams: Record<string, string> = {
      "MID": profile.paytm_merchant_id,
      "WEBSITE": profile.paytm_website || "WEBSTAGING",
      "INDUSTRY_TYPE_ID": profile.paytm_industry_type || "Retail",
      "CHANNEL_ID": "WEB",
      "ORDER_ID": quo.quotation_number,
      "CUST_ID": quo.user_id,
      "TXN_AMOUNT": amount,
      "CALLBACK_URL": `https://nwrontqapnhsjhewlwkc.supabase.co/functions/v1/smooth-responder`,
    }
    console.log("Paytm Params (before checksum):", paytmParams)

    // 4. Generate Checksum
    console.log("Generating Checksum...")
    const checksum = await PaytmChecksum.generateSignature(paytmParams, profile.paytm_merchant_key)
    paytmParams["CHECKSUMHASH"] = checksum
    console.log("Checksum Generated successfully")

    return new Response(JSON.stringify({
      params: paytmParams,
      url: profile.paytm_website === "WEBSTAGING" ? "https://securegw-stage.paytm.in/order/process" : "https://securegw.paytm.in/order/process"
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Global Function Error:", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
