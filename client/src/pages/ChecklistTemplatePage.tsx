import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, GripVertical, ListChecks } from "lucide-react";
import { Link } from "wouter";
import type { ChecklistTemplate } from "@shared/schema";

export default function ChecklistTemplatePage() {
  const { toast } = useToast();
  const [newItemText, setNewItemText] = useState("");

  const { data, isLoading } = useQuery<{ success: boolean; data: ChecklistTemplate[] }>({
    queryKey: ["/api/checklist-templates"],
  });

  const templates = data?.data ?? [];

  const addMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest("POST", "/api/checklist-templates", { text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-templates"] });
      setNewItemText("");
    },
    onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/checklist-templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/checklist-templates"] });
    },
    onError: () => toast({ title: "Failed to delete task", variant: "destructive" }),
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    addMutation.mutate(newItemText.trim());
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Default Job Checklist</h1>
          <p className="text-sm text-gray-500">These tasks automatically appear in every new job card</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-green-600" />
            Template Tasks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="text-sm text-gray-400 py-4 text-center">Loading...</div>
          )}

          {!isLoading && templates.length === 0 && (
            <div className="text-sm text-gray-400 py-6 text-center">
              No tasks yet — add your first one below.
            </div>
          )}

          {templates.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg group"
            >
              <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
              <div className="w-4 h-4 rounded border-2 border-gray-300 flex-shrink-0" />
              <span className="flex-1 text-sm text-gray-700">{item.text}</span>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600"
                onClick={() => deleteMutation.mutate(item.id)}
                disabled={deleteMutation.isPending}
                aria-label="Delete checklist item"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <form onSubmit={handleAdd} className="flex items-center gap-2 pt-2">
            <Input
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Add a task to the default checklist..."
              className="flex-1"
              autoComplete="off"
            />
            <Button
              type="submit"
              disabled={!newItemText.trim() || addMutation.isPending}
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <strong>How it works:</strong> When you create a new job, these tasks are automatically pre-loaded into the Job Scope checklist. You can still add or remove tasks on individual job cards without affecting this template.
      </div>
    </div>
  );
}
