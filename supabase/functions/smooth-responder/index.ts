import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Smooth Responder (Paytm POST to GET Bridge with DB Update)
 */

serve(async (req) => {
  try {
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      params = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      const text = await req.text();
      const searchParams = new URLSearchParams(text);
      params = Object.fromEntries(searchParams.entries());
    }

    console.log("Paytm Callback Received:", params);

    // 1. Update Database if Success
    if (params.STATUS === "TXN_SUCCESS" && params.ORDERID) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data, error } = await supabase
        .from("quotations")
        .update({ status: "accepted", is_paid: true })
        .eq("quotation_number", params.ORDERID);

      if (error) {
        console.error("Error updating quotation status:", error);
      } else {
        console.log("Quotation status updated successfully for:", params.ORDERID);
      }
    }

    // 2. Redirect to Frontend
    const baseUrl = "https://tapir-265664.hostingersite.com";
    const redirectUrl = new URL("/payment-callback", baseUrl);
    
    for (const [key, value] of Object.entries(params)) {
      redirectUrl.searchParams.set(key, value);
    }

    console.log("Redirecting to:", redirectUrl.toString());

    return Response.redirect(redirectUrl.toString(), 303);

  } catch (error) {
    console.error("Callback Error:", error);
    return Response.redirect("https://tapir-265664.hostingersite.com/payment-callback?STATUS=ERROR", 303);
  }
})
