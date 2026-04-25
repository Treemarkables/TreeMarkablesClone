import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, ChevronRight } from "lucide-react";
import { formatNZTime } from "@shared/dateUtils";

interface StatusRow {
  templateId: string;
  templateName: string;
  equipmentType: string | null;
  completedAt: string | null;
  inductionId: string | null;
}

interface StaffInductionsDialogProps {
  staff: { id: string; firstName: string; lastName: string } | null;
  open: boolean;
  onClose: () => void;
}

export default function StaffInductionsDialog({
  staff,
  open,
  onClose,
}: StaffInductionsDialogProps) {
  const [, setLocation] = useLocation();

  const { data: statusData, isLoading } = useQuery({
    queryKey: [
      "/api/equipment-inductions/employee",
      staff?.id,
      "status",
    ],
    enabled: !!staff?.id && open,
  });

  const rows: StatusRow[] = Array.isArray((statusData as any)?.data)
    ? (statusData as any).data
    : [];

  const completedCount = rows.filter((r) => r.inductionId).length;

  if (!staff) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {staff.firstName} {staff.lastName} — Inductions
          </DialogTitle>
          <DialogDescription>
            {rows.length === 0
              ? "No induction templates have been created yet."
              : `${completedCount} of ${rows.length} inductions complete`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Loading…
            </p>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">
                  Create induction templates first.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    onClose();
                    setLocation("/settings/equipment-inductions");
                  }}
                  data-testid="button-go-to-induction-templates"
                >
                  Go to Induction Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            rows.map((row) => {
              const isComplete = !!row.inductionId;
              return (
                <Card
                  key={row.templateId}
                  data-testid={`card-induction-status-${row.templateId}`}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {row.templateName}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {row.equipmentType && (
                          <Badge variant="outline" className="text-xs capitalize">
                            {row.equipmentType.replace(/_/g, " ")}
                          </Badge>
                        )}
                        {isComplete ? (
                          <Badge variant="default" className="text-xs">
                            Complete
                            {row.completedAt
                              ? ` · ${formatNZTime(row.completedAt, "date")}`
                              : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={isComplete ? "outline" : "default"}
                      onClick={() => {
                        onClose();
                        setLocation(
                          `/staff-induction/${staff.id}/${row.templateId}`,
                        );
                      }}
                      data-testid={`button-${isComplete ? "redo" : "run"}-induction-${row.templateId}`}
                    >
                      {isComplete ? "Re-induct" : "Run induction"}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
