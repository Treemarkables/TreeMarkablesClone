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

  const getLicenceBadge = (eq: Equipment) => {
    if (!eq.licenceRequired || eq.licenceRequired === "None required") {
      return (
        <Badge variant="secondary" className="text-xs">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          No licence required
        </Badge>
      );
    }
    return (
      <Badge className="text-xs bg-amber-100 text-amber-800 border border-amber-300">
        <Shield className="w-3 h-3 mr-1" />
        {eq.licenceRequired}
      </Badge>
    );
  };

  const ungatedCount = equipment.filter(e => !e.licenceRequired).length;

  return (
    <div className="flex flex-col min-h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/settings">
          <Button variant="ghost" size="icon" data-testid="button-back-settings">
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="w-4 h-4" />
            All Equipment ({equipment.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
              ))}
            </div>
          ) : equipment.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No equipment found. Add equipment in the Equipment page first.</p>
          ) : (
            <div className="space-y-2">
              {equipment.map(eq => (
                <div
                  key={eq.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card hover-elevate cursor-pointer"
                  onClick={() => openEdit(eq)}
                  data-testid={`equip-row-${eq.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                      <Wrench className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{eq.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{eq.type?.replace(/_/g, " ") || "Equipment"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getLicenceBadge(eq)}
                    <Button variant="ghost" size="sm" className="text-xs h-7">
                      Edit
                    </Button>
                  </div>
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
