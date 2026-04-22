import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, AlertTriangle, CheckCircle2, FileText, Edit, UserPlus } from "lucide-react";

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
    controlMeasures: Array<{
      id: string;
      controlMeasureTemplateId: string | null;
      description: string;
    }>;
  }>;
  signatures: Array<{
    id: number;
    signerName: string;
    signedAt: string;
    signatureData: string;
  }>;
}

export default function JHAHistory() {
  const [, navigate] = useLocation();
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ success: boolean; data: JHAAssessment[] }>({
    queryKey: ['/api/jha/assessments'],
  });

  // Fetch full assessment details when selected
  const { data: detailData } = useQuery<{ success: boolean; data: JHAAssessment }>({
    queryKey: [`/api/jha/assessments/${selectedAssessmentId}?includeSteps=true&includeSignatures=true`],
    enabled: !!selectedAssessmentId,
  });

  const assessments = data?.data || [];
  const selectedAssessment = detailData?.data || null;

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
            const highestRisk = assessment.overallRiskRating || 0;
            const totalHazards = assessment.hazardCount || 0;
            const totalControls = assessment.controlMeasureCount || 0;
            const totalSignatures = assessment.signatureCount || 0;

            return (
              <Card key={assessment.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedAssessmentId(assessment.id)}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-lg">
                        JHA #{assessment.assessmentNumber || assessment.id.substring(0, 8)}
                        {assessment.jobId && ` - Job #${assessment.jobId}`}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                        <span>
                          {assessment.completedAt 
                            ? format(new Date(assessment.completedAt), "PPp")
                            : format(new Date(assessment.date), "PPp")}
                        </span>
                      </div>
                      {assessment.activityDescription && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {assessment.activityDescription}
                        </p>
                      )}
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
                      <span>{totalSignatures} signature{totalSignatures !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedAssessmentId} onOpenChange={(open) => !open && setSelectedAssessmentId(null)}>
        <DialogContent className="max-w-3xl max-h-screen">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <DialogTitle>
                JHA #{selectedAssessment?.assessmentNumber || selectedAssessment?.id.substring(0, 8)}
                {selectedAssessment?.jobId && ` - Job #${selectedAssessment.jobId}`}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedAssessmentId(null);
                  navigate(`/jha-assessment?id=${selectedAssessmentId}`);
                }}
                data-testid="button-edit-jha"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit JHA
              </Button>
            </div>
          </DialogHeader>

          {selectedAssessment && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-8 pr-4">
                <div>
                  <h3 className="font-semibold mb-4 text-base">Assessment Details</h3>
                  <div className="space-y-3 text-sm">
                    <p>
                      <span className="font-medium">Date:</span>{' '}
                      {selectedAssessment.completedAt 
                        ? format(new Date(selectedAssessment.completedAt), "PPPp")
                        : format(new Date(selectedAssessment.date), "PPPp")}
                    </p>
                    {selectedAssessment.activityDescription && (
                      <p>
                        <span className="font-medium">Activity:</span>{' '}
                        {selectedAssessment.activityDescription}
                      </p>
                    )}
                    {selectedAssessment.location && (
                      <p>
                        <span className="font-medium">Location:</span>{' '}
                        {selectedAssessment.location}
                      </p>
                    )}
                    {selectedAssessment.teamLeader && (
                      <p>
                        <span className="font-medium">Team Leader:</span>{' '}
                        {selectedAssessment.teamLeader}
                      </p>
                    )}
                    {selectedAssessment.ppeRequired && selectedAssessment.ppeRequired.length > 0 && (
                      <div>
                        <span className="font-medium">PPE Required:</span>
                        <div className="mt-1 ml-4">
                          <ul className="space-y-1">
                            {selectedAssessment.ppeRequired.map((item, idx) => (
                              <li key={idx} className="text-sm">• {item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                    {selectedAssessment.overallRiskRating && (
                      <p className="flex items-center gap-2">
                        <span className="font-medium">Overall Risk Rating:</span>{' '}
                        <Badge variant={getRiskColor(selectedAssessment.overallRiskRating)}>
                          {getRiskLabel(selectedAssessment.overallRiskRating)}
                        </Badge>
                      </p>
                    )}
                  </div>
                </div>

                {selectedAssessment.steps && selectedAssessment.steps.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-4 text-base">Hazards & Controls</h3>
                    <div className="space-y-4">
                      {selectedAssessment.steps.map((step) => (
                        <Card key={step.id}>
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between gap-4">
                              <CardTitle className="text-base">{step.hazardName}</CardTitle>
                              <Badge variant={getRiskColor(step.riskRating)}>
                                Risk Level
                              </Badge>
                            </div>
                          </CardHeader>
                          {step.controlMeasures && step.controlMeasures.length > 0 && (
                            <CardContent className="pt-0">
                              <h4 className="text-sm font-semibold mb-3">Control Measures:</h4>
                              <ul className="space-y-2">
                                {step.controlMeasures.map((measure, idx) => (
                                  <li key={measure.id ?? idx} className="flex items-start gap-2 text-sm">
                                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                                    <span>{measure.description}</span>
                                  </li>
                                ))}
                              </ul>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAssessment.signatures && selectedAssessment.signatures.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-3">Worker Signatures</h3>
                    <div className="space-y-3">
                      {selectedAssessment.signatures.map((sig) => (
                        <Card key={sig.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{sig.workerName}</span>
                              <span className="text-sm text-muted-foreground">
                                {format(new Date(sig.signedAt), "PPp")}
                              </span>
                            </div>
                            <div className="border rounded bg-white dark:bg-gray-900 p-2">
                              <img src={sig.signatureDataUrl} alt={`Signature by ${sig.workerName}`} className="max-h-24" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
