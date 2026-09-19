// ============================================================================
// ZENJOURNEY ERP - CASHFREE PAYMENT GATEWAY INTEGRATION SERVICE
// Handles online invoice settlements via UPI, Cards, NetBanking & Wallets
// ============================================================================

export const CASHFREE_APP_ID = import.meta.env.VITE_CASHFREE_APP_ID || "";
export const CASHFREE_SECRET_KEY = import.meta.env.VITE_CASHFREE_SECRET_KEY || "";
export const CASHFREE_ENV = (import.meta.env.VITE_CASHFREE_ENV || "production") as "production" | "sandbox";

export interface CashfreeOrderParams {
  orderId: string;
  orderAmount: number;
  orderCurrency?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  invoiceId?: string;
  returnUrl?: string;
}

/**
 * Dynamically loads the official Cashfree JS SDK v3
 */
export async function loadCashfreeSDK(): Promise<any> {
  if (typeof window === "undefined") return null;

  if ((window as any).Cashfree) {
    return (window as any).Cashfree({ mode: CASHFREE_ENV });
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById("cashfree-js-sdk");
    if (existingScript) {
      existingScript.onload = () => {
        resolve((window as any).Cashfree({ mode: CASHFREE_ENV }));
      };
      return;
    }

    const script = document.createElement("script");
    script.id = "cashfree-js-sdk";
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.async = true;
    script.onload = () => {
      try {
        const cashfree = (window as any).Cashfree({ mode: CASHFREE_ENV });
        resolve(cashfree);
      } catch (e) {
        reject(e);
      }
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

/**
 * Initiates an order with Cashfree via secure serverless endpoint
 */
export async function createCashfreeOrderSession(params: CashfreeOrderParams): Promise<{
  paymentSessionId: string;
  orderId: string;
}> {
  const payload = {
    orderId: params.orderId,
    orderAmount: Number(params.orderAmount.toFixed(2)),
    orderCurrency: params.orderCurrency || "INR",
    customerName: params.customerName || "Customer",
    customerEmail: params.customerEmail || "billing@zenjourney.in",
    customerPhone: params.customerPhone || "9876543210",
    invoiceId: params.invoiceId,
    returnUrl: params.returnUrl || `${window.location.origin}/public/invoice/${params.invoiceId}?order_id={order_id}`
  };

  // 1. Try Vercel Serverless API (/api/create-cashfree-order)
  try {
    const res = await fetch("/api/create-cashfree-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      if (data.paymentSessionId) {
        return {
          paymentSessionId: data.paymentSessionId,
          orderId: data.orderId || params.orderId
        };
      }
    } else {
      const errData = await res.json().catch(() => ({}));
      console.warn("Vercel /api/create-cashfree-order responded with:", errData);
      if (errData.error) {
        throw new Error(errData.error);
      }
    }
  } catch (apiErr: any) {
    console.warn("Primary API route error, trying Edge Function fallback:", apiErr);
    // If it was an explicit Cashfree error, rethrow it
    if (apiErr.message && !apiErr.message.includes("fetch")) {
      throw apiErr;
    }
  }

  // 2. Try Supabase Edge Function fallback
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mtxmbjuqttztdsadkigl.supabase.co";
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  try {
    const edgeRes = await fetch(`${supabaseUrl}/functions/v1/create-cashfree-order`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "apikey": supabaseAnonKey
      },
      body: JSON.stringify(payload)
    });

    if (edgeRes.ok) {
      const data = await edgeRes.json();
      if (data.paymentSessionId) {
        return {
          paymentSessionId: data.paymentSessionId,
          orderId: data.orderId || params.orderId
        };
      }
    }
  } catch (edgeErr) {
    console.warn("Supabase edge function error:", edgeErr);
  }

  throw new Error("Unable to establish Cashfree payment session. Please verify payment configuration.");
}

/**
 * Triggers Cashfree Drop-in / Hosted Checkout
 */
export async function launchCashfreeCheckout({
  paymentSessionId,
  onSuccess,
  onFailure
}: {
  paymentSessionId: string;
  onSuccess?: (data: any) => void;
  onFailure?: (data: any) => void;
}) {
  try {
    const cashfree = await loadCashfreeSDK();
    if (cashfree && paymentSessionId) {
      cashfree.checkout({
        paymentSessionId,
        redirectTarget: "_modal"
      }).then((result: any) => {
        if (result.error) {
          if (onFailure) onFailure(result.error);
        }
        if (result.paymentDetails) {
          if (onSuccess) onSuccess(result.paymentDetails);
        }
      });
    }
  } catch (e) {
    console.error("Failed to launch Cashfree checkout:", e);
    if (onFailure) onFailure(e);
  }
}
