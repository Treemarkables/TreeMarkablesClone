import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";

// Landing page shown after a Stripe Checkout opened from the staff "Take
// payment" flow on the job card. The payment itself is confirmed server-side by
// the webhook — this page just reassures the person holding the device.
export default function PaymentComplete() {
  const status =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("status")
      : null;
  const ok = status === "success";

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          {ok ? (
            <>
              <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Payment received
              </h1>
              <p className="text-gray-600">
                Thank you — your payment has been processed. You can close this
                window.
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Payment cancelled
              </h1>
              <p className="text-gray-600">
                No payment was taken. You can close this window.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
