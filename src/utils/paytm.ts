import { supabase } from "@/integrations/supabase/client";

export const initiatePaytmPayment = async (quotationId: string) => {
  const { data, error } = await supabase.functions.invoke('initiate-paytm-payment', {
    body: { quotationId }
  });

  if (error) throw error;
  return data;
};

export const getPaytmEmailBody = (clientName: string, orderId: string, amount: number, currency: string, paymentLink: string) => {
  return `Dear ${clientName},

Please find the quotation ${orderId} for your review.

Total Amount: ${currency} ${amount.toFixed(2)}

You can review the details and proceed with the payment using the link below:
${paymentLink}

Regards,
Accounting Team`;
};
