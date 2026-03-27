import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

/**
 * Paytm Callback Bridge (POST to GET)
 * 
 * Paytm sends the payment result via a POST request to this function.
 * This function then redirects the user back to the ERP frontend with GET parameters.
 */

serve(async (req) => {
  try {
    // 1. Get the POST data from Paytm
    const contentType = req.headers.get("content-type") || "";
    let params: Record<string, string> = {};

    if (contentType.includes("form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      params = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      // Fallback for other content types
      const text = await req.text();
      const searchParams = new URLSearchParams(text);
      params = Object.fromEntries(searchParams.entries());
    }

    console.log("Paytm Callback Received:", params);

    // 2. Build the redirect URL
    // We try to get the frontend URL from the Referer or use a fallback
    const referer = req.headers.get("referer");
    let baseUrl = "https://tapir-265664.hostingersite.com";
    
    if (referer && referer.includes("hostingersite.com")) {
      const url = new URL(referer);
      baseUrl = url.origin;
    }

    const redirectUrl = new URL("/payment-callback", baseUrl);
    
    // 3. Append all Paytm parameters as GET search params
    for (const [key, value] of Object.entries(params)) {
      redirectUrl.searchParams.set(key, value);
    }

    console.log("Redirecting to:", redirectUrl.toString());

    // 4. Return the redirect response (303 See Other is best for POST-to-GET redirects)
    return Response.redirect(redirectUrl.toString(), 303);

  } catch (error) {
    console.error("Callback Error:", error);
    // Redirect back to home on error
    return Response.redirect("https://tapir-265664.hostingersite.com/payment-callback?STATUS=ERROR", 303);
  }
})
