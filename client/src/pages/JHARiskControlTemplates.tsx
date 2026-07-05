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
  DialogTrigger 
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Trash2, Shield, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

interface JhaRiskControlTemplate {
  id: string;
  name: string;
  description?: string | null;
  hierarchyLevel: number;
  isActive: boolean;
  sortOrder: number;
}

export default function JHARiskControlTemplates() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<JhaRiskControlTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    hierarchyLevel: 3,
    sortOrder: 0
  });

  const { data: templates, isLoading } = useQuery({
    queryKey: ["/api/jha/risk-control-templates"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => 
      apiRequest("POST", "/api/jha/risk-control-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jha/risk-control-templates"] });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) => 
      apiRequest("PATCH", `/api/jha/risk-control-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jha/risk-control-templates"] });
      setShowDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest("DELETE", `/api/jha/risk-control-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jha/risk-control-templates"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      hierarchyLevel: 3,
      sortOrder: 0
    });
    setSelectedTemplate(null);
  };

  const handleSave = () => {
    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (template: JhaRiskControlTemplate) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || "",
      hierarchyLevel: template.hierarchyLevel,
      sortOrder: template.sortOrder
    });
    setShowDialog(true);
  };

  const hierarchyLevelNames: Record<number, string> = {
    1: "Most Effective",
    2: "Highly Effective",
    3: "Moderately Effective",
    4: "Less Effective",
    5: "Least Effective"
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/settings")}
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Settings
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Risk Control Templates</h1>
          <p className="text-muted-foreground">
            Manage risk control options for the hierarchy of controls dropdown
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={(open) => {
          setShowDialog(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button 
              data-testid="button-create-template"
              onClick={() => {
                resetForm();
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Risk Control
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {selectedTemplate ? "Edit Risk Control Template" : "Create Risk Control Template"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="control-name">Name *</Label>
                <Input
                  id="control-name"
                  data-testid="input-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Elimination, Substitution"
                />
              </div>
              <div>
                <Label htmlFor="control-description">Description</Label>
                <Textarea
                  id="control-description"
                  data-testid="input-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe when to use this control type..."
                />
              </div>
              <div>
                <Label htmlFor="hierarchy-level">Hierarchy Level *</Label>
                <Select
                  value={formData.hierarchyLevel.toString()}
                  onValueChange={(value) => setFormData({ ...formData, hierarchyLevel: parseInt(value) })}
                >
                  <SelectTrigger id="hierarchy-level" data-testid="select-hierarchy">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Most Effective (Elimination)</SelectItem>
                    <SelectItem value="2">2 - Highly Effective (Substitution)</SelectItem>
                    <SelectItem value="3">3 - Moderately Effective (Engineering)</SelectItem>
                    <SelectItem value="4">4 - Less Effective (Administrative)</SelectItem>
                    <SelectItem value="5">5 - Least Effective (PPE)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Lower numbers = more effective controls
                </p>
              </div>
              <div>
                <Label htmlFor="sort-order">Sort Order</Label>
                <Input
                  id="sort-order"
                  type="number"
                  data-testid="input-sort-order"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDialog(false);
                    resetForm();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave}
                  disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save"
                >
                  {selectedTemplate ? "Update" : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Risk Control Options</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : templates?.data?.length === 0 ? (
            <p className="text-muted-foreground">No risk control templates yet</p>
          ) : (
            <div className="space-y-2">
              {templates?.data
                ?.sort((a: JhaRiskControlTemplate, b: JhaRiskControlTemplate) => 
                  a.sortOrder - b.sortOrder || a.hierarchyLevel - b.hierarchyLevel
                )
                .map((template: JhaRiskControlTemplate) => (
                  <div
                    key={template.id}
                    data-testid={`template-item-${template.id}`}
                    className="p-4 rounded-md border hover-elevate"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <Shield className="h-5 w-5 text-primary" />
                          <div>
                            <h3 className="font-medium">{template.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                                Level {template.hierarchyLevel}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {hierarchyLevelNames[template.hierarchyLevel]}
                              </span>
                            </div>
                          </div>
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-2 ml-8">
                            {template.description}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Edit template"
                          data-testid={`button-edit-${template.id}`}
                          onClick={() => handleEdit(template)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Delete template"
                          data-testid={`button-delete-${template.id}`}
                          onClick={() => {
                            if (confirm(`Delete "${template.name}"?`)) {
                              deleteMutation.mutate(template.id);
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

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">About Hierarchy of Controls</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            The hierarchy of controls is a system used in safety to minimize or eliminate exposure to hazards. 
            Controls are ranked from most effective to least effective:
          </p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li><strong>Elimination</strong> - Physically remove the hazard</li>
            <li><strong>Substitution</strong> - Replace the hazard with something less dangerous</li>
            <li><strong>Engineering Controls</strong> - Isolate people from the hazard</li>
            <li><strong>Administrative Controls</strong> - Change the way people work</li>
            <li><strong>PPE</strong> - Protect the worker with Personal Protective Equipment</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
