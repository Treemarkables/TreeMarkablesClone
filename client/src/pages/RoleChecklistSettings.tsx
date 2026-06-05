import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, Redirect } from "wouter";
import { useRoleChecklistFeature } from "@/hooks/useRoleChecklistFeature";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  Shield,
  Camera,
  PhoneCall,
  TriangleAlert,
  ClipboardCheck,
  Clock,
  Star,
  Users,
  MessageSquare,
  Bell,
  Mail,
  MapPin,
  Wrench,
  TreePine,
  AlertTriangle,
  ListChecks,
  type LucideIcon,
} from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { RoleChecklistTask } from "@shared/schema";

// Curated icon set users can pick from. Keeping this finite (not the full lucide
// set) so the UI is fast and the rendered SVG is predictable. Add more here as
// real-world tasks demand them.
const ICON_OPTIONS: Record<string, LucideIcon> = {
  Check,
  Shield,
  Camera,
  PhoneCall,
  TriangleAlert,
  ClipboardCheck,
  Clock,
  Star,
  Users,
  MessageSquare,
  Bell,
  Mail,
  MapPin,
  Wrench,
  TreePine,
  AlertTriangle,
};

const ICON_NAMES = Object.keys(ICON_OPTIONS);

function renderIcon(name: string, className = "w-4 h-4") {
  const Icon = ICON_OPTIONS[name] ?? Check;
  return <Icon className={className} />;
}

type RoleKey = "A" | "B" | "C";

const ROLE_LABEL: Record<RoleKey, string> = {
  C: "Kaitiaki",
  A: "Kaiwhangai",
  B: "Kaitirotiro",
};

const ROLE_BLURB: Record<RoleKey, string> = {
  C: "Site leader — the worker holding overall responsibility for the day.",
  A: "Documentation — risk assessments, photos, content for the job record.",
  B: "Site supervisor — customer comms, signs, pre-start checks.",
};

// Order roles like the panel does: leader first, then docs, then supervisor.
const ROLE_KEYS: RoleKey[] = ["C", "A", "B"];

export default function RoleChecklistSettings() {
  // Treemarkables-only feature — block direct navigation for other tenants.
  const roleChecklistEnabled = useRoleChecklistFeature();
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState<Record<RoleKey, string>>({
    A: "",
    B: "",
    C: "",
  });
  const [newIcon, setNewIcon] = useState<Record<RoleKey, string>>({
    A: "Check",
    B: "Check",
    C: "Check",
  });

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: RoleChecklistTask[];
  }>({
    queryKey: ["/api/role-checklist-tasks"],
  });

  const tasks = data?.data ?? [];

  const tasksByRole: Record<RoleKey, RoleChecklistTask[]> = {
    A: [],
    B: [],
    C: [],
  };
  for (const t of tasks) {
    if (t.roleKey === "A" || t.roleKey === "B" || t.roleKey === "C") {
      tasksByRole[t.roleKey].push(t);
    }
  }

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/role-checklist-tasks"] });

  const addMutation = useMutation({
    mutationFn: (vars: { roleKey: RoleKey; label: string; iconName: string }) =>
      apiRequest("POST", "/api/role-checklist-tasks", vars),
    onSuccess: (_resp, vars) => {
      invalidate();
      setNewLabel((s) => ({ ...s, [vars.roleKey]: "" }));
      setNewIcon((s) => ({ ...s, [vars.roleKey]: "Check" }));
    },
    onError: () =>
      toast({ title: "Failed to add task", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      label?: string;
      iconName?: string;
      isEnabled?: boolean;
      sortOrder?: number;
    }) => {
      const { id, ...updates } = vars;
      return apiRequest("PUT", `/api/role-checklist-tasks/${id}`, updates);
    },
    onSuccess: invalidate,
    onError: () =>
      toast({ title: "Failed to update task", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/role-checklist-tasks/${id}`),
    onSuccess: invalidate,
    onError: () =>
      toast({
        title: "Failed to delete task",
        description: "Built-in tasks can be disabled but not deleted.",
        variant: "destructive",
      }),
  });

  const moveTask = (
    role: RoleKey,
    index: number,
    direction: "up" | "down",
  ) => {
    const list = tasksByRole[role];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= list.length) return;
    const a = list[index];
    const b = list[swapWith];
    updateMutation.mutate({ id: a.id, sortOrder: b.sortOrder ?? 0 });
    updateMutation.mutate({ id: b.id, sortOrder: a.sortOrder ?? 0 });
  };

  const handleAdd = (role: RoleKey) => {
    const label = newLabel[role].trim();
    if (!label) return;
    addMutation.mutate({
      roleKey: role,
      label,
      iconName: newIcon[role],
    });
  };

  // Other tenants don't get this feature — bounce direct URL hits back to Settings.
  if (!roleChecklistEnabled) {
    return <Redirect to="/settings" />;
  }

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Role Checklist Tasks</h1>
          <p className="text-sm text-gray-500">
            Tasks that appear under each role on every job card. Toggle off to
            hide, or add your own.
          </p>
        </div>
      </div>

      <Tabs defaultValue="C" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          {ROLE_KEYS.map((r) => (
            <TabsTrigger
              key={r}
              value={r}
              data-testid={`tab-role-${r}`}
            >
              {ROLE_LABEL[r]}
            </TabsTrigger>
          ))}
        </TabsList>

        {ROLE_KEYS.map((role) => (
          <TabsContent key={role} value={role} className="space-y-4 mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-green-600" />
                  {ROLE_LABEL[role]}
                </CardTitle>
                <p className="text-xs text-gray-500">{ROLE_BLURB[role]}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {isLoading && (
                  <div className="text-sm text-gray-400 py-4 text-center">
                    Loading...
                  </div>
                )}

                {!isLoading && tasksByRole[role].length === 0 && (
                  <div className="text-sm text-gray-400 py-6 text-center">
                    No tasks yet — add your first one below.
                  </div>
                )}

                {tasksByRole[role].map((task, index) => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border ${
                      task.isEnabled
                        ? "bg-white border-gray-200"
                        : "bg-gray-50 border-gray-200 opacity-60"
                    }`}
                    data-testid={`row-task-${task.itemId}`}
                  >
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === 0}
                        onClick={() => moveTask(role, index, "up")}
                        data-testid={`button-move-up-${task.itemId}`}
                      >
                        <ArrowUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={index === tasksByRole[role].length - 1}
                        onClick={() => moveTask(role, index, "down")}
                        data-testid={`button-move-down-${task.itemId}`}
                      >
                        <ArrowDown className="w-3 h-3" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-gray-700 flex-shrink-0">
                      {renderIcon(task.iconName, "w-4 h-4")}
                    </div>

                    <Input
                      defaultValue={task.label}
                      onBlur={(e) => {
                        const v = e.currentTarget.value.trim();
                        if (v && v !== task.label) {
                          updateMutation.mutate({ id: task.id, label: v });
                        }
                      }}
                      className="flex-1 h-8 text-sm"
                      data-testid={`input-label-${task.itemId}`}
                    />

                    <Select
                      value={task.iconName}
                      onValueChange={(v) =>
                        updateMutation.mutate({ id: task.id, iconName: v })
                      }
                    >
                      <SelectTrigger
                        className="w-24 h-8 text-xs"
                        data-testid={`select-icon-${task.itemId}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_NAMES.map((name) => (
                          <SelectItem key={name} value={name}>
                            <div className="flex items-center gap-2">
                              {renderIcon(name, "w-3.5 h-3.5")}
                              <span className="text-xs">{name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Switch
                      checked={task.isEnabled}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({
                          id: task.id,
                          isEnabled: checked,
                        })
                      }
                      data-testid={`switch-enabled-${task.itemId}`}
                    />

                    {task.isBuiltIn ? (
                      <span
                        className="text-[10px] text-gray-400 uppercase tracking-wide w-6 text-center"
                        title="Built-in task — disable to hide, can't be deleted"
                      >
                        Built
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600 h-8 w-8"
                        onClick={() => deleteMutation.mutate(task.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-${task.itemId}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAdd(role);
                  }}
                  className="flex items-center gap-2 pt-3 border-t border-gray-100"
                >
                  <Select
                    value={newIcon[role]}
                    onValueChange={(v) =>
                      setNewIcon((s) => ({ ...s, [role]: v }))
                    }
                  >
                    <SelectTrigger
                      className="w-24 h-9 text-xs"
                      data-testid={`select-new-icon-${role}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          <div className="flex items-center gap-2">
                            {renderIcon(name, "w-3.5 h-3.5")}
                            <span className="text-xs">{name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={newLabel[role]}
                    onChange={(e) =>
                      setNewLabel((s) => ({
                        ...s,
                        [role]: e.target.value,
                      }))
                    }
                    placeholder={`Add a task for ${ROLE_LABEL[role]}...`}
                    className="flex-1 h-9"
                    autoComplete="off"
                    data-testid={`input-new-task-${role}`}
                  />
                  <Button
                    type="submit"
                    disabled={
                      !newLabel[role].trim() || addMutation.isPending
                    }
                    data-testid={`button-add-task-${role}`}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <div className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <strong>How it works:</strong> Disabled tasks won't appear on job
        cards. Built-in tasks can be turned off but not deleted, so existing
        ticks stay intact. Custom tasks you add here apply to every new job.
      </div>
    </div>
  );
}
