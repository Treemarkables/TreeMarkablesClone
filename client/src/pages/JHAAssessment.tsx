import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Camera,
  Loader2,
  Search,
  Plus,
  X,
  Check,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SignaturePad from "@/components/SignaturePad";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { PhotoCaptureModal } from "@/components/PhotoCaptureModal";
import { compressImage } from "@/lib/imageCompression";
const jhaHeaderImage = "/treemarkables-logo-header.png";

// ThinkSafe-style JHA form schema
const jhaFormSchema = z.object({
  activityDescription: z.string().min(1, "Activity is required"),
  ppeRequired: z.array(z.string()).optional(),
  teamLeader: z.string().optional(),
  location: z.string().optional(),
  comments: z.string().optional(),
  selectedHazards: z.array(
    z.object({
      hazardTemplateId: z.union([z.number(), z.string()]),
      hazardName: z.string(),
      initialRisk: z.number().min(1).max(4),
      selectedControls: z
        .array(z.union([z.number(), z.string()]))
        .min(1, "At least one control measure is required"),
      residualRisk: z.number().min(1).max(4).optional(),
      responsiblePerson: z.string().optional(),
      riskControl: z.string().optional(),
    }),
  ),
});

type JHAFormValues = z.infer<typeof jhaFormSchema>;

const PPE_OPTIONS = [
  "Protective eye wear",
  "Gloves",
  "Protective helmet",
  "Protective ear muffs",
  "Hi vis shirt",
  "Protective kevlar pants",
  "Protective steel capped boots",
];

export default function JHAAssessment() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [sharedSignature, setSharedSignature] = useState<string>("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]);
  const [showCustomHazardForm, setShowCustomHazardForm] = useState(false);
  const [customHazardName, setCustomHazardName] = useState("");
  const [customControls, setCustomControls] = useState<string[]>([""]);

  // Get assessment ID from URL query params for editing
  const searchParams = new URLSearchParams(window.location.search);
  const assessmentId = searchParams.get("id");
  const isEditing = !!assessmentId;

  // Fetch existing assessment if editing
  const { data: existingAssessmentData, isLoading: loadingExisting } =
    useQuery<{
      success: boolean;
      data: {
        id: string;
        activityDescription: string | null;
        ppeRequired: string[] | null;
        teamLeader: string | null;
        location: string | null;
        comments: string | null;
        photos: string[] | null;
        steps: Array<{
          id: string;
          hazardName: string;
          hazardTemplateId: string | null;
          initialRiskRating: number;
          residualRiskRating: number | null;
          responsiblePerson: string | null;
          controlMeasures: Array<{
            id: string;
            description: string;
            controlMeasureTemplateId: string | null;
          }>;
        }>;
        signatures: Array<{
          id: string;
          workerName: string;
          signatureDataUrl: string;
          signedAt: string;
        }>;
      };
    }>({
      queryKey: [
        `/api/jha/assessments/${assessmentId}?includeSteps=true&includeSignatures=true`,
      ],
      enabled: isEditing,
    });

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
    queryKey: ["/api/jha/hazard-templates"],
  });

  const hazardTemplates = templatesData?.data || [];
  const existingAssessment = existingAssessmentData?.data;
  const filteredHazards = hazardTemplates.filter((h) =>
    h.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const form = useForm<JHAFormValues>({
    resolver: zodResolver(jhaFormSchema),
    defaultValues: {
      activityDescription: "",
      ppeRequired: [],
      teamLeader: "",
      location: "",
      comments: "",
      selectedHazards: [],
    },
  });

  // Load existing assessment data into form when editing
  useEffect(() => {
    if (existingAssessment && isEditing) {
      form.reset({
        activityDescription: existingAssessment.activityDescription || "",
        ppeRequired: existingAssessment.ppeRequired || [],
        teamLeader: existingAssessment.teamLeader || "",
        location: existingAssessment.location || "",
        comments: existingAssessment.comments || "",
        selectedHazards:
          existingAssessment.steps?.map((step) => ({
            hazardTemplateId: step.hazardTemplateId || `custom-${step.id}`,
            hazardName: step.hazardName,
            initialRisk: step.initialRiskRating,
            selectedControls: step.controlMeasures.map(
              (cm) => cm.controlMeasureTemplateId || cm.description,
            ),
            residualRisk: step.residualRiskRating || step.initialRiskRating,
            responsiblePerson: step.responsiblePerson || "",
            riskControl: step.controlMeasures[0]?.description || "",
          })) || [],
      });

      if (existingAssessment.photos) {
        setPhotos(existingAssessment.photos);
      }
    }
  }, [existingAssessment, isEditing, form]);

  const selectedHazards = form.watch("selectedHazards");

  const createAssessmentMutation = useMutation({
    mutationFn: async (
      data: JHAFormValues & { sharedSignature: string; photos: string[] },
    ) => {
      // Editing an existing JHA with only a new signature added: use the
      // dedicated append endpoint so we don't re-validate/rewrite the whole
      // assessment. This is by far the most common "edit" — a worker joined
      // the job after the initial signing and needs to sign too.
      if (isEditing && assessmentId && data.sharedSignature) {
        const res = await fetch(
          `/api/jha/assessments/${assessmentId}/signatures`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              signatureDataUrl: data.sharedSignature,
              workerName: data.teamLeader || undefined,
            }),
          },
        );
        if (!res.ok) {
          const body = await res.text();
          console.error("JHA append-signature failed", res.status, body);
          let message = `${res.status} ${res.statusText}`;
          try {
            const parsed = JSON.parse(body);
            if (parsed.message) message = parsed.message;
          } catch {}
          throw new Error(message);
        }
        return res;
      }

      const url =
        isEditing && assessmentId
          ? `/api/jha/assessments/${assessmentId}`
          : `/api/jha/assessments`;
      const method = isEditing && assessmentId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("JHA save failed", res.status, body);
        console.error("JHA save payload:", data);
        let message = `${res.status} ${res.statusText}`;
        try {
          const parsed = JSON.parse(body);
          if (parsed.errors && Array.isArray(parsed.errors)) {
            message = parsed.errors
              .map(
                (e: any) =>
                  `${(e.path || []).join(".")}: ${e.message} (got ${JSON.stringify(e.received)})`,
              )
              .join(" | ");
          } else if (parsed.message) {
            message = parsed.message;
          }
        } catch {}
        throw new Error(message);
      }
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jha/assessments"] });
      navigate("/jha-history");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save JHA assessment",
        variant: "destructive",
      });
    },
  });

  const uploadJhaPhotoMutation = useMutation({
    mutationFn: async (file: File): Promise<{ photoUrl: string }> => {
      let fileToUpload = file;
      if (file.type.startsWith("image/")) {
        try {
          fileToUpload = await compressImage(file);
        } catch {
          // fall back to original
        }
      }
      const formData = new FormData();
      formData.append("photo", fileToUpload);
      const res = await fetch(`/api/jha/assessments/${assessmentId}/photos`, {
        method: "POST",
        body: formData,
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        const err: { message?: string } = await res.json();
        throw new Error(err.message ?? "Failed to upload photo");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setPhotos((prev) => [...prev, data.photoUrl]);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload photo. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoCapture = () => setShowPhotoModal(true);

  const handlePendingPhotos = (files: File[], previewUrls: string[]) => {
    if (isEditing && assessmentId) {
      files.forEach((file) => uploadJhaPhotoMutation.mutate(file));
    } else {
      setPendingPhotoFiles((prev) => [...prev, ...files]);
      setPendingPreviewUrls((prev) => [...prev, ...previewUrls]);
    }
  };

  const handleRemovePhoto = (index: number, isPending: boolean) => {
    if (isPending) {
      setPendingPhotoFiles((prev) => prev.filter((_, i) => i !== index));
      setPendingPreviewUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      setPhotos((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const toggleHazard = (hazard: (typeof hazardTemplates)[0]) => {
    const current = selectedHazards;
    const exists = current.find((h) => h.hazardTemplateId === hazard.id);

    if (exists) {
      form.setValue(
        "selectedHazards",
        current.filter((h) => h.hazardTemplateId !== hazard.id),
        { shouldDirty: true },
      );
    } else {
      const riskRating = hazard.defaultRiskRating || 2;
      form.setValue(
        "selectedHazards",
        [
          ...current,
          {
            hazardTemplateId: hazard.id,
            hazardName: hazard.name,
            initialRisk: riskRating,
            selectedControls: [],
            residualRisk: riskRating,
            responsiblePerson: "",
          },
        ],
        { shouldDirty: true },
      );
    }
  };

  const updateHazardField = (
    hazardId: number | string,
    field: string,
    value: any,
  ) => {
    const current = selectedHazards;
    const updated = current.map((h) =>
      h.hazardTemplateId === hazardId ? { ...h, [field]: value } : h,
    );
    form.setValue("selectedHazards", updated);
  };

  const addCustomControl = () => {
    setCustomControls([...customControls, ""]);
  };

  const updateCustomControl = (index: number, value: string) => {
    const updated = [...customControls];
    updated[index] = value;
    setCustomControls(updated);
  };

  const removeCustomControl = (index: number) => {
    if (customControls.length > 1) {
      const updated = customControls.filter((_, i) => i !== index);
      setCustomControls(updated);
    }
  };

  const addCustomHazard = () => {
    if (!customHazardName.trim()) {
      toast({
        title: "Hazard name required",
        description: "Please enter a name for the hazard before adding it",
        variant: "destructive",
      });
      return;
    }

    // Use whatever controls the user has entered; filter empty strings.
    // If nothing was entered, use a placeholder so the hazard can still be added
    // and the user can fill in proper controls in the hazard detail section.
    const validControls = customControls.filter((c) => c.trim());
    const finalControls =
      validControls.length > 0 ? validControls : ["To be determined"];

    const customId = `custom-${Date.now()}`;
    const newHazard = {
      hazardTemplateId: customId,
      hazardName: customHazardName.trim(),
      initialRisk: 2,
      selectedControls: finalControls,
      residualRisk: 1,
      responsiblePerson: "",
      riskControl: finalControls[0],
    };

    form.setValue("selectedHazards", [...(selectedHazards || []), newHazard]);

    // Reset form
    setCustomHazardName("");
    setCustomControls([""]);
    setShowCustomHazardForm(false);
  };

  const toggleControl = (
    hazardId: number | string,
    controlId: number | string,
  ) => {
    const current = selectedHazards;
    const hazard = current.find((h) => h.hazardTemplateId === hazardId);
    if (!hazard) return;

    const hasControl = hazard.selectedControls.includes(controlId);
    const updated = current.map((h) => {
      if (h.hazardTemplateId === hazardId) {
        return {
          ...h,
          selectedControls: hasControl
            ? h.selectedControls.filter((id) => id !== controlId)
            : [...h.selectedControls, controlId],
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

  const handleSubmit = async (data: JHAFormValues) => {
    console.log("🔍 Form submit triggered", {
      hazardCount: data.selectedHazards?.length,
      hasSignature: !!sharedSignature,
      isEditing,
      formData: data,
    });

    if (
      !data.activityDescription ||
      data.activityDescription.trim().length === 0
    ) {
      toast({
        title: "Activity Required",
        description: "Please enter an activity description",
        variant: "destructive",
      });
      return;
    }

    if (!data.selectedHazards || data.selectedHazards.length === 0) {
      console.log("❌ Validation failed: No hazards selected");
      toast({
        title: "No Hazards Selected",
        description: "Please select at least one hazard to assess",
        variant: "destructive",
      });
      return;
    }

    // When creating new JHA, signature is required
    // When editing, signature is optional (existing signatures remain valid)
    if (!isEditing && !sharedSignature) {
      console.log("❌ Validation failed: No signature");
      toast({
        title: "Signature Required",
        description:
          "Worker signatures are required to complete the assessment",
        variant: "destructive",
      });
      return;
    }

    // Upload any pending photos before creating the assessment
    let finalPhotos = [...photos];
    if (!isEditing && pendingPhotoFiles.length > 0) {
      for (const file of pendingPhotoFiles) {
        let fileToUpload = file;
        if (file.type.startsWith("image/")) {
          try {
            fileToUpload = await compressImage(file);
          } catch {
            // fall back to original
          }
        }
        const formData = new FormData();
        formData.append("photo", fileToUpload);
        const res = await fetch("/api/jha/photos/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          const err: { message?: string } = await res.json();
          toast({
            title: "Photo Upload Failed",
            description: err.message ?? "Failed to upload a photo. Please try again.",
            variant: "destructive",
          });
          return;
        }
        const result: { photoUrl: string } = await res.json();
        finalPhotos.push(result.photoUrl);
      }
    }

    console.log("✅ Validation passed, submitting form");
    createAssessmentMutation.mutate({
      ...data,
      sharedSignature: sharedSignature || "",
      photos: finalPhotos,
    });
  };

  if (templatesLoading || (isEditing && loadingExisting)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-4 mx-auto max-w-4xl pb-32 md:pb-4">
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

      {/* JHA Risk Assessment Header */}
      <div className="mb-4 overflow-hidden rounded-lg shadow-md w-full h-[120px] md:h-[160px]">
        <img
          src={jhaHeaderImage}
          alt="Job Hazard Analysis Risk Assessment"
          className="w-full h-full object-cover object-center block"
        />
      </div>

      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            console.log("📝 Form onSubmit event fired");
            const values = form.getValues();
            console.log("📋 Form values at submit:", values);
            handleSubmit(values);
          }}
          className="space-y-4"
        >
          {/* Header */}
          <div>
            <h2 className="text-2xl font-semibold">
              {isEditing ? "Edit Job Hazard Analysis" : "Job Hazard Analysis"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Update assessment details or add additional signatures"
                : "Complete this form before starting work"}
            </p>
          </div>

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
                      <Textarea
                        {...field}
                        placeholder="Enter text..."
                        data-testid="input-activity"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ppeRequired"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PPE required</FormLabel>
                    <div className="space-y-2">
                      {PPE_OPTIONS.map((option) => {
                        const isSelected =
                          field.value?.includes(option) ?? false;
                        return (
                          <div
                            key={option}
                            className="flex items-center space-x-3 p-3 border rounded-lg hover-elevate"
                            data-testid={`checkbox-ppe-${option.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const currentValue = field.value || [];
                                if (checked) {
                                  field.onChange([...currentValue, option]);
                                } else {
                                  field.onChange(
                                    currentValue.filter(
                                      (v: string) => v !== option,
                                    ),
                                  );
                                }
                              }}
                            />
                            <label className="flex-1 text-sm">{option}</label>
                          </div>
                        );
                      })}
                    </div>
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
                      <Input
                        {...field}
                        placeholder="Enter name..."
                        data-testid="input-team-leader"
                      />
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
                      <AddressAutocomplete
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Search for address..."
                        data-testid="input-location"
                      />
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
                  const isSelected = selectedHazards.some(
                    (h) => h.hazardTemplateId === hazard.id,
                  );
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

              <div className="mt-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowCustomHazardForm(!showCustomHazardForm)}
                  data-testid="button-add-custom-hazard"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Hazard
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Custom Hazard Form */}
          {showCustomHazardForm && (
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-lg">Create Custom Hazard</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Hazard Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Enter hazard name..."
                    value={customHazardName}
                    onChange={(e) => setCustomHazardName(e.target.value)}
                    data-testid="input-custom-hazard-name"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Risk Control Measures{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2">
                    {customControls.map((control, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Enter control measure..."
                          value={control}
                          onChange={(e) =>
                            updateCustomControl(index, e.target.value)
                          }
                          data-testid={`input-custom-control-${index}`}
                        />
                        {customControls.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeCustomControl(index)}
                            aria-label="Remove control"
                            data-testid={`button-remove-control-${index}`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addCustomControl}
                      data-testid="button-add-control"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Another Control
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={addCustomHazard}
                    className="flex-1"
                    data-testid="button-save-custom-hazard"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Add Hazard
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCustomHazardForm(false);
                      setCustomHazardName("");
                      setCustomControls([""]);
                    }}
                    data-testid="button-cancel-custom-hazard"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Selected Hazards Details */}
          {selectedHazards.map((selectedHazard) => {
            const template = hazardTemplates.find(
              (h) => h.id === selectedHazard.hazardTemplateId,
            );
            const isCustom =
              typeof selectedHazard.hazardTemplateId === "string" &&
              selectedHazard.hazardTemplateId.startsWith("custom-");

            return (
              <Card
                key={selectedHazard.hazardTemplateId}
                className={isCustom ? "border-blue-200" : "border-cyan-200"}
              >
                <CardHeader className={isCustom ? "bg-blue-50" : "bg-cyan-50"}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">
                        {selectedHazard.hazardName}
                      </CardTitle>
                      {isCustom && <Badge variant="secondary">Custom</Badge>}
                    </div>
                    <Badge variant="outline">
                      Initial Risk: {selectedHazard.initialRisk}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  {/* Initial Risk */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Initial risk
                    </label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Risk level with no controls
                    </p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateHazardField(
                              selectedHazard.hazardTemplateId,
                              "initialRisk",
                              rating,
                            )
                          }
                          className={`flex-1 h-12 rounded-md font-medium transition-colors ${
                            selectedHazard.initialRisk === rating
                              ? getRiskColor(rating) + " text-white"
                              : "bg-gray-200 hover:bg-gray-300"
                          }`}
                          data-testid={`button-initial-risk-${selectedHazard.hazardTemplateId}-${rating}`}
                        >
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Control Measures for Template Hazards */}
                  {!isCustom &&
                    template?.controlMeasures &&
                    template.controlMeasures.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Risk control measures{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        {selectedHazard.selectedControls.length === 0 && (
                          <p className="text-sm text-red-500 mb-2">
                            At least one control measure must be selected
                          </p>
                        )}
                        <div className="space-y-2">
                          {template.controlMeasures.map((control) => (
                            <div
                              key={control.id}
                              className="flex items-start space-x-3 p-3 border rounded-lg hover-elevate"
                            >
                              <Checkbox
                                checked={selectedHazard.selectedControls.includes(
                                  control.id,
                                )}
                                onCheckedChange={() =>
                                  toggleControl(
                                    selectedHazard.hazardTemplateId,
                                    control.id,
                                  )
                                }
                                data-testid={`checkbox-control-${selectedHazard.hazardTemplateId}-${control.id}`}
                              />
                              <label
                                className="flex-1 cursor-pointer text-sm"
                                onClick={() =>
                                  toggleControl(
                                    selectedHazard.hazardTemplateId,
                                    control.id,
                                  )
                                }
                              >
                                {control.description}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Control Measures for Custom Hazards */}
                  {isCustom && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Risk control measures
                      </label>
                      <div className="space-y-2">
                        {(selectedHazard.selectedControls as string[]).map(
                          (control, index) => (
                            <div
                              key={index}
                              className="p-3 border rounded-lg bg-muted/50"
                            >
                              <p className="text-sm">{control}</p>
                            </div>
                          ),
                        )}
                      </div>
                    </div>
                  )}

                  {/* Who is responsible */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Who is responsible
                    </label>
                    <Input
                      placeholder="Enter text..."
                      value={selectedHazard.responsiblePerson || ""}
                      onChange={(e) =>
                        updateHazardField(
                          selectedHazard.hazardTemplateId,
                          "responsiblePerson",
                          e.target.value,
                        )
                      }
                      data-testid={`input-responsible-${selectedHazard.hazardTemplateId}`}
                    />
                  </div>

                  {/* Risk Control for Template Hazards */}
                  {!isCustom &&
                    template?.controlMeasures &&
                    template.controlMeasures.length > 0 && (
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Risk Control
                        </label>
                        <Select
                          value={selectedHazard.riskControl || ""}
                          onValueChange={(value) =>
                            updateHazardField(
                              selectedHazard.hazardTemplateId,
                              "riskControl",
                              value,
                            )
                          }
                        >
                          <SelectTrigger
                            data-testid={`select-risk-control-${selectedHazard.hazardTemplateId}`}
                          >
                            <SelectValue placeholder="Select risk control..." />
                          </SelectTrigger>
                          <SelectContent>
                            {template.controlMeasures.map((control) => (
                              <SelectItem
                                key={control.id}
                                value={control.description}
                              >
                                {control.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {/* Risk Control for Custom Hazards */}
                  {isCustom && (
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Risk Control
                      </label>
                      <Select
                        value={selectedHazard.riskControl || ""}
                        onValueChange={(value) =>
                          updateHazardField(
                            selectedHazard.hazardTemplateId,
                            "riskControl",
                            value,
                          )
                        }
                      >
                        <SelectTrigger
                          data-testid={`select-risk-control-${selectedHazard.hazardTemplateId}`}
                        >
                          <SelectValue placeholder="Select risk control..." />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedHazard.selectedControls as string[]).map(
                            (control, index) => (
                              <SelectItem key={index} value={control}>
                                {control}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Residual Risk */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Residual risk
                    </label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Risk level with controls
                    </p>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateHazardField(
                              selectedHazard.hazardTemplateId,
                              "residualRisk",
                              rating,
                            )
                          }
                          className={`flex-1 h-12 rounded-md font-medium transition-colors ${
                            selectedHazard.residualRisk === rating
                              ? getRiskColor(rating) + " text-white"
                              : "bg-gray-200 hover:bg-gray-300"
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
                <CardTitle className="text-lg">
                  SUMMARY - Hazard / Risk & Measure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedHazards.map((hazard) => {
                    const template = hazardTemplates.find(
                      (h) => h.id === hazard.hazardTemplateId,
                    );
                    const isCustom =
                      typeof hazard.hazardTemplateId === "string" &&
                      hazard.hazardTemplateId.startsWith("custom-");

                    let controlsList: Array<{ description: string }> = [];
                    if (isCustom) {
                      controlsList = (hazard.selectedControls as string[]).map(
                        (c) => ({ description: c }),
                      );
                    } else {
                      controlsList =
                        template?.controlMeasures?.filter((c) =>
                          hazard.selectedControls.includes(c.id),
                        ) || [];
                    }

                    return (
                      <div
                        key={hazard.hazardTemplateId}
                        className="p-3 border rounded-lg bg-gray-50 space-y-2"
                      >
                        <div className="font-medium text-sm flex items-center gap-2">
                          {hazard.hazardName}
                          {isCustom && (
                            <Badge variant="secondary" className="text-xs">
                              Custom
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Initial Risk:</span>{" "}
                          {hazard.initialRisk}
                        </div>
                        {hazard.riskControl && (
                          <div className="text-sm">
                            <span className="font-medium">Risk Control:</span>{" "}
                            {hazard.riskControl}
                          </div>
                        )}
                        {controlsList.length > 0 && (
                          <div className="text-sm">
                            <div className="font-medium mb-1">
                              Control Measures:
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              {controlsList.map((c, idx) => (
                                <li key={idx}>{c.description}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {hazard.responsiblePerson && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Responsible:</span>{" "}
                            {hazard.responsiblePerson}
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
                      <Textarea
                        {...field}
                        placeholder="Enter text..."
                        rows={4}
                        data-testid="input-comments"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Photos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePhotoCapture}
                disabled={uploadJhaPhotoMutation.isPending}
                data-testid="button-add-photo"
              >
                <Camera className="mr-2 h-4 w-4" />
                {uploadJhaPhotoMutation.isPending ? "Uploading..." : "Add Photo"}
              </Button>

              {photos.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((photoUrl, idx) => (
                    <div key={idx} className="relative aspect-square">
                      <img
                        src={photoUrl}
                        alt={`Assessment photo ${idx + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => handleRemovePhoto(idx, false)}
                        aria-label="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {pendingPreviewUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {pendingPreviewUrls.map((previewUrl, idx) => (
                    <div key={idx} className="relative aspect-square">
                      <img
                        src={previewUrl}
                        alt={`Pending photo ${idx + 1}`}
                        className="w-full h-full object-cover rounded-lg opacity-70"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={() => handleRemovePhoto(idx, true)}
                        aria-label="Remove pending photo"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <PhotoCaptureModal
            isOpen={showPhotoModal}
            onClose={() => setShowPhotoModal(false)}
            onPendingPhotos={handlePendingPhotos}
          />

          {/* Existing Signatures */}
          {isEditing &&
            existingAssessment?.signatures &&
            existingAssessment.signatures.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Existing Signatures</CardTitle>
                  <CardDescription>
                    Workers who have already signed this JHA
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {existingAssessment.signatures.map((sig) => (
                    <div
                      key={sig.id}
                      className="p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="font-medium text-sm">
                            {sig.workerName}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(sig.signedAt), "PPp")}
                        </span>
                      </div>
                      <div className="border rounded bg-white dark:bg-gray-900 p-2">
                        <img
                          src={sig.signatureDataUrl}
                          alt={`Signature by ${sig.workerName}`}
                          className="max-h-20 w-full object-contain"
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          {/* New Signatures */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {isEditing
                  ? "Add Additional Worker Signature"
                  : "Worker Signatures"}
              </CardTitle>
              <CardDescription>
                {isEditing
                  ? "Add signature for workers who joined this job later"
                  : "All workers can sign in the box below"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sharedSignature ? (
                <div className="space-y-3">
                  <div className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="font-medium">
                        {isEditing
                          ? "New signature collected"
                          : "Signatures collected"}
                      </span>
                    </div>
                    <img
                      src={sharedSignature}
                      alt="Worker signatures"
                      className="w-full border rounded bg-white"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSharedSignature("")}
                    data-testid="button-clear-signature"
                  >
                    Clear & Re-sign
                  </Button>
                </div>
              ) : (
                <SignaturePad
                  onSave={(signatureData) => setSharedSignature(signatureData)}
                  disabled={false}
                />
              )}
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="sticky bottom-0 left-0 right-0 bg-background pt-4 pb-8 -mx-4 px-4 border-t mt-6 z-50">
            <Button
              type="submit"
              className="w-full h-14 text-lg bg-green-600 hover:bg-green-700 shadow-lg"
              disabled={createAssessmentMutation.isPending}
              data-testid="button-submit-form"
              onClick={(e) => {
                console.log("🖱️ Submit button clicked", e.type);
                console.log("📋 Form validation state:", {
                  isValid: form.formState.isValid,
                  errors: form.formState.errors,
                  isDirty: form.formState.isDirty,
                  values: form.getValues(),
                });
              }}
            >
              {createAssessmentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {isEditing ? "Updating..." : "Submitting..."}
                </>
              ) : isEditing ? (
                "Update JHA"
              ) : (
                "Submit Form"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
