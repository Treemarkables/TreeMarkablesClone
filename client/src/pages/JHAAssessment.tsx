import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SignaturePad from "@/components/SignaturePad";

const jhaFormSchema = z.object({
  jobId: z.number().nullable(),
  steps: z.array(z.object({
    hazardTemplateId: z.number(),
    riskRating: z.number().min(1).max(5),
    controlMeasureIds: z.array(z.number())
  }))
});

type JHAFormValues = z.infer<typeof jhaFormSchema>;

export default function JHAAssessment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [signatures, setSignatures] = useState<{ name: string; signature: string }[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signerName, setSignerName] = useState("");

  // Fetch hazard templates
  const { data: templatesData, isLoading: templatesLoading } = useQuery<{ 
    success: boolean; 
    data: Array<{
      id: number;
      name: string;
      description: string | null;
      defaultRiskRating: number;
      controlMeasures: Array<{
        id: number;
        hazardTemplateId: number;
        description: string;
        displayOrder: number;
      }>;
    }>;
  }>({
    queryKey: ['/api/jha/hazard-templates'],
  });

  const hazardTemplates = templatesData?.data || [];

  const form = useForm<JHAFormValues>({
    resolver: zodResolver(jhaFormSchema),
    defaultValues: {
      jobId: null,
      steps: []
    }
  });

  // Update form when templates load
  useEffect(() => {
    if (hazardTemplates.length > 0 && form.getValues('steps').length === 0) {
      form.setValue('steps', hazardTemplates.map(template => ({
        hazardTemplateId: template.id,
        riskRating: template.defaultRiskRating,
        controlMeasureIds: []
      })));
    }
  }, [hazardTemplates, form]);

  const createAssessmentMutation = useMutation({
    mutationFn: async (data: JHAFormValues & { signatures: { name: string; signature: string }[] }) => {
      return apiRequest('/api/jha/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job Hazard Analysis completed successfully",
      });
      navigate("/job-dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save JHA assessment",
        variant: "destructive"
      });
    }
  });

  const handleNext = () => {
    if (currentStep < hazardTemplates.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Show signature pad
      setShowSignaturePad(true);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSignature = (name: string, signatureData: string) => {
    setSignatures([...signatures, { name, signature: signatureData }]);
    setSignerName("");
    setShowSignaturePad(false);
  };

  const handleSubmit = (data: JHAFormValues) => {
    if (signatures.length === 0) {
      toast({
        title: "Signature Required",
        description: "At least one worker signature is required to complete the JHA",
        variant: "destructive"
      });
      return;
    }

    createAssessmentMutation.mutate({
      ...data,
      signatures
    });
  };

  const getRiskColor = (rating: number) => {
    if (rating >= 4) return "bg-red-500";
    if (rating >= 3) return "bg-orange-500";
    return "bg-green-500";
  };

  const getRiskLabel = (rating: number) => {
    if (rating >= 4) return "High Risk";
    if (rating >= 3) return "Medium Risk";
    return "Low Risk";
  };

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hazardTemplates.length === 0) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>No Hazard Templates Available</CardTitle>
            <CardDescription>
              Please configure hazard templates in Settings before conducting a JHA
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/settings/jha-templates")} data-testid="button-configure-templates">
              Configure Templates
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentTemplate = hazardTemplates[currentStep];
  const currentStepData = form.watch(`steps.${currentStep}`);

  if (showSignaturePad) {
    return (
      <div className="container mx-auto p-4 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Worker Signatures</CardTitle>
            <CardDescription>
              All workers involved in this job must sign the JHA
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {signatures.map((sig, index) => (
              <div key={index} className="flex items-center gap-2 p-2 border rounded">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="font-medium">{sig.name}</span>
              </div>
            ))}

            <div className="space-y-2">
              <label className="text-sm font-medium">Worker Name</label>
              <input
                type="text"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                placeholder="Enter your full name"
                data-testid="input-signer-name"
              />
            </div>

            <SignaturePad
              onSave={(signatureData) => handleSignature(signerName, signatureData)}
              disabled={!signerName.trim()}
            />

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSignaturePad(false)}
                data-testid="button-back-to-review"
              >
                Back to Review
              </Button>
              {signatures.length > 0 && (
                <Button
                  onClick={() => handleSubmit(form.getValues())}
                  disabled={createAssessmentMutation.isPending}
                  className="flex-1"
                  data-testid="button-submit-jha"
                >
                  {createAssessmentMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Complete JHA
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <div className="mb-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/job-dashboard")}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Job Hazard Analysis</CardTitle>
                  <CardDescription>
                    Step {currentStep + 1} of {hazardTemplates.length}
                  </CardDescription>
                </div>
                <Badge variant="outline" data-testid={`text-progress-${currentStep + 1}-${hazardTemplates.length}`}>
                  {currentStep + 1}/{hazardTemplates.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">{currentTemplate.name}</h3>
                {currentTemplate.description && (
                  <p className="text-sm text-muted-foreground mb-4">{currentTemplate.description}</p>
                )}
              </div>

              {/* Risk Rating */}
              <FormField
                control={form.control}
                name={`steps.${currentStep}.riskRating`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-semibold">Risk Rating</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value.toString()}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        className="space-y-2"
                      >
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <div
                            key={rating}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover-elevate"
                          >
                            <RadioGroupItem value={rating.toString()} id={`rating-${rating}`} data-testid={`radio-risk-${rating}`} />
                            <label
                              htmlFor={`rating-${rating}`}
                              className="flex items-center gap-3 flex-1 cursor-pointer"
                            >
                              <div className={`w-8 h-8 rounded-full ${getRiskColor(rating)} flex items-center justify-center text-white font-bold`}>
                                {rating}
                              </div>
                              <span className="font-medium">{getRiskLabel(rating)}</span>
                            </label>
                          </div>
                        ))}
                      </RadioGroup>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Control Measures */}
              {currentTemplate.controlMeasures.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <h4 className="font-semibold">Control Measures</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select all control measures that will be implemented
                  </p>
                  
                  <FormField
                    control={form.control}
                    name={`steps.${currentStep}.controlMeasureIds`}
                    render={() => (
                      <FormItem>
                        {currentTemplate.controlMeasures.map((control) => (
                          <FormField
                            key={control.id}
                            control={form.control}
                            name={`steps.${currentStep}.controlMeasureIds`}
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={control.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 p-3 border rounded-lg"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(control.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, control.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== control.id
                                              )
                                            )
                                      }}
                                      data-testid={`checkbox-control-${control.id}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal cursor-pointer flex-1">
                                    {control.description}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  data-testid="button-previous"
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  onClick={handleNext}
                  className="flex-1"
                  data-testid="button-next"
                >
                  {currentStep === hazardTemplates.length - 1 ? "Review & Sign" : "Next"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
