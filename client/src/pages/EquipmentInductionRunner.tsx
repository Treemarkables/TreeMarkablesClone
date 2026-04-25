import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SignaturePad from "@/components/SignaturePad";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/imageCompression";
import {
  GraduationCap,
  Check,
  CheckCircle2,
  X,
  Camera,
  Upload,
} from "lucide-react";
import type {
  InductionTemplate,
  InductionChecklistItem,
  InsertEquipmentInduction,
  InsertInductionResponse,
} from "@shared/schema";

interface ResponseDraft {
  checklistItemId: string;
  step: string;
  category: string | null;
  requiresPhoto: boolean;
  sortOrder: number;
  acknowledged: boolean;
  notes: string;
  photos: string[];
  uploading: boolean;
}

type Step = "intro" | "checklist" | "signature";

export default function EquipmentInductionRunner() {
  const [, params] = useRoute("/staff-induction/:employeeId/:templateId");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { currentUser: user } = useAuth();

  const employeeId = params?.employeeId || "";
  const templateId = params?.templateId || "";

  const [currentStep, setCurrentStep] = useState<Step>("intro");
  const [responses, setResponses] = useState<Map<string, ResponseDraft>>(
    new Map(),
  );
  const [employeeSignature, setEmployeeSignature] = useState<string | null>(
    null,
  );
  const [trainerSignature, setTrainerSignature] = useState<string | null>(null);
  const [overallNotes, setOverallNotes] = useState("");
  const [trainerName, setTrainerName] = useState("");

  const { data: templateData } = useQuery({
    queryKey: ["/api/induction-templates", templateId],
    enabled: !!templateId,
  });
  const template: InductionTemplate | null =
    (templateData as any)?.data || null;

  const { data: itemsData } = useQuery({
    queryKey: ["/api/induction-templates", templateId, "items"],
    enabled: !!templateId,
  });
  const items: InductionChecklistItem[] = Array.isArray(
    (itemsData as any)?.data,
  )
    ? (itemsData as any).data
    : [];

  const { data: employeeData } = useQuery({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId,
  });
  const employee: any = (employeeData as any)?.data || null;

  useEffect(() => {
    if (items.length > 0) {
      setResponses((prev) => {
        const next = new Map(prev);
        items.forEach((item) => {
          if (!next.has(item.id)) {
            next.set(item.id, {
              checklistItemId: item.id,
              step: item.step,
              category: item.category,
              requiresPhoto: item.requiresPhoto || false,
              sortOrder: item.sortOrder || 0,
              acknowledged: false,
              notes: "",
              photos: [],
              uploading: false,
            });
          }
        });
        const ids = new Set(items.map((i) => i.id));
        Array.from(next.keys()).forEach((id) => {
          if (!ids.has(id)) next.delete(id);
        });
        return next;
      });
    }
  }, [items]);

  useEffect(() => {
    if (!trainerName && user) {
      const defaultName =
        `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
        (user as any).username ||
        "";
      setTrainerName(defaultName);
    }
  }, [trainerName, user]);

  const createInductionMutation = useMutation({
    mutationFn: async () => {
      if (!employee || !template) {
        throw new Error("Missing employee or template data");
      }
      if (!employeeSignature || !trainerSignature) {
        throw new Error("Both signatures are required");
      }

      const employeeName =
        `${employee.firstName || ""} ${employee.lastName || ""}`.trim() ||
        "Unknown";

      const inductionData: InsertEquipmentInduction = {
        employeeId,
        employeeName,
        equipmentType: template.equipmentType,
        templateId,
        templateName: template.name,
        inductedBy: user?.id || "unknown",
        inductorName: trainerName || "Unknown",
        notes: overallNotes || null,
        employeeSignature,
        trainerSignature,
      };

      const inductionResponse = await apiRequest(
        "POST",
        "/api/equipment-inductions",
        inductionData,
      );
      const inductionResult = await inductionResponse.json();
      const inductionId = inductionResult.data.id;

      const responsePromises = Array.from(responses.values()).map((r) => {
        const responseData: InsertInductionResponse = {
          inductionId,
          checklistItemId: r.checklistItemId,
          step: r.step,
          category: r.category,
          requiresPhoto: r.requiresPhoto,
          sortOrder: r.sortOrder || 0,
          acknowledged: r.acknowledged,
          notes: r.notes || null,
          photos: r.photos,
        };
        return apiRequest(
          "POST",
          `/api/equipment-inductions/${inductionId}/responses`,
          responseData,
        );
      });

      await Promise.all(responsePromises);
      return inductionResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-inductions"] });
      queryClient.invalidateQueries({
        queryKey: [
          "/api/equipment-inductions/employee",
          employeeId,
          "status",
        ],
      });
      setLocation("/settings/staff");
    },
    onError: (error) => {
      toast({
        title: "Failed to save induction",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
    },
  });

  const toggleAcknowledge = (itemId: string) => {
    setResponses((prev) => {
      const next = new Map(prev);
      const r = next.get(itemId);
      if (r) next.set(itemId, { ...r, acknowledged: !r.acknowledged });
      return next;
    });
  };

  const setNotes = (itemId: string, notes: string) => {
    setResponses((prev) => {
      const next = new Map(prev);
      const r = next.get(itemId);
      if (r) next.set(itemId, { ...r, notes });
      return next;
    });
  };

  const uploadPhotoForItem = async (itemId: string, file: File) => {
    setResponses((prev) => {
      const next = new Map(prev);
      const r = next.get(itemId);
      if (r) next.set(itemId, { ...r, uploading: true });
      return next;
    });

    try {
      let toUpload: File = file;
      if (file.type.startsWith("image/")) {
        try {
          toUpload = await compressImage(file);
        } catch {
          toUpload = file;
        }
      }
      const formData = new FormData();
      formData.append("photo", toUpload);

      const response = await fetch("/api/induction-photos", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      const json = await response.json();
      const url = json?.data?.url as string | undefined;
      if (!url) throw new Error("Upload did not return a URL");

      setResponses((prev) => {
        const next = new Map(prev);
        const r = next.get(itemId);
        if (r) {
          next.set(itemId, {
            ...r,
            photos: [...r.photos, url],
            uploading: false,
          });
        }
        return next;
      });
    } catch (error) {
      setResponses((prev) => {
        const next = new Map(prev);
        const r = next.get(itemId);
        if (r) next.set(itemId, { ...r, uploading: false });
        return next;
      });
      toast({
        title: "Photo upload failed",
        description:
          error instanceof Error ? error.message : "Try again",
        variant: "destructive",
      });
    }
  };

  const removePhoto = (itemId: string, idx: number) => {
    setResponses((prev) => {
      const next = new Map(prev);
      const r = next.get(itemId);
      if (r) {
        const photos = r.photos.filter((_, i) => i !== idx);
        next.set(itemId, { ...r, photos });
      }
      return next;
    });
  };

  const grouped = items.reduce(
    (acc, item) => {
      const category = item.category || "General";
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    },
    {} as Record<string, InductionChecklistItem[]>,
  );

  const allAcknowledged =
    items.length > 0 &&
    Array.from(responses.values()).every((r) => r.acknowledged) &&
    Array.from(responses.values()).every(
      (r) => !r.requiresPhoto || r.photos.length > 0,
    );

  if (!templateId || !employeeId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">
          Missing employee or template in URL.
        </p>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading induction…</p>
      </div>
    );
  }

  if (currentStep === "intro") {
    const employeeName = employee
      ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim()
      : "this employee";

    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Equipment Induction
            </h1>
            <p className="text-muted-foreground">
              Walk {employeeName || "the employee"} through this induction
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{template.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {template.equipmentType && (
              <div>
                <Label className="text-xs">Equipment type</Label>
                <p className="capitalize">
                  {template.equipmentType.replace(/_/g, " ")}
                </p>
              </div>
            )}
            {template.description && (
              <div>
                <Label className="text-xs">Description</Label>
                <p className="text-sm">{template.description}</p>
              </div>
            )}
            <div>
              <Label className="text-xs">Steps</Label>
              <p className="text-sm">{items.length}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/settings/staff")}
            className="flex-1"
            data-testid="button-cancel-induction"
          >
            Cancel
          </Button>
          <Button
            onClick={() => setCurrentStep("checklist")}
            disabled={items.length === 0}
            className="flex-1"
            data-testid="button-begin-induction"
          >
            Begin
          </Button>
        </div>
      </div>
    );
  }

  if (currentStep === "checklist") {
    const ackCount = Array.from(responses.values()).filter(
      (r) => r.acknowledged,
    ).length;

    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{template.name}</h1>
          <p className="text-muted-foreground">
            Demonstrate each step and acknowledge when complete
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryItems]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoryItems.map((item) => {
                  const r = responses.get(item.id);
                  if (!r) return null;
                  return (
                    <div
                      key={item.id}
                      className="space-y-3 pb-4 border-b last:border-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-sm md:text-base flex-1">
                          {item.step}
                        </p>
                        {item.requiresPhoto && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            Photo required
                          </Badge>
                        )}
                      </div>

                      <Button
                        variant={r.acknowledged ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleAcknowledge(item.id)}
                        className="w-full min-h-10"
                        data-testid={`button-acknowledge-${item.id}`}
                      >
                        {r.acknowledged ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Demonstrated &amp; acknowledged
                          </>
                        ) : (
                          <>Mark as demonstrated</>
                        )}
                      </Button>

                      <div>
                        <Label
                          htmlFor={`notes-${item.id}`}
                          className="text-xs"
                        >
                          Notes (optional)
                        </Label>
                        <Textarea
                          id={`notes-${item.id}`}
                          value={r.notes}
                          onChange={(e) => setNotes(item.id, e.target.value)}
                          placeholder="Add any notes from the trainer…"
                          className="text-base md:text-sm"
                          data-testid={`textarea-notes-${item.id}`}
                        />
                      </div>

                      {item.requiresPhoto && (
                        <div className="space-y-2 bg-muted/50 p-3 rounded-md">
                          <Label
                            htmlFor={`photo-${item.id}`}
                            className="text-xs"
                          >
                            Photos
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {r.photos.map((url, idx) => (
                              <div
                                key={`${url}-${idx}`}
                                className="relative w-20 h-20 rounded overflow-hidden border"
                              >
                                <img
                                  src={url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={() => removePhoto(item.id, idx)}
                                  className="absolute top-0 right-0 bg-black/60 text-white p-1 rounded-bl"
                                  data-testid={`button-remove-photo-${item.id}-${idx}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              id={`photo-${item.id}`}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={r.uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  uploadPhotoForItem(item.id, file);
                                  e.target.value = "";
                                }
                              }}
                              data-testid={`input-photo-${item.id}`}
                            />
                            {r.uploading && (
                              <Upload className="w-4 h-4 animate-pulse text-muted-foreground" />
                            )}
                            {!r.uploading && r.photos.length > 0 && (
                              <CheckCircle2 className="w-5 h-5 text-green-600" />
                            )}
                          </div>
                          {r.requiresPhoto && r.photos.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              At least one photo is required for this step.
                            </p>
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
            onClick={() => setCurrentStep("intro")}
            className="flex-1"
            data-testid="button-back-intro"
          >
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep("signature")}
            disabled={!allAcknowledged}
            className="flex-1"
            data-testid="button-next-signature"
          >
            {allAcknowledged
              ? "Next: Signatures"
              : `Complete all (${ackCount}/${items.length})`}
          </Button>
        </div>
      </div>
    );
  }

  // Signature step
  const employeeFullName = employee
    ? `${employee.firstName || ""} ${employee.lastName || ""}`.trim()
    : "";

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6 max-w-2xl mx-auto w-full">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Sign-off</h1>
        <p className="text-muted-foreground">
          Both the employee and trainer must sign to complete the induction
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            placeholder="Any final observations or follow-up actions…"
            className="text-base md:text-sm"
            data-testid="textarea-overall-notes"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Employee signature{employeeFullName ? ` — ${employeeFullName}` : ""}
            {employeeSignature && (
              <Badge variant="default" className="ml-2">
                Captured
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SignaturePad onSave={(data) => setEmployeeSignature(data)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Trainer signature
            {trainerSignature && (
              <Badge variant="default" className="ml-2">
                Captured
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="trainer-name">Trainer name</Label>
            <Input
              id="trainer-name"
              value={trainerName}
              onChange={(e) => setTrainerName(e.target.value)}
              placeholder="Trainer's full name"
              className="text-base md:text-sm"
              data-testid="input-trainer-name"
            />
          </div>
          <SignaturePad onSave={(data) => setTrainerSignature(data)} />
        </CardContent>
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background py-4 border-t">
        <Button
          variant="outline"
          onClick={() => setCurrentStep("checklist")}
          className="flex-1"
          data-testid="button-back-checklist"
        >
          Back
        </Button>
        <Button
          onClick={() => createInductionMutation.mutate()}
          disabled={
            !employeeSignature ||
            !trainerSignature ||
            !trainerName.trim() ||
            createInductionMutation.isPending
          }
          className="flex-1"
          data-testid="button-submit-induction"
        >
          {createInductionMutation.isPending
            ? "Saving…"
            : "Complete Induction"}
        </Button>
      </div>
    </div>
  );
}
