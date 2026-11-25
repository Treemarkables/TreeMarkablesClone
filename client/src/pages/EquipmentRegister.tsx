import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Wrench, ChevronLeft, Shield, AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

const NZ_LICENCES = [
  "EWP Ticket (Elevated Work Platform)",
  "Class 2 Heavy Motor Vehicle Licence",
  "Class 4 Heavy Motor Vehicle Licence",
  "Class 5 Heavy Motor Vehicle Licence",
  "Chainsaw Unit Standard (US6377)",
  "Competent Person Certificate (Arboriculture)",
  "NZQA Level 4 Arboriculture",
  "Crane Licence (Dogman / Rigger)",
  "Forklift Licence",
  "First Aid Certificate",
  "None required",
];

interface Equipment {
  id: string;
  name: string;
  type: string;
  status: string;
  licenceRequired?: string;
  registrationNumber?: string;
  make?: string;
  model?: string;
}

export default function EquipmentRegister() {
  const { toast } = useToast();
  const [editingEquip, setEditingEquip] = useState<Equipment | null>(null);
  const [licenceValue, setLicenceValue] = useState("");
  const [customLicence, setCustomLicence] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const { data: equipmentData, isLoading } = useQuery<{ success: boolean; data: Equipment[] }>({
    queryKey: ["/api/equipment"],
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; licenceRequired: string }) =>
      apiRequest("PUT", `/api/equipment/${vars.id}`, { licenceRequired: vars.licenceRequired }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEditingEquip(null);
      setLicenceValue("");
      setCustomLicence("");
      setUseCustom(false);
    },
    onError: () => {
      toast({ title: "Failed to update equipment", variant: "destructive" });
    },
  });

  const equipment = equipmentData?.data ?? [];

  const openEdit = (eq: Equipment) => {
    setEditingEquip(eq);
    const existing = eq.licenceRequired || "";
    if (existing && !NZ_LICENCES.includes(existing)) {
      setUseCustom(true);
      setCustomLicence(existing);
      setLicenceValue("custom");
    } else {
      setUseCustom(false);
      setLicenceValue(existing);
      setCustomLicence("");
    }
  };

  const handleSave = () => {
    if (!editingEquip) return;
    const finalLicence = useCustom ? customLicence : licenceValue;
    updateMutation.mutate({ id: editingEquip.id, licenceRequired: finalLicence });
  };

  // Local override only. Badge's default is whitespace-nowrap, which is what
  // made a long licence paint over the name on a phone. Staff licence chips
  // stay on the shared Badge and are not affected.
  const licenceBadgeClass =
    "h-auto w-fit max-w-full items-start whitespace-normal py-1 text-left text-xs leading-snug";

  const getLicenceBadge = (eq: Equipment) => {
    if (!eq.licenceRequired || eq.licenceRequired === "None required") {
      return (
        <Badge variant="secondary" className={licenceBadgeClass} data-testid={`badge-equip-licence-${eq.id}`}>
          <CheckCircle2 className="mr-1 mt-0.5 h-3.5 w-3.5 shrink-0" />
          No licence required
        </Badge>
      );
    }
    return (
      <Badge
        className={`${licenceBadgeClass} border border-amber-300 bg-amber-100 text-amber-800`}
        data-testid={`badge-equip-licence-${eq.id}`}
      >
        <Shield className="mr-1 mt-0.5 h-3.5 w-3.5 shrink-0" />
        {eq.licenceRequired}
      </Badge>
    );
  };

  const ungatedCount = equipment.filter(e => !e.licenceRequired).length;

  return (
    <div className="flex min-h-full min-w-0 flex-col space-y-6 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" aria-label="Back to settings" data-testid="button-back-settings">
            <ChevronLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Equipment Register</h1>
          <p className="text-muted-foreground text-sm">Assign licence requirements to each piece of equipment</p>
        </div>
      </div>

      {ungatedCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{ungatedCount} item{ungatedCount !== 1 ? "s" : ""}</strong> {ungatedCount !== 1 ? "have" : "has"} no licence requirement set. The AI Dispatch scheduler uses this information to match qualified crew to equipment.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="w-4 h-4" />
            All Equipment ({equipment.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : equipment.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No equipment found. Add equipment in the Equipment page first.</p>
          ) : (
            <div className="space-y-3">
              {equipment.map(eq => (
                <div
                  key={eq.id}
                  className="grid min-w-0 cursor-pointer grid-cols-[2.75rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 rounded-md border bg-card p-4 hover-elevate lg:grid-cols-[2.75rem_minmax(8rem,1fr)_minmax(0,18rem)_auto] lg:items-center"
                  onClick={() => openEdit(eq)}
                  data-testid={`equip-row-${eq.id}`}
                >
                  <div className="col-start-1 row-start-1 flex h-11 w-11 items-center justify-center self-start rounded-md bg-muted lg:self-center">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="col-start-2 row-start-1 min-w-0">
                    <p className="break-words text-base font-semibold leading-snug" data-testid={`text-equip-name-${eq.id}`}>
                      {eq.name}
                    </p>
                    <p className="mt-0.5 break-words text-sm capitalize text-muted-foreground">
                      {eq.type?.replace(/_/g, " ") || "Equipment"}
                    </p>
                  </div>
                  <div className="col-span-2 col-start-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-3 lg:row-start-1 lg:self-center">
                    {getLicenceBadge(eq)}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="col-start-3 row-start-1 h-11 min-h-11 min-w-11 shrink-0 self-start px-3 text-sm lg:col-start-4 lg:self-center"
                    data-testid={`button-edit-equip-${eq.id}`}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingEquip} onOpenChange={open => { if (!open) { setEditingEquip(null); setLicenceValue(""); setCustomLicence(""); setUseCustom(false); } }}>
        <DialogContent data-testid="dialog-edit-licence" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Licence Requirement — {editingEquip?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Licence / Ticket Required to Operate</Label>
              <Select
                value={useCustom ? "custom" : licenceValue}
                onValueChange={val => {
                  if (val === "custom") {
                    setUseCustom(true);
                    setLicenceValue("custom");
                  } else {
                    setUseCustom(false);
                    setLicenceValue(val);
                  }
                }}
              >
                <SelectTrigger data-testid="select-licence-required">
                  <SelectValue placeholder="Select a licence requirement..." />
                </SelectTrigger>
                <SelectContent>
                  {NZ_LICENCES.map(lic => (
                    <SelectItem key={lic} value={lic}>{lic}</SelectItem>
                  ))}
                  <SelectItem value="custom">Other (custom)...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {useCustom && (
              <div className="space-y-2">
                <Label>Custom Licence Name</Label>
                <Input
                  value={customLicence}
                  onChange={e => setCustomLicence(e.target.value)}
                  placeholder="e.g. NZQA Level 3 Arboriculture Unit Standard"
                  data-testid="input-custom-licence"
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              The AI Dispatch scheduler will only assign this equipment to jobs where at least one crew member holds this licence or ticket.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingEquip(null); setLicenceValue(""); setCustomLicence(""); setUseCustom(false); }}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending || (useCustom && !customLicence.trim()) || (!useCustom && !licenceValue)}
              data-testid="button-save-licence"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
