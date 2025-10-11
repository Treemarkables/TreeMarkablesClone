import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, AlertTriangle, CheckCircle2, FileText } from "lucide-react";

interface JHAAssessment {
  id: number;
  jobId: number | null;
  status: string;
  completedAt: string | null;
  createdAt: string;
  steps: Array<{
    id: number;
    hazardName: string;
    riskRating: number;
    controlMeasures: string[];
  }>;
  signatures: Array<{
    id: number;
    signerName: string;
    signedAt: string;
    signatureData: string;
  }>;
}

export default function JHAHistory() {
  const [selectedAssessment, setSelectedAssessment] = useState<JHAAssessment | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: JHAAssessment[] }>({
    queryKey: ['/api/jha/assessments'],
  });

  const assessments = data?.data || [];

  const getRiskColor = (rating: number) => {
    if (rating >= 4) return "destructive";
    if (rating >= 3) return "warning";
    return "success";
  };

  const getRiskLabel = (rating: number) => {
    if (rating >= 4) return "High Risk";
    if (rating >= 3) return "Medium Risk";
    return "Low Risk";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Job Hazard Analysis History</h1>
        </div>
        <p className="text-muted-foreground">
          View all completed hazard assessments
        </p>
      </div>

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Assessments Yet</h3>
            <p className="text-muted-foreground">
              Complete your first Job Hazard Analysis to see it here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {assessments.map((assessment) => {
            const highestRisk = Math.max(...assessment.steps.map(s => s.riskRating), 0);
            const totalHazards = assessment.steps.length;
            const totalControls = assessment.steps.reduce((sum, step) => sum + step.controlMeasures.length, 0);

            return (
              <Card key={assessment.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedAssessment(assessment)}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        JHA #{assessment.id}
                        {assessment.jobId && ` - Job #${assessment.jobId}`}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <span>
                          {assessment.completedAt 
                            ? format(new Date(assessment.completedAt), "PPp")
                            : format(new Date(assessment.createdAt), "PPp")}
                        </span>
                      </div>
                    </div>
                    <Badge variant={getRiskColor(highestRisk)} data-testid={`badge-risk-${assessment.id}`}>
                      {getRiskLabel(highestRisk)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      <span>{totalHazards} hazard{totalHazards !== 1 ? 's' : ''} assessed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span>{totalControls} control measure{totalControls !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span>{assessment.signatures.length} signature{assessment.signatures.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedAssessment} onOpenChange={(open) => !open && setSelectedAssessment(null)}>
        <DialogContent className="max-w-3xl max-h-screen">
          <DialogHeader>
            <DialogTitle>
              JHA #{selectedAssessment?.id}
              {selectedAssessment?.jobId && ` - Job #${selectedAssessment.jobId}`}
            </DialogTitle>
          </DialogHeader>

          {selectedAssessment && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-6 pr-4">
                <div>
                  <h3 className="font-semibold mb-2">Assessment Date</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedAssessment.completedAt 
                      ? format(new Date(selectedAssessment.completedAt), "PPPp")
                      : format(new Date(selectedAssessment.createdAt), "PPPp")}
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Hazards & Controls</h3>
                  <div className="space-y-4">
                    {selectedAssessment.steps.map((step) => (
                      <Card key={step.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-base">{step.hazardName}</CardTitle>
                            <Badge variant={getRiskColor(step.riskRating)}>
                              Risk Level {step.riskRating}
                            </Badge>
                          </div>
                        </CardHeader>
                        {step.controlMeasures.length > 0 && (
                          <CardContent>
                            <h4 className="text-sm font-semibold mb-2">Control Measures:</h4>
                            <ul className="space-y-1">
                              {step.controlMeasures.map((measure, idx) => (
                                <li key={idx} className="flex items-start gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{measure}</span>
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-3">Worker Signatures</h3>
                  <div className="space-y-3">
                    {selectedAssessment.signatures.map((sig) => (
                      <Card key={sig.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{sig.signerName}</span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(sig.signedAt), "PPp")}
                            </span>
                          </div>
                          <div className="border rounded bg-white dark:bg-gray-900 p-2">
                            <img src={sig.signatureData} alt={`Signature by ${sig.signerName}`} className="max-h-24" />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
