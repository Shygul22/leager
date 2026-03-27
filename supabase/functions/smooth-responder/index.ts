import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * Smooth Responder (Paytm POST to GET Bridge)
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

    // Default frontend URL
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
