/**
 * Paytm Payment Link Utility
 * 
 * Note: For production, checksum generation MUST be done on a secure backend.
 * This utility provides a way to construct the payment parameters for the frontend.
 */

export interface PaytmConfig {
  merchantId: string;
  merchantKey: string;
  website: string;
  industryType: string;
}

export const generatePaytmLink = (
  config: PaytmConfig,
  orderId: string,
  customerId: string,
  amount: number,
  isStaging: boolean = true
) => {
  const baseUrl = isStaging 
    ? "https://securegw-stage.paytm.in/order/sendpaymentrequest" 
    : "https://securegw.paytm.in/order/process";

  // In a real app, you would call your backend here to get a txnToken or checksum
  // For this demonstration, we'll return a mailto link with the payment details 
  // or a placeholder URL if a hosted link was available.
  
  // Since we are in a static/client-side context without a secure backend, 
  // we'll provide a helper to generate the parameters that WOULD be sent.
  
  const params = {
    MID: config.merchantId,
    WEBSITE: config.website,
    INDUSTRY_TYPE_ID: config.industryType,
    CHANNEL_ID: "WEB",
    ORDER_ID: orderId,
    CUST_ID: customerId,
    TXN_AMOUNT: amount.toString(),
    CALLBACK_URL: window.location.origin + "/payment-callback",
  };

  // Convert to query string for demonstration (Paytm usually expects a POST form)
  const queryString = new URLSearchParams(params).toString();
  return `${baseUrl}?${queryString}`;
};

export const getPaytmEmailBody = (
  clientName: string,
  quotationNumber: string,
  amount: number,
  currency: string,
  paymentLink: string
) => {
  return `Dear ${clientName},

Please find the quotation ${quotationNumber} for your review.

Total Amount: ${currency} ${amount.toFixed(2)}

You can make the payment using the link below:
${paymentLink}

Regards,
Accounting Team`;
};
