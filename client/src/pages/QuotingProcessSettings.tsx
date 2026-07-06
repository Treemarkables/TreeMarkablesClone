import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
  type LucideIcon,
} from "lucide-react";

import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { QuotingProcessStep } from "@shared/schema";

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

export default function QuotingProcessSettings() {
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState("");
  const [newIcon, setNewIcon] = useState("Check");

  const { data, isLoading } = useQuery<{
    success: boolean;
    data: QuotingProcessStep[];
  }>({
    queryKey: ["/api/quoting-process-steps"],
  });

  const steps = (data?.data ?? []).slice().sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/quoting-process-steps"] });

  const addMutation = useMutation({
    mutationFn: (vars: { label: string; iconName: string }) =>
      apiRequest("POST", "/api/quoting-process-steps", vars),
    onSuccess: () => {
      invalidate();
      setNewLabel("");
      setNewIcon("Check");
    },
    onError: () =>
      toast({ title: "Failed to add step", variant: "destructive" }),
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
      return apiRequest("PUT", `/api/quoting-process-steps/${id}`, updates);
    },
    onSuccess: invalidate,
    onError: () =>
      toast({ title: "Failed to update step", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest("DELETE", `/api/quoting-process-steps/${id}`),
    onSuccess: invalidate,
    onError: () =>
      toast({
        title: "Failed to delete step",
        description: "Built-in steps can be disabled but not deleted.",
        variant: "destructive",
      }),
  });

  const moveStep = (index: number, direction: "up" | "down") => {
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= steps.length) return;
    const a = steps[index];
    const b = steps[swapWith];
    updateMutation.mutate({ id: a.id, sortOrder: b.sortOrder ?? 0 });
    updateMutation.mutate({ id: b.id, sortOrder: a.sortOrder ?? 0 });
  };

  const handleAdd = () => {
    const label = newLabel.trim();
    if (!label) return;
    addMutation.mutate({ label, iconName: newIcon });
  };

  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings" data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Quoting Process Steps
          </h1>
          <p className="text-sm text-gray-500">
            Steps that appear in the on-site Quoting tab on every lead/quote
            job. Toggle off to hide, reorder with the arrows, or add your own.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-green-600" />
            Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && (
            <div className="text-sm text-gray-400 py-4 text-center">
              Loading...
            </div>
          )}

          {!isLoading && steps.length === 0 && (
            <div className="text-sm text-gray-400 py-6 text-center">
              No steps yet — add your first one below.
            </div>
          )}

          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                step.isEnabled
                  ? "bg-white border-gray-200"
                  : "bg-gray-50 border-gray-200 opacity-60"
              }`}
              data-testid={`row-step-${step.itemId}`}
            >
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === 0}
                  onClick={() => moveStep(index, "up")}
                  aria-label="Move step up"
                  data-testid={`button-move-up-${step.itemId}`}
                >
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  disabled={index === steps.length - 1}
                  onClick={() => moveStep(index, "down")}
                  aria-label="Move step down"
                  data-testid={`button-move-down-${step.itemId}`}
                >
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>

              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 text-gray-700 flex-shrink-0">
                {renderIcon(step.iconName, "w-4 h-4")}
              </div>

              <Input
                defaultValue={step.label}
                onBlur={(e) => {
                  const v = e.currentTarget.value.trim();
                  if (v && v !== step.label) {
                    updateMutation.mutate({ id: step.id, label: v });
                  }
                }}
                className="flex-1 h-8 text-sm"
                data-testid={`input-label-${step.itemId}`}
              />

              <Select
                value={step.iconName}
                onValueChange={(v) =>
                  updateMutation.mutate({ id: step.id, iconName: v })
                }
              >
                <SelectTrigger
                  className="w-24 h-8 text-xs"
                  data-testid={`select-icon-${step.itemId}`}
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
                checked={step.isEnabled}
                onCheckedChange={(checked) =>
                  updateMutation.mutate({
                    id: step.id,
                    isEnabled: checked,
                  })
                }
                data-testid={`switch-enabled-${step.itemId}`}
              />

              {step.isBuiltIn ? (
                <span
                  className="text-[10px] text-gray-400 uppercase tracking-wide w-6 text-center"
                  title="Built-in step — disable to hide, can't be deleted"
                >
                  Built
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-400 hover:text-red-600 h-8 w-8"
                  onClick={() => deleteMutation.mutate(step.id)}
                  disabled={deleteMutation.isPending}
                  aria-label="Delete step"
                  data-testid={`button-delete-${step.itemId}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd();
            }}
            className="flex items-center gap-2 pt-3 border-t border-gray-100"
          >
            <Select value={newIcon} onValueChange={setNewIcon}>
              <SelectTrigger
                className="w-24 h-9 text-xs"
                data-testid="select-new-icon"
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
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Add a quoting step..."
              className="flex-1 h-9"
              autoComplete="off"
              data-testid="input-new-step"
            />
            <Button
              type="submit"
              disabled={!newLabel.trim() || addMutation.isPending}
              data-testid="button-add-step"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-sm text-gray-500 bg-amber-50 border border-amber-200 rounded-lg p-4">
        <strong>How it works:</strong> The Quoting tab only appears on jobs in
        Lead or Quote status. Disabled steps stay hidden. Built-in steps can be
        turned off but not deleted, so existing ticks and notes stay intact.
      </div>
    </div>
  );
}
