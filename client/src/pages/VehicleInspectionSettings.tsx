import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  ClipboardCheck,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Check,
  X,
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
  SelectInspectionTemplate,
  SelectInspectionChecklistItem,
  InsertInspectionTemplate,
  InsertInspectionChecklistItem,
} from "@shared/schema";

function SortableChecklistItem({
  item,
  onEdit,
  onDelete,
}: {
  item: SelectInspectionChecklistItem;
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
          <span className="font-medium">{item.question}</span>
          {item.category && (
            <Badge variant="outline" className="text-xs">
              {item.category}
            </Badge>
          )}
        </div>
        <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
          {item.requiresComment && (
            <Badge variant="secondary" className="text-xs">
              Comment
            </Badge>
          )}
          {item.requiresPhoto && (
            <Badge variant="secondary" className="text-xs">
              Photo
            </Badge>
          )}
        </div>
      </div>

      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          onClick={onEdit}
          data-testid={`button-edit-item-${item.id}`}
        >
          <Edit className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          data-testid={`button-delete-item-${item.id}`}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

export default function VehicleInspectionSettings() {
  const { toast } = useToast();
  const [selectedTemplate, setSelectedTemplate] =
    useState<SelectInspectionTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<
    Partial<InsertInspectionTemplate>
  >({});
  const [editingItem, setEditingItem] = useState<
    Partial<InsertInspectionChecklistItem>
  >({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ["/api/inspection-templates"],
  });
  const templates = Array.isArray((templatesData as any)?.data)
    ? (templatesData as any).data
    : [];

  // Fetch checklist items for selected template
  const { data: checklistItemsData } = useQuery({
    queryKey: ["/api/inspection-templates", selectedTemplate?.id, "items"],
    enabled: !!selectedTemplate?.id,
  });
  const checklistItems = Array.isArray((checklistItemsData as any)?.data)
    ? (checklistItemsData as any).data
    : [];

  // Template mutations
  const createTemplateMutation = useMutation({
    mutationFn: (data: InsertInspectionTemplate) =>
      apiRequest("POST", "/api/inspection-templates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates"],
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
      data: Partial<InsertInspectionTemplate>;
    }) => apiRequest("PATCH", `/api/inspection-templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates"],
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
      apiRequest("DELETE", `/api/inspection-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates"],
      });
      if (selectedTemplate) {
        setSelectedTemplate(null);
      }
    },
    onError: () => {
      toast({ title: "Failed to delete template", variant: "destructive" });
    },
  });

  const setDefaultTemplateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("PATCH", `/api/inspection-templates/${id}/set-default`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates"],
      });
    },
    onError: () => {
      toast({
        title: "Failed to set default template",
        variant: "destructive",
      });
    },
  });

  // Checklist item mutations
  const createItemMutation = useMutation({
    mutationFn: (data: InsertInspectionChecklistItem) =>
      apiRequest(
        "POST",
        `/api/inspection-templates/${selectedTemplate?.id}/items`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates", selectedTemplate?.id, "items"],
      });
      setItemDialogOpen(false);
      setEditingItem({});
    },
    onError: () => {
      toast({ title: "Failed to add checklist item", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<InsertInspectionChecklistItem>;
    }) => apiRequest("PATCH", `/api/checklist-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates", selectedTemplate?.id, "items"],
      });
      setItemDialogOpen(false);
      setEditingItem({});
    },
    onError: () => {
      toast({
        title: "Failed to update checklist item",
        variant: "destructive",
      });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/checklist-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates", selectedTemplate?.id, "items"],
      });
    },
    onError: () => {
      toast({
        title: "Failed to delete checklist item",
        variant: "destructive",
      });
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
      apiRequest("POST", `/api/inspection-templates/${templateId}/reorder`, {
        itemIds,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/inspection-templates", selectedTemplate?.id, "items"],
      });
    },
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = checklistItems.findIndex(
        (item) => item.id === active.id,
      );
      const newIndex = checklistItems.findIndex((item) => item.id === over.id);

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
        editingTemplate as InsertInspectionTemplate,
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
      } as InsertInspectionChecklistItem);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">
            Vehicle Inspection Templates
          </h1>
          <p className="text-muted-foreground">
            Manage pre-start inspection checklists
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingTemplate({});
            setTemplateDialogOpen(true);
          }}
          data-testid="button-add-template"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates List */}
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
                  data-testid={`card-template-${template.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        {template.isDefault && (
                          <Badge variant="default" className="text-xs">
                            Default
                          </Badge>
                        )}
                      </div>
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
                        data-testid={`button-edit-template-${template.id}`}
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
                        data-testid={`button-delete-template-${template.id}`}
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

        {/* Checklist Items */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedTemplate
                  ? `${selectedTemplate.name} - Checklist Items`
                  : "Select a template"}
              </CardTitle>
              {selectedTemplate && (
                <div className="flex gap-2">
                  {!selectedTemplate.isDefault && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setDefaultTemplateMutation.mutate(selectedTemplate.id)
                      }
                      data-testid="button-set-default"
                    >
                      Set as Default
                    </Button>
                  )}
                  <Button
                    onClick={() => {
                      setEditingItem({});
                      setItemDialogOpen(true);
                    }}
                    size="sm"
                    data-testid="button-add-item"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Item
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTemplate ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  Select a template to view checklist items
                </p>
              </div>
            ) : checklistItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground">No checklist items yet</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setEditingItem({});
                    setItemDialogOpen(true);
                  }}
                  data-testid="button-add-first-item"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Item
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
                      <SortableChecklistItem
                        key={item.id}
                        item={item}
                        onEdit={() => {
                          setEditingItem(item);
                          setItemDialogOpen(true);
                        }}
                        onDelete={() => {
                          if (confirm("Delete this item?")) {
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

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate.id ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              Configure the inspection template details
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
                placeholder="e.g., Standard Vehicle Pre-Start"
                data-testid="input-template-name"
              />
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
                placeholder="Template description..."
                data-testid="textarea-template-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTemplateDialogOpen(false)}
              data-testid="button-cancel-template"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!editingTemplate.name}
              data-testid="button-save-template"
            >
              {editingTemplate.id ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingItem.id ? "Edit Checklist Item" : "New Checklist Item"}
            </DialogTitle>
            <DialogDescription>
              Add an item to the inspection checklist
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                value={editingItem.question || ""}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, question: e.target.value })
                }
                placeholder="e.g., Are all lights working?"
                data-testid="input-question-text"
              />
            </div>
            <div>
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                value={editingItem.category || ""}
                onChange={(e) =>
                  setEditingItem({ ...editingItem, category: e.target.value })
                }
                placeholder="e.g., Exterior, Engine, Safety"
                data-testid="input-category"
              />
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="requiresComment"
                checked={editingItem.requiresComment || false}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    requiresComment: e.target.checked,
                  })
                }
                className="rounded"
                data-testid="checkbox-requires-comment"
              />
              <Label htmlFor="requiresComment" className="cursor-pointer">
                Require comment for NO answer
              </Label>
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
                data-testid="checkbox-requires-photo"
              />
              <Label htmlFor="requiresPhoto" className="cursor-pointer">
                Require photo for NO answer
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setItemDialogOpen(false)}
              data-testid="button-cancel-item"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveItem}
              disabled={!editingItem.question}
              data-testid="button-save-item"
            >
              {editingItem.id ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
