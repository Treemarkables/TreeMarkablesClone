import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Plus, Edit2, Trash2, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface JhaHazardTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface JhaControlMeasureTemplate {
  id: string;
  hazardTemplateId?: string | null;
  description: string;
  hierarchyLevel: number;
  riskReduction?: number | null;
  isActive: boolean;
  sortOrder: number;
}

export default function JHATemplates() {
  const { toast } = useToast();
  const [showHazardDialog, setShowHazardDialog] = useState(false);
  const [showControlDialog, setShowControlDialog] = useState(false);
  const [selectedHazard, setSelectedHazard] =
    useState<JhaHazardTemplate | null>(null);
  const [selectedControl, setSelectedControl] =
    useState<JhaControlMeasureTemplate | null>(null);

  const [hazardForm, setHazardForm] = useState({
    name: "",
    description: "",
    category: "",
  });

  const [controlForm, setControlForm] = useState({
    description: "",
    hierarchyLevel: 3,
    riskReduction: 1,
  });

  const { data: hazards, isLoading: loadingHazards } = useQuery({
    queryKey: ["/api/jha/hazard-templates"],
  });

  const { data: controls, isLoading: loadingControls } = useQuery({
    queryKey: [
      `/api/jha/control-measures?hazardTemplateId=${selectedHazard?.id}`,
    ],
    enabled: !!selectedHazard,
  });

  const createHazardMutation = useMutation({
    mutationFn: (data: typeof hazardForm) =>
      apiRequest("POST", "/api/jha/hazard-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jha/hazard-templates"],
      });
      setShowHazardDialog(false);
      setHazardForm({ name: "", description: "", category: "" });
    },
    onError: () => {
      toast({
        title: "Failed to create hazard template",
        variant: "destructive",
      });
    },
  });

  const updateHazardMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof hazardForm }) =>
      apiRequest("PATCH", `/api/jha/hazard-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jha/hazard-templates"],
      });
      setShowHazardDialog(false);
      setSelectedHazard(null);
    },
    onError: () => {
      toast({
        title: "Failed to update hazard template",
        variant: "destructive",
      });
    },
  });

  const deleteHazardMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/jha/hazard-templates/${id}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jha/hazard-templates"],
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete hazard template",
        variant: "destructive",
      });
    },
  });

  // The controls list query key embeds the hazard id as a URL query string
  // ("/api/jha/control-measures?hazardTemplateId=..."), which makes a plain
  // invalidateQueries({ queryKey: ["/api/jha/control-measures"] }) miss.
  // Also refresh /api/jha/hazard-templates because that endpoint returns
  // each template's controls nested inline — the JHA form reads from it.
  const refreshControlCaches = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const key = q.queryKey[0];
        return (
          typeof key === "string" &&
          (key.startsWith("/api/jha/control-measures") ||
            key === "/api/jha/hazard-templates")
        );
      },
      refetchType: "active",
    });
  };

  // Directly patch the cached list for the currently-selected hazard so the
  // new control appears immediately, without waiting for the refetch.
  const patchControlsCache = (
    hazardId: string,
    updater: (list: JhaControlMeasureTemplate[]) => JhaControlMeasureTemplate[],
  ) => {
    const key = [`/api/jha/control-measures?hazardTemplateId=${hazardId}`];
    queryClient.setQueryData<
      { success: boolean; data: JhaControlMeasureTemplate[] } | undefined
    >(key, (prev) => {
      if (!prev?.data) return prev;
      return { ...prev, data: updater(prev.data) };
    });
  };

  const createControlMutation = useMutation({
    mutationFn: async (
      data: typeof controlForm & { hazardTemplateId: string },
    ) => {
      const res = await apiRequest("POST", "/api/jha/control-measures", data);
      const json: { success: boolean; data: JhaControlMeasureTemplate } =
        await res.json();
      return json.data;
    },
    onSuccess: (newControl, variables) => {
      patchControlsCache(variables.hazardTemplateId, (list) => [
        ...list,
        newControl,
      ]);
      refreshControlCaches();
      setShowControlDialog(false);
      setControlForm({ description: "", hierarchyLevel: 3, riskReduction: 1 });
    },
    onError: () => {
      toast({
        title: "Failed to create control measure",
        variant: "destructive",
      });
    },
  });

  const updateControlMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<typeof controlForm>;
    }) => {
      const res = await apiRequest(
        "PATCH",
        `/api/jha/control-measures/${id}`,
        data,
      );
      const json: { success: boolean; data: JhaControlMeasureTemplate } =
        await res.json();
      return json.data;
    },
    onSuccess: (updated) => {
      if (selectedHazard) {
        patchControlsCache(selectedHazard.id, (list) =>
          list.map((c) => (c.id === updated.id ? updated : c)),
        );
      }
      refreshControlCaches();
      setShowControlDialog(false);
      setSelectedControl(null);
    },
    onError: () => {
      toast({
        title: "Failed to update control measure",
        variant: "destructive",
      });
    },
  });

  const deleteControlMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/jha/control-measures/${id}`, {}),
    onSuccess: (_res, deletedId) => {
      if (selectedHazard) {
        patchControlsCache(selectedHazard.id, (list) =>
          list.filter((c) => c.id !== deletedId),
        );
      }
      refreshControlCaches();
    },
    onError: () => {
      toast({
        title: "Failed to delete control measure",
        variant: "destructive",
      });
    },
  });

  const handleSaveHazard = () => {
    if (selectedHazard) {
      updateHazardMutation.mutate({ id: selectedHazard.id, data: hazardForm });
    } else {
      createHazardMutation.mutate(hazardForm);
    }
  };

  const handleSaveControl = () => {
    if (!selectedHazard) return;

    if (selectedControl) {
      updateControlMutation.mutate({
        id: selectedControl.id,
        data: controlForm,
      });
    } else {
      createControlMutation.mutate({
        ...controlForm,
        hazardTemplateId: selectedHazard.id,
      });
    }
  };

  const hierarchyLabels: Record<number, string> = {
    1: "Elimination",
    2: "Substitution",
    3: "Engineering Controls",
    4: "Administrative Controls",
    5: "Personal Protective Equipment (PPE)",
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="self-start"
        data-testid="button-back-to-settings"
      >
        <Link href="/settings" className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
      </Button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Hazard Analysis Templates</h1>
          <p className="text-muted-foreground">
            Manage hazard templates and control measures for safety assessments
          </p>
        </div>
        <Dialog open={showHazardDialog} onOpenChange={setShowHazardDialog}>
          <DialogTrigger asChild>
            <Button
              data-testid="button-create-hazard-template"
              onClick={() => {
                setSelectedHazard(null);
                setHazardForm({ name: "", description: "", category: "" });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Hazard Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedHazard
                  ? "Edit Hazard Template"
                  : "Create Hazard Template"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="hazard-name">Hazard Name</Label>
                <Input
                  id="hazard-name"
                  data-testid="input-hazard-name"
                  value={hazardForm.name}
                  onChange={(e) =>
                    setHazardForm({ ...hazardForm, name: e.target.value })
                  }
                  placeholder="e.g., Falling Debris"
                />
              </div>
              <div>
                <Label htmlFor="hazard-description">Description</Label>
                <Textarea
                  id="hazard-description"
                  data-testid="input-hazard-description"
                  value={hazardForm.description}
                  onChange={(e) =>
                    setHazardForm({
                      ...hazardForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="Describe the hazard..."
                />
              </div>
              <div>
                <Label htmlFor="hazard-category">Category</Label>
                <Input
                  id="hazard-category"
                  data-testid="input-hazard-category"
                  value={hazardForm.category}
                  onChange={(e) =>
                    setHazardForm({ ...hazardForm, category: e.target.value })
                  }
                  placeholder="e.g., Tree Work, Equipment"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowHazardDialog(false)}
                  data-testid="button-cancel-hazard"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveHazard}
                  disabled={!hazardForm.name}
                  data-testid="button-save-hazard"
                >
                  Save
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Hazard Templates</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHazards ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : hazards?.data?.length === 0 ? (
              <p className="text-muted-foreground">No hazard templates yet</p>
            ) : (
              <div className="space-y-2">
                {hazards?.data?.map((hazard: JhaHazardTemplate) => (
                  <div
                    key={hazard.id}
                    data-testid={`hazard-item-${hazard.id}`}
                    className={`p-3 rounded-md border cursor-pointer hover-elevate ${
                      selectedHazard?.id === hazard.id
                        ? "border-primary bg-primary/5"
                        : ""
                    }`}
                    onClick={() => setSelectedHazard(hazard)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <h3 className="font-medium">{hazard.name}</h3>
                        </div>
                        {hazard.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {hazard.description}
                          </p>
                        )}
                        {hazard.category && (
                          <span className="text-xs text-muted-foreground mt-1">
                            Category: {hazard.category}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-edit-hazard-${hazard.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHazard(hazard);
                            setHazardForm({
                              name: hazard.name,
                              description: hazard.description || "",
                              category: hazard.category || "",
                            });
                            setShowHazardDialog(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-delete-hazard-${hazard.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Delete this hazard template?")) {
                              deleteHazardMutation.mutate(hazard.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedHazard
                  ? `Control Measures - ${selectedHazard.name}`
                  : "Control Measures"}
              </CardTitle>
              {selectedHazard && (
                <Dialog
                  open={showControlDialog}
                  onOpenChange={setShowControlDialog}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      data-testid="button-add-control-measure"
                      onClick={() => {
                        setSelectedControl(null);
                        setControlForm({
                          description: "",
                          hierarchyLevel: 3,
                          riskReduction: 1,
                        });
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Control
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>
                        {selectedControl
                          ? "Edit Control Measure"
                          : "Add Control Measure"}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="control-description">
                          Control Measure
                        </Label>
                        <Textarea
                          id="control-description"
                          data-testid="input-control-description"
                          value={controlForm.description}
                          onChange={(e) =>
                            setControlForm({
                              ...controlForm,
                              description: e.target.value,
                            })
                          }
                          placeholder="e.g., Wear the correct P.P.E. for the job"
                        />
                      </div>
                      <div>
                        <Label htmlFor="hierarchy-level">
                          Hierarchy of Controls
                        </Label>
                        <Select
                          value={controlForm.hierarchyLevel.toString()}
                          onValueChange={(value) =>
                            setControlForm({
                              ...controlForm,
                              hierarchyLevel: parseInt(value),
                            })
                          }
                        >
                          <SelectTrigger data-testid="select-hierarchy-level">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(hierarchyLabels).map(
                              ([level, label]) => (
                                <SelectItem key={level} value={level}>
                                  {level}. {label}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="risk-reduction">
                          Risk Reduction Level (1-5)
                        </Label>
                        <Input
                          id="risk-reduction"
                          type="number"
                          min="1"
                          max="5"
                          data-testid="input-risk-reduction"
                          value={controlForm.riskReduction}
                          onChange={(e) =>
                            setControlForm({
                              ...controlForm,
                              riskReduction: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setShowControlDialog(false)}
                          data-testid="button-cancel-control"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSaveControl}
                          disabled={!controlForm.description}
                          data-testid="button-save-control"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedHazard ? (
              <p className="text-muted-foreground">
                Select a hazard template to view its control measures
              </p>
            ) : loadingControls ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : controls?.data?.length === 0 ? (
              <p className="text-muted-foreground">No control measures yet</p>
            ) : (
              <div className="space-y-2">
                {controls?.data?.map((control: JhaControlMeasureTemplate) => (
                  <div
                    key={control.id}
                    data-testid={`control-item-${control.id}`}
                    className="p-3 rounded-md border hover-elevate"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <Checkbox checked className="mr-2 align-top" />
                        <span className="text-sm">{control.description}</span>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Level {control.hierarchyLevel}:{" "}
                          {hierarchyLabels[control.hierarchyLevel]}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-edit-control-${control.id}`}
                          onClick={() => {
                            setSelectedControl(control);
                            setControlForm({
                              description: control.description,
                              hierarchyLevel: control.hierarchyLevel,
                              riskReduction: control.riskReduction || 1,
                            });
                            setShowControlDialog(true);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-delete-control-${control.id}`}
                          onClick={() => {
                            if (confirm("Delete this control measure?")) {
                              deleteControlMutation.mutate(control.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
