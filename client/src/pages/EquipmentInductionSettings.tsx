import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  GraduationCap,
  Plus,
  Edit,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  InductionTemplate,
  InductionChecklistItem,
  InsertInductionTemplate,
  InsertInductionChecklistItem,
} from "@shared/schema";

const EQUIPMENT_TYPES = [
  "bucket_truck",
  "chainsaw",
  "chipper",
  "stump_grinder",
  "safety_gear",
  "crane",
  "dump_truck",
  "generator",
  "wood_splitter",
];

function SortableInductionItem({
  item,
  onEdit,
  onDelete,
}: {
  item: InductionChecklistItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 bg-white border rounded-md"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.step}</span>
          {item.category && (
            <Badge variant="outline" className="text-xs">
              {item.category}
            </Badge>
          )}
        </div>
        {item.requiresPhoto && (
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
            <Badge variant="secondary" className="text-xs">
              Photo required
            </Badge>
          </div>
        )}
      </div>

      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          data-testid={`button-edit-induction-item-${item.id}`}
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          data-testid={`button-delete-induction-item-${item.id}`}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export default function EquipmentInductionSettings() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] =
    useState<InductionTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<
    Partial<InsertInductionTemplate> & { id?: string }
  >({});
  const [editingItem, setEditingItem] = useState<
    Partial<InsertInductionChecklistItem> & { id?: string }
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { data: templatesData } = useQuery({
    queryKey: ["/api/induction-templates"],
  });
  const templates: InductionTemplate[] = Array.isArray(
    (templatesData as any)?.data,
  )
    ? (templatesData as any).data
    : [];

  const { data: checklistItemsData } = useQuery({
    queryKey: ["/api/induction-templates", selectedTemplate?.id, "items"],
    enabled: !!selectedTemplate?.id,
  });
  const checklistItems: InductionChecklistItem[] = Array.isArray(
    (checklistItemsData as any)?.data,
  )
    ? (checklistItemsData as any).data
    : [];

  const createTemplateMutation = useMutation({
    mutationFn: (data: InsertInductionTemplate) =>
      apiRequest("POST", "/api/induction-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates"],
      });
      setTemplateDialogOpen(false);
      setEditingTemplate({});
    },
    onError: () => {
      toast({ title: "Failed to create template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertInductionTemplate>;
    }) => apiRequest("PATCH", `/api/induction-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates"],
      });
      setTemplateDialogOpen(false);
      setEditingTemplate({});
    },
    onError: () => {
      toast({ title: "Failed to update template", variant: "destructive" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/induction-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates"],
      });
      if (selectedTemplate) {
        setSelectedTemplate(null);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: (data: InsertInductionChecklistItem) =>
      apiRequest(
        "POST",
        `/api/induction-templates/${selectedTemplate?.id}/items`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates", selectedTemplate?.id, "items"],
      });
      setItemDialogOpen(false);
      setEditingItem({});
    },
    onError: () => {
      toast({ title: "Failed to add step", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertInductionChecklistItem>;
    }) => apiRequest("PATCH", `/api/induction-checklist-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates", selectedTemplate?.id, "items"],
      });
      setItemDialogOpen(false);
      setEditingItem({});
    },
    onError: () => {
      toast({ title: "Failed to update step", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/induction-checklist-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates", selectedTemplate?.id, "items"],
      });
    },
    onError: () => {
      toast({ title: "Failed to delete step", variant: "destructive" });
    },
  });

  const reorderItemsMutation = useMutation({
    mutationFn: ({
      templateId,
      itemIds,
    }: {
      templateId: string;
      itemIds: string[];
    }) =>
      apiRequest("POST", `/api/induction-templates/${templateId}/reorder`, {
        itemIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/induction-templates", selectedTemplate?.id, "items"],
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = checklistItems.findIndex(
        (item) => item.id === active.id,
      );
      const newIndex = checklistItems.findIndex(
        (item) => item.id === over.id,
      );
      const reorderedItems = arrayMove(checklistItems, oldIndex, newIndex);
      const itemIds = reorderedItems.map((item) => item.id);
      if (selectedTemplate) {
        reorderItemsMutation.mutate({
          templateId: selectedTemplate.id,
          itemIds,
        });
      }
    }
  };

  const handleSaveTemplate = () => {
    if (editingTemplate.id) {
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        data: editingTemplate,
      });
    } else {
      createTemplateMutation.mutate(
        editingTemplate as InsertInductionTemplate,
      );
    }
  };

  const handleSaveItem = () => {
    if (editingItem.id) {
      updateItemMutation.mutate({ id: editingItem.id, data: editingItem });
    } else {
      const nextOrder =
        checklistItems.length > 0
          ? Math.max(...checklistItems.map((i) => i.sortOrder)) + 1
          : 0;
      createItemMutation.mutate({
        ...editingItem,
        sortOrder: nextOrder,
      } as InsertInductionChecklistItem);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Equipment Induction Templates
          </h1>
          <p className="text-muted-foreground">
            Build induction checklists for each piece of equipment your team uses
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate({});
            setTemplateDialogOpen(true);
          }}
          data-testid="button-add-induction-template"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates yet</p>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id
                      ? "bg-primary/10 border border-primary"
                      : "bg-muted hover-elevate"
                  }`}
                  onClick={() => setSelectedTemplate(template)}
                  data-testid={`card-induction-template-${template.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                      </div>
                      {template.equipmentType && (
                        <p className="text-xs text-muted-foreground mt-1 capitalize">
                          {template.equipmentType.replace(/_/g, " ")}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplate(template);
                          setTemplateDialogOpen(true);
                        }}
                        data-testid={`button-edit-induction-template-${template.id}`}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this template?")) {
                            deleteTemplateMutation.mutate(template.id);
                          }
                        }}
                        data-testid={`button-delete-induction-template-${template.id}`}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedTemplate
                  ? `${selectedTemplate.name} — Steps`
                  : "Select a template"}
              </CardTitle>
              {selectedTemplate && (
                <Button
                  onClick={() => {
                    setEditingItem({});
                    setItemDialogOpen(true);
                  }}
                  size="sm"
                  data-testid="button-add-induction-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Step
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTemplate ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <GraduationCap className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Select a template to view its steps
                </p>
              </div>
            ) : checklistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No steps yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setEditingItem({});
                    setItemDialogOpen(true);
                  }}
                  data-testid="button-add-first-induction-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Step
                </Button>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={checklistItems.map((i) => i.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {checklistItems.map((item) => (
                      <SortableInductionItem
                        key={item.id}
                        item={item}
                        onEdit={() => {
                          setEditingItem(item);
                          setItemDialogOpen(true);
                        }}
                        onDelete={() => {
                          if (confirm("Delete this step?")) {
                            deleteItemMutation.mutate(item.id);
                          }
                        }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate.id ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              Configure the induction template details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={editingTemplate.name || ""}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    name: e.target.value,
                  })
                }
                placeholder="e.g., Chainsaw Induction"
                data-testid="input-induction-template-name"
              />
            </div>
            <div>
              <Label htmlFor="equipmentType">Equipment Type</Label>
              <Select
                value={editingTemplate.equipmentType || ""}
                onValueChange={(value) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    equipmentType: value,
                  })
                }
              >
                <SelectTrigger data-testid="select-induction-equipment-type">
                  <SelectValue placeholder="Select equipment type" />
                </SelectTrigger>
                <SelectContent>
                  {EQUIPMENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className="capitalize">
                        {type.replace(/_/g, " ")}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={editingTemplate.description || ""}
                onChange={(e) =>
                  setEditingTemplate({
                    ...editingTemplate,
                    description: e.target.value,
                  })
                }
                placeholder="What does this induction cover..."
                data-testid="textarea-induction-template-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
              data-testid="button-cancel-induction-template"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!editingTemplate.name}
              data-testid="button-save-induction-template"
            >
              {editingTemplate.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem.id ? "Edit Step" : "New Step"}
            </DialogTitle>
            <DialogDescription>
              Add a step to the induction checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="step">Step</Label>
              <Textarea
                id="step"
                value={editingItem.step || ""}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, step: e.target.value })
                }
                placeholder="e.g., Demonstrate correct two-handed grip"
                data-testid="input-induction-step-text"
              />
            </div>
            <div>
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                value={editingItem.category || ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    category: e.target.value,
                  })
                }
                placeholder="e.g., Safety, Operation, Shutdown"
                data-testid="input-induction-category"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requiresPhoto"
                checked={editingItem.requiresPhoto || false}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    requiresPhoto: e.target.checked,
                  })
                }
                className="rounded"
                data-testid="checkbox-induction-requires-photo"
              />
              <Label htmlFor="requiresPhoto" className="cursor-pointer">
                Require a photo for this step
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemDialogOpen(false)}
              data-testid="button-cancel-induction-item"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={!editingItem.step}
              data-testid="button-save-induction-item"
            >
              {editingItem.id ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
