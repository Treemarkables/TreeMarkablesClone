import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import SignatureCanvas from "react-signature-canvas";
import { apiRequest } from "@/lib/queryClient";

export default function SignatureCapture() {
  const [isSaving, setIsSaving] = useState(false);
  const signatureRef = useRef<SignatureCanvas>(null);
  const { toast } = useToast();

  const handleClear = () => {
    signatureRef.current?.clear();
  };

  const handleApplySignature = async () => {
    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      toast({
        title: "Signature Required",
        description: "Please draw your signature before applying",
        variant: "destructive"
      });
      return;
    }

    const signatureData = signatureRef.current.toDataURL();

    setIsSaving(true);
    try {
      const data = await apiRequest('/api/vehicle-inspections/apply-signature', {
        method: 'POST',
        body: JSON.stringify({ signature: signatureData })
      });

      if (data.success) {
        // Clear signature after successful application
        signatureRef.current?.clear();
      } else {
        throw new Error(data.message || 'Failed to apply signature');
      }
    } catch (error) {
      console.error('Error applying signature:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to apply signature. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Apply Signature to Backdated Inspections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Draw your signature below and click "Apply to All Inspections" to update all backdated pre-start inspections.
          </p>

          <div className="border-2 border-dashed rounded-lg p-4 bg-white">
            <SignatureCanvas
              ref={signatureRef}
              canvasProps={{
                className: "w-full h-48 border rounded",
                style: { touchAction: 'none' }
              }}
              backgroundColor="white"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={isSaving}
              data-testid="button-clear-signature"
            >
              Clear
            </Button>
            <Button
              onClick={handleApplySignature}
              disabled={isSaving}
              data-testid="button-apply-signature"
            >
              {isSaving ? "Applying..." : "Apply to All Inspections"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
