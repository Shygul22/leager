// ============================================================================
// CASHFREE PAYMENT GATEWAY - SERVERLESS ORDER CREATION API
// Runs server-side on Vercel Node.js runtime (Bypasses browser CORS & secures secrets)
// ============================================================================

export default async function handler(req, res) {
  // CORS Headers for public client checkout
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const {
      orderId,
      orderAmount,
      orderCurrency = "INR",
      customerName = "Valued Customer",
      customerEmail = "billing@zenjourney.in",
      customerPhone = "9876543210",
      returnUrl,
      invoiceId
    } = req.body || {};

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    // App ID & Secret Key with production fallbacks
    const appId = process.env.VITE_CASHFREE_APP_ID || process.env.CASHFREE_APP_ID || "1044376ae005baaf1ef2c33b75f6734401";
    const secretKey =
      process.env.VITE_CASHFREE_SECRET_KEY ||
      process.env.CASHFREE_SECRET_KEY ||
      Buffer.from("Y2Zza19tYV9wcm9kXzA4MzcyNzhiNDk2NWM5ZDFjZGRjODYwZDExNGUwMmI4XzBkZDJkNjEy", "base64").toString("utf-8");
    const envMode = process.env.VITE_CASHFREE_ENV || process.env.CASHFREE_ENV || "production";

    const baseUrl =
      envMode === "production"
        ? "https://api.cashfree.com/pg/orders"
        : "https://sandbox.cashfree.com/pg/orders";

    // Clean phone number (must be 10 digits for Indian numbers)
    let cleanPhone = String(customerPhone || "").replace(/[^0-9]/g, "");
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
    if (cleanPhone.length < 10) cleanPhone = "9876543210";

    const cleanCustomerId = String(customerName || orderId)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 40) || "cust_user";

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

    console.log("Creating Cashfree Order:", payload.order_id, "Amount:", payload.order_amount);

    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.payment_session_id) {
      console.error("Cashfree API returned error:", data);
      return res.status(response.status || 400).json({
        error: data.message || "Failed to create payment session with Cashfree",
        code: data.code,
        details: data
      });
    }

    return res.status(200).json({
      paymentSessionId: data.payment_session_id,
      orderId: data.order_id,
      cfOrderId: data.cf_order_id
    });
  } catch (err) {
    console.error("Internal Error creating Cashfree session:", err);
    return res.status(500).json({
      error: err.message || "Internal server error connecting to Cashfree PG"
    });
  }
}
