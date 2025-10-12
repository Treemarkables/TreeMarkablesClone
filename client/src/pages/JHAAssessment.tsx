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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, CheckCircle2, Camera, Upload, Loader2, Search, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SignaturePad from "@/components/SignaturePad";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import thinkSafeImage from "@assets/IMG_4069_1760215066704.png";

// ThinkSafe-style JHA form schema
const jhaFormSchema = z.object({
  activityDescription: z.string().min(1, "Activity is required"),
  ppeRequired: z.string().optional(),
  teamLeader: z.string().optional(),
  location: z.string().optional(),
  comments: z.string().optional(),
  selectedHazards: z.array(z.object({
    hazardTemplateId: z.number(),
    hazardName: z.string(),
    initialRisk: z.number().min(1).max(4),
    selectedControls: z.array(z.number()).min(1, "At least one control measure is required"),
    residualRisk: z.number().min(1).max(4).optional(),
    responsiblePerson: z.string().optional(),
    riskControl: z.string().optional()
  }))
});

type JHAFormValues = z.infer<typeof jhaFormSchema>;

export default function JHAAssessment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [signatures, setSignatures] = useState<{ name: string; signature: string }[]>([]);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

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
  const filteredHazards = hazardTemplates.filter(h => 
    h.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const form = useForm<JHAFormValues>({
    resolver: zodResolver(jhaFormSchema),
    defaultValues: {
      activityDescription: "",
      ppeRequired: "",
      teamLeader: "",
      location: "",
      comments: "",
      selectedHazards: []
    }
  });

  const selectedHazards = form.watch("selectedHazards");

  const createAssessmentMutation = useMutation({
    mutationFn: async (data: JHAFormValues & { signatures: { name: string; signature: string }[], photos: string[] }) => {
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

  const toggleHazard = (hazard: typeof hazardTemplates[0]) => {
    const current = selectedHazards;
    const exists = current.find(h => h.hazardTemplateId === hazard.id);
    
    if (exists) {
      form.setValue("selectedHazards", current.filter(h => h.hazardTemplateId !== hazard.id));
    } else {
      form.setValue("selectedHazards", [...current, {
        hazardTemplateId: hazard.id,
        hazardName: hazard.name,
        initialRisk: hazard.defaultRiskRating,
        selectedControls: [],
        residualRisk: hazard.defaultRiskRating,
        responsiblePerson: ""
      }]);
    }
  };

  const updateHazardField = (hazardId: number, field: string, value: any) => {
    const current = selectedHazards;
    const updated = current.map(h => 
      h.hazardTemplateId === hazardId ? { ...h, [field]: value } : h
    );
    form.setValue("selectedHazards", updated);
  };

  const toggleControl = (hazardId: number, controlId: number) => {
    const current = selectedHazards;
    const hazard = current.find(h => h.hazardTemplateId === hazardId);
    if (!hazard) return;
    
    const hasControl = hazard.selectedControls.includes(controlId);
    const updated = current.map(h => {
      if (h.hazardTemplateId === hazardId) {
        return {
          ...h,
          selectedControls: hasControl 
            ? h.selectedControls.filter(id => id !== controlId)
            : [...h.selectedControls, controlId]
        };
      }
      return h;
    });
    form.setValue("selectedHazards", updated);
  };

  const getRiskColor = (rating: number) => {
    if (rating >= 4) return "bg-red-500";
    if (rating >= 3) return "bg-orange-500";
    if (rating >= 2) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getRiskLabel = (rating: number) => {
    if (rating >= 4) return "Extreme Risk";
    if (rating >= 3) return "High Risk";
    if (rating >= 2) return "Medium Risk";
    return "Insignificant Risk";
  };

  const handleSignature = (name: string, signatureData: string) => {
    if (signatures.length < 5) {
      setSignatures([...signatures, { name, signature: signatureData }]);
      setSignerName("");
    }
  };

  const handlePhotoCapture = () => {
    // In a real app, this would open camera
    toast({
      title: "Photo Capture",
      description: "Camera functionality would open here",
    });
  };

  const handleSubmit = (data: JHAFormValues) => {
    if (data.selectedHazards.length === 0) {
      toast({
        title: "No Hazards Selected",
        description: "Please select at least one hazard to assess",
        variant: "destructive"
      });
      return;
    }

    if (signatures.length === 0) {
      toast({
        title: "Signature Required",
        description: "At least one worker signature is required",
        variant: "destructive"
      });
      return;
    }

    createAssessmentMutation.mutate({
      ...data,
      signatures,
      photos
    });
  };

  if (templatesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4 mx-auto max-w-4xl">
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

      {/* ThinkSafe Logo & Risk Matrix */}
      <div className="mb-4 overflow-hidden rounded-lg shadow-md h-[300px] md:h-[500px]">
        <img 
          src={thinkSafeImage} 
          alt="ThinkSafe Risk Matrix" 
          className="w-full h-full"
          style={{ 
            objectFit: 'cover',
            objectPosition: '0 -50px'
          }}
        />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Header */}
          <Card>
            <CardHeader className="bg-gradient-to-r from-cyan-500 to-teal-500 text-white">
              <CardTitle className="text-2xl">Job Hazard Analysis</CardTitle>
              <CardDescription className="text-white/90">
                Complete this form before starting work
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Job Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="activityDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity taking place *</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter text..." data-testid="input-activity" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ppeRequired"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PPE required</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter text..." data-testid="input-ppe" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teamLeader"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Team leader</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter name..." data-testid="input-team-leader" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter text..." data-testid="input-location" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Hazard Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Hazards</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search hazards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-hazards"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filteredHazards.map((hazard) => {
                  const isSelected = selectedHazards.some(h => h.hazardTemplateId === hazard.id);
                  return (
                    <div 
                      key={hazard.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg hover-elevate"
                      data-testid={`checkbox-hazard-${hazard.id}`}
                    >
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleHazard(hazard)}
                      />
                      <label className="flex-1 font-medium">
                        {hazard.name}
                      </label>
                      {isSelected && (
                        <Badge variant="secondary">Selected</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Hazards Details */}
          {selectedHazards.map((selectedHazard) => {
            const template = hazardTemplates.find(h => h.id === selectedHazard.hazardTemplateId);
            if (!template) return null;

            return (
              <Card key={selectedHazard.hazardTemplateId} className="border-cyan-200">
                <CardHeader className="bg-cyan-50">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedHazard.hazardName}</CardTitle>
                    <Badge variant="outline">Initial Risk: {selectedHazard.initialRisk}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Initial Risk */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Initial risk</label>
                    <p className="text-sm text-muted-foreground mb-2">Risk level with no controls</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => updateHazardField(selectedHazard.hazardTemplateId, 'initialRisk', rating)}
                          className={`flex-1 h-12 rounded-md font-medium transition-colors ${
                            selectedHazard.initialRisk === rating
                              ? getRiskColor(rating) + ' text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          data-testid={`button-initial-risk-${selectedHazard.hazardTemplateId}-${rating}`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Control Measures */}
                  {template.controlMeasures && template.controlMeasures.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Risk control measures <span className="text-red-500">*</span>
                      </label>
                      {selectedHazard.selectedControls.length === 0 && (
                        <p className="text-sm text-red-500 mb-2">At least one control measure must be selected</p>
                      )}
                      <div className="space-y-2">
                        {template.controlMeasures.map((control) => (
                          <div
                            key={control.id}
                            className="flex items-start space-x-3 p-3 border rounded-lg hover-elevate"
                          >
                            <Checkbox
                              checked={selectedHazard.selectedControls.includes(control.id)}
                              onCheckedChange={() => toggleControl(selectedHazard.hazardTemplateId, control.id)}
                              data-testid={`checkbox-control-${selectedHazard.hazardTemplateId}-${control.id}`}
                            />
                            <label 
                              className="flex-1 cursor-pointer text-sm"
                              onClick={() => toggleControl(selectedHazard.hazardTemplateId, control.id)}
                            >
                              {control.description}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Who is responsible */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Who is responsible</label>
                    <Input
                      placeholder="Enter text..."
                      value={selectedHazard.responsiblePerson || ""}
                      onChange={(e) => updateHazardField(selectedHazard.hazardTemplateId, 'responsiblePerson', e.target.value)}
                      data-testid={`input-responsible-${selectedHazard.hazardTemplateId}`}
                    />
                  </div>

                  {/* Risk Control */}
                  {template.controlMeasures && template.controlMeasures.length > 0 && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">Risk Control</label>
                      <Select
                        value={selectedHazard.riskControl || ""}
                        onValueChange={(value) => updateHazardField(selectedHazard.hazardTemplateId, 'riskControl', value)}
                      >
                        <SelectTrigger data-testid={`select-risk-control-${selectedHazard.hazardTemplateId}`}>
                          <SelectValue placeholder="Select risk control..." />
                        </SelectTrigger>
                        <SelectContent>
                          {template.controlMeasures.map((control) => (
                            <SelectItem key={control.id} value={control.description}>
                              {control.description}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Residual Risk */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Residual risk</label>
                    <p className="text-sm text-muted-foreground mb-2">Risk level with controls</p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => updateHazardField(selectedHazard.hazardTemplateId, 'residualRisk', rating)}
                          className={`flex-1 h-12 rounded-md font-medium transition-colors ${
                            selectedHazard.residualRisk === rating
                              ? getRiskColor(rating) + ' text-white'
                              : 'bg-gray-200 hover:bg-gray-300'
                          }`}
                          data-testid={`button-residual-risk-${selectedHazard.hazardTemplateId}-${rating}`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Summary */}
          {selectedHazards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">SUMMARY - Hazard / Risk & Measure</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedHazards.map((hazard) => {
                    const template = hazardTemplates.find(h => h.id === hazard.hazardTemplateId);
                    const controls = template?.controlMeasures?.filter(c => hazard.selectedControls.includes(c.id)) || [];
                    
                    return (
                      <div key={hazard.hazardTemplateId} className="p-3 border rounded-lg bg-gray-50 space-y-2">
                        <div className="font-medium text-sm">
                          {hazard.hazardName}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Initial Risk:</span> {hazard.initialRisk}
                        </div>
                        {hazard.riskControl && (
                          <div className="text-sm">
                            <span className="font-medium">Risk Control:</span> {hazard.riskControl}
                          </div>
                        )}
                        {controls.length > 0 && (
                          <div className="text-sm">
                            <div className="font-medium mb-1">Control Measures:</div>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              {controls.map((c, idx) => (
                                <li key={idx}>{c.description}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {hazard.responsiblePerson && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Responsible:</span> {hazard.responsiblePerson}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="comments"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea {...field} placeholder="Enter text..." rows={4} data-testid="input-comments" />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Button type="button" variant="destructive" onClick={handlePhotoCapture} data-testid="button-capture">
                  <Camera className="mr-2 h-4 w-4" />
                  Capture
                </Button>
                <Button type="button" className="bg-cyan-500 hover:bg-cyan-600" data-testid="button-choose">
                  <Upload className="mr-2 h-4 w-4" />
                  Choose
                </Button>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photo, idx) => (
                    <div key={idx} className="aspect-square bg-gray-200 rounded-lg"></div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signatures */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Signature of worker (s)</CardTitle>
              <CardDescription>Up to five people can sign here</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {signatures.map((sig, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="font-medium">{sig.name}</span>
                </div>
              ))}

              {signatures.length < 5 && !showSignaturePad && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowSignaturePad(true)}
                  data-testid="button-new-signature"
                >
                  New
                </Button>
              )}

              {showSignaturePad && (
                <div className="space-y-3 p-4 border rounded-lg">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Worker Name</label>
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Enter your full name"
                      data-testid="input-signer-name"
                    />
                  </div>
                  <SignaturePad
                    onSave={(signatureData) => {
                      handleSignature(signerName, signatureData);
                      setShowSignaturePad(false);
                    }}
                    disabled={!signerName.trim()}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setShowSignaturePad(false)}
                    data-testid="button-cancel-signature"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-14 text-lg bg-green-600 hover:bg-green-700"
            disabled={createAssessmentMutation.isPending}
            data-testid="button-submit-form"
          >
            {createAssessmentMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Form"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
