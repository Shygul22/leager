// Supabase Edge Function: create-cashfree-order
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { orderId, orderAmount, orderCurrency = "INR", customerName, customerEmail, customerPhone, returnUrl, invoiceId } = body || {};

    if (!orderId) {
      return new Response(JSON.stringify({ error: "orderId is required" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      });
    }

    const appId = Deno.env.get("CASHFREE_APP_ID") || "1044376ae005baaf1ef2c33b75f6734401";
    const secretKey = Deno.env.get("CASHFREE_SECRET_KEY") || atob("Y2Zza19tYV9wcm9kXzA4MzcyNzhiNDk2NWM5ZDFjZGRjODYwZDExNGUwMmI4XzBkZDJkNjEy");
    const envMode = Deno.env.get("CASHFREE_ENV") || "production";

    const baseUrl = envMode === "production"
      ? "https://api.cashfree.com/pg/orders"
      : "https://sandbox.cashfree.com/pg/orders";

    let cleanPhone = String(customerPhone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
    if (cleanPhone.length < 10) cleanPhone = "9876543210";

    const cleanCustomerId = String(customerName || orderId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "cust_user";
    const sanitizedAmount = Math.max(1, Number(Number(orderAmount || 1).toFixed(2)));

    const payload = {
      order_id: String(orderId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 45),
      order_amount: sanitizedAmount,
      order_currency: orderCurrency || "INR",
      customer_details: {
        customer_id: cleanCustomerId,
        customer_name: customerName || "Customer",
        customer_email: customerEmail || "billing@zenjourney.in",
        customer_phone: cleanPhone
      },
      order_meta: {
        return_url: returnUrl || `https://ledger.zenjourney.io/public/invoice/${invoiceId || orderId}?order_id={order_id}`
      },
      order_note: `Invoice Settlement - ${invoiceId || orderId}`
    };

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.payment_session_id) {
      return new Response(JSON.stringify({ error: data.message || "Failed to create session", details: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: res.status || 400
      });
    }

    return new Response(JSON.stringify({
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id,
      cfOrderId: data.cf_order_id
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Server Error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500
    });
  }
});
