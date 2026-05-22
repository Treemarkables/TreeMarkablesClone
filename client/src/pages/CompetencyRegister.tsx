import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { CompetencyType, EmployeeCompetency } from "@shared/schema";

type EmployeeCompetencyWithStatus = EmployeeCompetency & {
  computedStatus: string;
};

type Employee = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
};

const ALL_EMPLOYEES = "__all__";
const CUSTOM_TYPE = "__custom__";

function employeeName(e: Employee): string {
  return (
    e.name ??
    [e.firstName, e.lastName].filter(Boolean).join(" ") ??
    e.id
  );
}

function normaliseEmployees(
  payload: { success: boolean; data: Employee[] } | Employee[] | undefined,
): Employee[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload.data) ? payload.data : [];
}

function formatDate(value: unknown): string {
  if (!value) return "No expiry";
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "No expiry";
  return format(d, "d MMM yyyy");
}

function formatIssueDate(value: unknown): string {
  if (!value) return "-";
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "-";
  return format(d, "d MMM yyyy");
}

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  return format(d, "yyyy-MM-dd");
}

function StatusBadge({ status }: { status: string }) {
  if (status === "expired") {
    return (
      <Badge className="bg-red-600 hover:bg-red-600 text-white">Expired</Badge>
    );
  }
  if (status === "expiring") {
    return (
      <Badge className="bg-amber-500 hover:bg-amber-500 text-black">
        Expiring soon
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-600 hover:bg-green-600 text-white">Valid</Badge>
  );
}

type FormState = {
  employeeId: string;
  competencyTypeId: string;
  competencyName: string;
  issuer: string;
  referenceNumber: string;
  issueDate: string;
  expiryDate: string;
  notes: string;
};

const emptyForm: FormState = {
  employeeId: "",
  competencyTypeId: CUSTOM_TYPE,
  competencyName: "",
  issuer: "",
  referenceNumber: "",
  issueDate: "",
  expiryDate: "",
  notes: "",
};

export default function CompetencyRegister() {
  const { toast } = useToast();

  const [expiringOnly, setExpiringOnly] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string>(ALL_EMPLOYEES);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filterEmployeeParam =
    employeeFilter === ALL_EMPLOYEES ? "" : employeeFilter;
  const params = new URLSearchParams();
  if (filterEmployeeParam) params.set("employeeId", filterEmployeeParam);
  if (expiringOnly) params.set("expiringOnly", "true");
  const queryString = params.toString();
  const competenciesUrl =
    "/api/employee-competencies" + (queryString ? `?${queryString}` : "");

  const { data: competenciesRes, isLoading } = useQuery<{
    success: boolean;
    data: EmployeeCompetencyWithStatus[];
  }>({ queryKey: [competenciesUrl] });

  const { data: typesRes } = useQuery<{
    success: boolean;
    data: CompetencyType[];
  }>({ queryKey: ["/api/competency-types"] });

  const { data: employeesRes } = useQuery<
    { success: boolean; data: Employee[] } | Employee[]
  >({ queryKey: ["/api/employees"] });

  const competencies = useMemo(
    () => competenciesRes?.data ?? [],
    [competenciesRes],
  );
  const competencyTypes = useMemo(
    () => (typesRes?.data ?? []).filter((t) => t.isActive),
    [typesRes],
  );
  const employees = useMemo(
    () => normaliseEmployees(employeesRes),
    [employeesRes],
  );

  const employeeNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of employees) map.set(e.id, employeeName(e));
    return map;
  }, [employees]);

  const expiredCount = competencies.filter(
    (c) => c.computedStatus === "expired",
  ).length;
  const expiringCount = competencies.filter(
    (c) => c.computedStatus === "expiring",
  ).length;

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/employee-competencies"],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const usingType =
        form.competencyTypeId !== CUSTOM_TYPE && form.competencyTypeId !== "";
      const body: Record<string, unknown> = {
        employeeId: form.employeeId,
        competencyName: form.competencyName.trim(),
      };
      if (usingType) body.competencyTypeId = form.competencyTypeId;
      if (form.issuer.trim()) body.issuer = form.issuer.trim();
      if (form.referenceNumber.trim())
        body.referenceNumber = form.referenceNumber.trim();
      if (form.issueDate)
        body.issueDate = new Date(form.issueDate).toISOString();
      if (form.expiryDate)
        body.expiryDate = new Date(form.expiryDate).toISOString();
      if (form.notes.trim()) body.notes = form.notes.trim();

      const res = editingId
        ? await apiRequest(
            "PUT",
            `/api/employee-competencies/${editingId}`,
            body,
          )
        : await apiRequest("POST", "/api/employee-competencies", body);
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not save competency",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(
        "DELETE",
        `/api/employee-competencies/${id}`,
      );
      return res.json();
    },
    onSuccess: () => {
      invalidate();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Could not delete competency",
        description: error.message,
      });
    },
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: EmployeeCompetencyWithStatus) => {
    setEditingId(row.id);
    setForm({
      employeeId: row.employeeId,
      competencyTypeId: row.competencyTypeId ?? CUSTOM_TYPE,
      competencyName: row.competencyName ?? "",
      issuer: row.issuer ?? "",
      referenceNumber: row.referenceNumber ?? "",
      issueDate: toDateInputValue(row.issueDate),
      expiryDate: toDateInputValue(row.expiryDate),
      notes: row.notes ?? "",
    });
    setDialogOpen(true);
  };

  const onTypeChange = (value: string) => {
    if (value === CUSTOM_TYPE) {
      setForm((f) => ({ ...f, competencyTypeId: CUSTOM_TYPE }));
      return;
    }
    const t = competencyTypes.find((ct) => ct.id === value);
    setForm((f) => ({
      ...f,
      competencyTypeId: value,
      competencyName: t ? t.name : f.competencyName,
    }));
  };

  const canSave =
    form.employeeId.trim() !== "" && form.competencyName.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) {
      toast({
        variant: "destructive",
        title: "Missing details",
        description: "Select a worker and provide a competency name.",
      });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">Training &amp; Competency Register</h1>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add competency
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {expiredCount} expired, {expiringCount} expiring soon
        {expiringOnly || employeeFilter !== ALL_EMPLOYEES
          ? " (filtered)"
          : ""}
        .
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          variant={expiringOnly ? "default" : "outline"}
          onClick={() => setExpiringOnly((v) => !v)}
        >
          {expiringOnly ? "Showing expiring/expired" : "Expiring/expired only"}
        </Button>
        <div className="w-full sm:w-64">
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All workers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_EMPLOYEES}>All workers</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {employeeName(e)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Worker</th>
                <th className="p-3 font-medium">Competency</th>
                <th className="p-3 font-medium">Issuer</th>
                <th className="p-3 font-medium">Issued</th>
                <th className="p-3 font-medium">Expiry</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={7}>
                    Loading...
                  </td>
                </tr>
              ) : competencies.length === 0 ? (
                <tr>
                  <td className="p-3 text-muted-foreground" colSpan={7}>
                    No competencies recorded.
                  </td>
                </tr>
              ) : (
                competencies.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-border last:border-0 align-top"
                  >
                    <td className="p-3">
                      {employeeNameById.get(row.employeeId) ?? row.employeeId}
                    </td>
                    <td className="p-3">{row.competencyName}</td>
                    <td className="p-3">{row.issuer || "-"}</td>
                    <td className="p-3">{formatIssueDate(row.issueDate)}</td>
                    <td className="p-3">{formatDate(row.expiryDate)}</td>
                    <td className="p-3">
                      <StatusBadge status={row.computedStatus} />
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label="Edit competency"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => deleteMutation.mutate(row.id)}
                          disabled={deleteMutation.isPending}
                          aria-label="Delete competency"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit competency" : "Add competency"}
            </DialogTitle>
            <DialogDescription>
              Record a worker&apos;s ticket, certificate or qualification.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cr-employee">Worker</Label>
              <Select
                value={form.employeeId}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, employeeId: v }))
                }
              >
                <SelectTrigger id="cr-employee">
                  <SelectValue placeholder="Select a worker" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {employeeName(e)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-type">Competency type</Label>
              <Select
                value={form.competencyTypeId}
                onValueChange={onTypeChange}
              >
                <SelectTrigger id="cr-type">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CUSTOM_TYPE}>
                    Custom (free text)
                  </SelectItem>
                  {competencyTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-name">Competency name</Label>
              <Input
                id="cr-name"
                value={form.competencyName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, competencyName: e.target.value }))
                }
                placeholder="e.g. Chainsaw Unit Standard 6916"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-issuer">Issuer</Label>
              <Input
                id="cr-issuer"
                value={form.issuer}
                onChange={(e) =>
                  setForm((f) => ({ ...f, issuer: e.target.value }))
                }
                placeholder="e.g. Competenz, NZQA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-ref">Reference number</Label>
              <Input
                id="cr-ref"
                value={form.referenceNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, referenceNumber: e.target.value }))
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cr-issue">Issue date</Label>
                <Input
                  id="cr-issue"
                  type="date"
                  value={form.issueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, issueDate: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cr-expiry">Expiry date</Label>
                <Input
                  id="cr-expiry"
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expiryDate: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for credentials that do not expire.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cr-notes">Notes</Label>
              <Textarea
                id="cr-notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editingId ? "Save changes" : "Add competency"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
