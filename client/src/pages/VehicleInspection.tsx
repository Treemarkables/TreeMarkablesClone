import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  Check,
  X,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type {
  SelectInspectionTemplate,
  SelectInspectionChecklistItem,
  InsertVehicleInspection,
  InsertInspectionResponse,
  SelectEquipment,
} from "@shared/schema";

type ResponseValue = "YES" | "NO" | "N/A";

interface InspectionResponse {
  checklistItemId: string;
  question: string;
  category: string | null;
  requiresComment: boolean;
  requiresPhoto: boolean;
  sortOrder: number;
  responseValue: ResponseValue | null;
  comments: string;
  photoUrl: string | null;
}

export default function VehicleInspection() {
  const { toast } = useToast();
  const { currentUser: user } = useAuth();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [responses, setResponses] = useState<Map<string, InspectionResponse>>(
    new Map(),
  );
  const [currentStep, setCurrentStep] = useState<
    "vehicle" | "inspection" | "signature"
  >("vehicle");
  const [odometerReading, setOdometerReading] = useState("");
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [inspectorName, setInspectorName] = useState("");

  // Fetch equipment (vehicles)
  const { data: vehiclesData } = useQuery({
    queryKey: ["/api/equipment"],
  });
  const vehicles = (Array.isArray((vehiclesData as any)?.data)
    ? (vehiclesData as any).data
    : []).filter((v: any) => v.requiresPreStart === true);

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ["/api/inspection-templates"],
  });
  const templates = Array.isArray((templatesData as any)?.data)
    ? (templatesData as any).data
    : [];

  // Fetch the global default template (used when the vehicle doesn't have its
  // own defaultInspectionTemplateId). Templates no longer carry a vehicleType,
  // so there is exactly one default across the list.
  const { data: defaultTemplateData } = useQuery({
    queryKey: ["/api/inspection-templates/default"],
    enabled: !!selectedVehicleId && !selectedTemplateId,
  });
  const defaultTemplate = (defaultTemplateData as any)?.data || null;

  // Fetch checklist items for selected template
  const { data: checklistItemsData } = useQuery({
    queryKey: [
      "/api/inspection-templates",
      selectedTemplateId || defaultTemplate?.id,
      "items",
    ],
    enabled: !!(selectedTemplateId || defaultTemplate?.id),
  });
  const checklistItems = Array.isArray((checklistItemsData as any)?.data)
    ? (checklistItemsData as any).data
    : [];

  // Auto-load vehicle's default inspection template
  useEffect(() => {
    if (selectedVehicleId) {
      const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
      if (selectedVehicle?.defaultInspectionTemplateId) {
        setSelectedTemplateId(selectedVehicle.defaultInspectionTemplateId);
      }
    }
  }, [selectedVehicleId, vehicles]);

  // Initialize responses when checklist items load (preserve existing answers)
  useEffect(() => {
    if (checklistItems.length > 0) {
      setResponses((prevResponses) => {
        const newResponses = new Map(prevResponses);

        // Only add missing items, preserve existing responses
        checklistItems.forEach((item) => {
          if (!newResponses.has(item.id)) {
            newResponses.set(item.id, {
              checklistItemId: item.id,
              question: item.question,
              category: item.category,
              requiresComment: item.requiresComment || false,
              requiresPhoto: item.requiresPhoto || false,
              sortOrder: item.sortOrder || 0,
              responseValue: null,
              comments: "",
              photoUrl: null,
            });
          }
        });

        // Remove responses for items no longer in the checklist
        const currentItemIds = new Set(checklistItems.map((i) => i.id));
        Array.from(newResponses.keys()).forEach((id) => {
          if (!currentItemIds.has(id)) {
            newResponses.delete(id);
          }
        });

        return newResponses;
      });
    }
  }, [checklistItems]);

  // Auto-populate inspector name when reaching signature step
  useEffect(() => {
    if (currentStep === "signature" && !inspectorName && user) {
      const defaultName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        user.username ||
        "";
      setInspectorName(defaultName);
    }
  }, [currentStep, inspectorName, user]);

  const createInspectionMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);
      const templateToUse = selectedTemplateId
        ? templates.find((t) => t.id === selectedTemplateId)
        : defaultTemplate;

      // Get signature as base64
      const canvas = signatureCanvasRef.current;
      const signatureDataUrl = canvas ? canvas.toDataURL() : null;

      // Create inspection record
      const inspectionData: InsertVehicleInspection = {
        vehicleId: selectedVehicleId,
        vehicleName: selectedVehicle?.name || "Unknown Vehicle",
        vehicleRegistration: selectedVehicle?.registrationNumber || null,
        templateId: (selectedTemplateId || defaultTemplate?.id) as string,
        templateName: templateToUse?.name || "Standard Inspection",
        inspectedBy: user?.id || "unknown",
        inspectorName: inspectorName || "Unknown",
        status: Array.from(responses.values()).some(
          (r) => r.responseValue === "NO",
        )
          ? "fail"
          : "pass",
        speedometerReading: odometerReading ? parseInt(odometerReading) : null,
        overallNotes: inspectorNotes || null,
        signature: signatureDataUrl || null,
      };

      const inspectionResponse = await apiRequest(
        "POST",
        "/api/vehicle-inspections",
        inspectionData,
      );
      const inspectionResult = await inspectionResponse.json();
      const inspectionId = inspectionResult.data.id;

      // Create all responses
      const responsePromises = Array.from(responses.values()).map(
        (response) => {
          if (response.responseValue) {
            const responseData: InsertInspectionResponse = {
              inspectionId,
              checklistItemId: response.checklistItemId,
              question: response.question,
              category: response.category,
              requiresComment: response.requiresComment,
              requiresPhoto: response.requiresPhoto,
              sortOrder: response.sortOrder || 0,
              response: response.responseValue,
              comment: response.comments || null,
              photos: response.photoUrl ? [response.photoUrl] : [],
            };
            return apiRequest(
              "POST",
              `/api/vehicle-inspections/${inspectionId}/responses`,
              responseData,
            );
          }
          return Promise.resolve();
        },
      );

      await Promise.all(responsePromises);
      return inspectionResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vehicle-inspections"] });

      // Reset form
      setSelectedVehicleId("");
      setSelectedTemplateId("");
      setResponses(new Map());
      setCurrentStep("vehicle");
      setOdometerReading("");
      setInspectorNotes("");
      setInspectorName("");
      setHasSignature(false);

      // Clear signature
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    },
    onError: (error) => {
      toast({
        title: "Failed to complete inspection",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleResponseChange = (itemId: string, value: ResponseValue) => {
    const currentResponse = responses.get(itemId);
    if (currentResponse) {
      const updatedResponse = { ...currentResponse, responseValue: value };
      // Clear comments and photo only if switching to YES
      if (value === "YES") {
        updatedResponse.comments = "";
        updatedResponse.photoUrl = null;
      }
      setResponses(new Map(responses.set(itemId, updatedResponse)));
    }
  };

  const handleCommentChange = (itemId: string, comments: string) => {
    const currentResponse = responses.get(itemId);
    if (currentResponse) {
      setResponses(
        new Map(responses.set(itemId, { ...currentResponse, comments })),
      );
    }
  };

  const handlePhotoUpload = async (itemId: string, file: File) => {
    // In production, upload to storage and get URL
    // For now, create a data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const currentResponse = responses.get(itemId);
      if (currentResponse && e.target?.result) {
        setResponses(
          new Map(
            responses.set(itemId, {
              ...currentResponse,
              photoUrl: e.target.result as string,
            }),
          ),
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x =
      "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y =
      "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (
    e:
      | React.MouseEvent<HTMLCanvasElement>
      | React.TouchEvent<HTMLCanvasElement>,
  ) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x =
      "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y =
      "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }
    }
  };

  const canProceedToInspection =
    selectedVehicleId && (selectedTemplateId || defaultTemplate);

  // Count answered questions
  const answeredCount = Array.from(responses.values()).filter(
    (r) => r.responseValue !== null,
  ).length;
  const totalQuestions = checklistItems.length;

  const canProceedToSignature =
    checklistItems.length > 0 &&
    responses.size === checklistItems.length &&
    Array.from(responses.values()).every((r) => r.responseValue !== null);

  const groupedItems = checklistItems.reduce(
    (acc, item) => {
      const category = item.category || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, SelectInspectionChecklistItem[]>,
  );

  if (currentStep === "vehicle") {
    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Vehicle Pre-Start Inspection
          </h1>
          <p className="text-muted-foreground">
            Select vehicle to begin
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inspection Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vehicle">Select Vehicle *</Label>
              <Select
                value={selectedVehicleId}
                onValueChange={setSelectedVehicleId}
              >
                <SelectTrigger
                  className="text-base md:text-sm"
                  data-testid="select-vehicle"
                >
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVehicleId && (
              <>
                <div>
                  <Label htmlFor="odometer">Odometer Reading (optional)</Label>
                  <Input
                    id="odometer"
                    type="number"
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    placeholder="Enter reading"
                    className="text-base md:text-sm"
                    data-testid="input-odometer"
                  />
                </div>

                {!selectedTemplateId && !defaultTemplate && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900">
                    No inspection template is assigned to this vehicle and no
                    default template was found. Assign a template to this
                    vehicle or mark a template as default in Vehicle Inspection
                    Settings.
                  </div>
                )}
              </>
            )}

            <Button
              onClick={() => setCurrentStep("inspection")}
              disabled={!canProceedToInspection}
              className="w-full"
              data-testid="button-start-inspection"
            >
              Start Inspection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === "inspection") {
    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Inspection Checklist
          </h1>
          <p className="text-muted-foreground">
            {vehicles.find((v) => v.id === selectedVehicleId)?.name}
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item) => {
                  const response = responses.get(item.id);
                  if (!response) return null;

                  return (
                    <div
                      key={item.id}
                      className="space-y-3 pb-4 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm md:text-base">
                          {item.question}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant={
                            response.responseValue === "YES"
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleResponseChange(item.id, "YES")}
                          className="flex-1 min-h-10"
                          data-testid={`button-yes-${item.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          YES
                        </Button>
                        <Button
                          variant={
                            response.responseValue === "NO"
                              ? "destructive"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleResponseChange(item.id, "NO")}
                          className="flex-1 min-h-10"
                          data-testid={`button-no-${item.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          NO
                        </Button>
                        <Button
                          variant={
                            response.responseValue === "N/A"
                              ? "secondary"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => handleResponseChange(item.id, "N/A")}
                          className="flex-1 min-h-10"
                          data-testid={`button-na-${item.id}`}
                        >
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          N/A
                        </Button>
                      </div>

                      {(response.responseValue === "NO" ||
                        response.responseValue === "N/A") && (
                        <div className="space-y-3 bg-muted/50 p-3 rounded-md">
                          {/* Always show comment field for NO or N/A */}
                          <div>
                            <Label
                              htmlFor={`comment-${item.id}`}
                              className="text-xs"
                            >
                              {response.responseValue === "NO"
                                ? "Comment (optional)"
                                : "Why is this not applicable? (optional)"}
                            </Label>
                            <Textarea
                              id={`comment-${item.id}`}
                              value={response.comments}
                              onChange={(e) =>
                                handleCommentChange(item.id, e.target.value)
                              }
                              placeholder={
                                response.responseValue === "NO"
                                  ? "Explain the issue..."
                                  : "Explain why this doesn't apply..."
                              }
                              className="text-base md:text-sm"
                              data-testid={`textarea-comment-${item.id}`}
                            />
                          </div>

                          {/* Only show photo option for NO responses on items that require it */}
                          {response.responseValue === "NO" &&
                            response.requiresPhoto && (
                              <div>
                                <Label className="text-xs">
                                  Photo (optional)
                                </Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    id={`photo-camera-${item.id}`}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file)
                                        handlePhotoUpload(item.id, file);
                                      e.target.value = "";
                                    }}
                                    data-testid={`input-photo-camera-${item.id}`}
                                  />
                                  <input
                                    id={`photo-library-${item.id}`}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file)
                                        handlePhotoUpload(item.id, file);
                                      e.target.value = "";
                                    }}
                                    data-testid={`input-photo-library-${item.id}`}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      document
                                        .getElementById(
                                          `photo-camera-${item.id}`,
                                        )
                                        ?.click()
                                    }
                                    data-testid={`button-photo-camera-${item.id}`}
                                  >
                                    <Camera className="w-4 h-4 mr-2" />
                                    Take photo
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      document
                                        .getElementById(
                                          `photo-library-${item.id}`,
                                        )
                                        ?.click()
                                    }
                                    data-testid={`button-photo-library-${item.id}`}
                                  >
                                    <Upload className="w-4 h-4 mr-2" />
                                    Choose photo
                                  </Button>
                                  {response.photoUrl && (
                                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 sticky bottom-0 bg-background py-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep("vehicle")}
            className="flex-1"
            data-testid="button-back"
          >
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep("signature")}
            disabled={!canProceedToSignature}
            className="flex-1"
            data-testid="button-next"
          >
            {canProceedToSignature
              ? "Next: Signature"
              : `Answer All (${answeredCount}/${totalQuestions})`}
          </Button>
        </div>
      </div>
    );
  }

  // Signature step
  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Complete Inspection</h1>
        <p className="text-muted-foreground">Sign to confirm inspection</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inspector Name *</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            placeholder="Enter your full name"
            className="text-base md:text-sm"
            data-testid="input-inspector-name"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Additional Notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={inspectorNotes}
            onChange={(e) => setInspectorNotes(e.target.value)}
            placeholder="Any additional observations..."
            className="text-base md:text-sm"
            data-testid="textarea-notes"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inspector Signature *</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSignature}
              data-testid="button-clear-signature"
            >
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <canvas
            ref={signatureCanvasRef}
            width={400}
            height={200}
            className="w-full border rounded-md bg-white cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            data-testid="canvas-signature"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Sign above using your mouse or finger
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background py-4 border-t">
        <Button
          variant="outline"
          onClick={() => setCurrentStep("inspection")}
          className="flex-1"
          data-testid="button-back-to-inspection"
        >
          Back
        </Button>
        <Button
          onClick={() => createInspectionMutation.mutate()}
          disabled={
            !hasSignature ||
            !inspectorName.trim() ||
            createInspectionMutation.isPending
          }
          className="flex-1"
          data-testid="button-submit"
        >
          {createInspectionMutation.isPending
            ? "Submitting..."
            : "Complete Inspection"}
        </Button>
      </div>
    </div>
  );
}
