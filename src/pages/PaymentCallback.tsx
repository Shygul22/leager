import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const status = (searchParams.get("STATUS") || searchParams.get("status") || "").toUpperCase();
  const orderId = searchParams.get("ORDERID") || searchParams.get("orderId");
  const respMsg = searchParams.get("RESPMSG") || searchParams.get("respmsg");

  useEffect(() => {
    // You could verify the transaction here with your backend if you had one
    console.log("Payment Callback Params:", Object.fromEntries(searchParams));
  }, [searchParams]);

  const isSuccess = status === "TXN_SUCCESS";
  const isPending = !status;

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Payment Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {isPending ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <p className="text-muted-foreground">Verifying payment with Paytm...</p>
            </div>
          ) : isSuccess ? (
            <div className="flex flex-col items-center gap-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Payment Successful!</h3>
                <p className="text-muted-foreground text-sm font-mono">Order: {orderId}</p>
              </div>
              <p className="text-sm px-4">Your quotation has been updated. Thank you for the payment.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-8">
              <XCircle className="h-16 w-16 text-destructive" />
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Payment Failed</h3>
                <p className="text-muted-foreground text-sm font-mono">Order: {orderId}</p>
                {respMsg && <p className="text-xs text-destructive/80 mt-2 italic">"{respMsg}"</p>}
              </div>
              <p className="text-sm px-4">Something went wrong with the transaction. Please try again or contact support.</p>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/quotations")} className="w-full">
              Return to Quotations
            </Button>
            <Button variant="outline" onClick={() => navigate("/")} className="w-full">
              Go to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
