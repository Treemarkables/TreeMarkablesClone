import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, FileText, User, Calendar, Gauge, Check, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import type { VehicleInspection, InspectionResponse } from "@shared/schema";

export default function VehicleInspectionHistory() {
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);

  const { data: inspectionsData, isLoading } = useQuery({
    queryKey: ['/api/vehicle-inspections'],
  });
  
  const inspections = Array.isArray((inspectionsData as any)?.data) 
    ? (inspectionsData as any).data as VehicleInspection[] 
    : [];

  // Fetch responses for selected inspection
  const { data: responsesData } = useQuery({
    queryKey: ['/api/vehicle-inspections', selectedInspectionId, 'responses'],
    enabled: !!selectedInspectionId,
  });

  const responses = Array.isArray((responsesData as any)?.data)
    ? (responsesData as any).data as InspectionResponse[]
    : [];

  const selectedInspection = inspections.find(i => i.id === selectedInspectionId);


  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-4">
        <div className="h-8 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Vehicle Inspection History</h1>
        <p className="text-muted-foreground mt-1">
          View all completed pre-start vehicle inspections
        </p>
      </div>

      <div className="grid gap-4">
        {inspections.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No inspections completed yet</p>
            </CardContent>
          </Card>
        ) : (
          inspections.map((inspection) => (
            <Card key={inspection.id} data-testid={`card-inspection-${inspection.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      {inspection.vehicleName || 'Unknown Vehicle'}
                      {inspection.status === 'pass' ? (
                        <Badge variant="default" className="bg-green-600" data-testid={`badge-status-${inspection.id}`}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Passed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" data-testid={`badge-status-${inspection.id}`}>
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {inspection.templateName}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Inspected by:</span>
                    <span className="font-medium" data-testid={`text-inspector-${inspection.id}`}>
                      {inspection.inspectorName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Date:</span>
                    <span className="font-medium" data-testid={`text-date-${inspection.id}`}>
                      {format(new Date(inspection.inspectionDate), 'dd/MM/yyyy h:mm a')}
                    </span>
                  </div>

                  {inspection.speedometerReading && (
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Odometer:</span>
                      <span className="font-medium" data-testid={`text-odometer-${inspection.id}`}>
                        {inspection.speedometerReading.toLocaleString()} km
                      </span>
                    </div>
                  )}
                </div>

                {inspection.overallNotes && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-sm font-medium mb-1">Notes:</p>
                    <p className="text-sm text-muted-foreground" data-testid={`text-notes-${inspection.id}`}>
                      {inspection.overallNotes}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedInspectionId(inspection.id)}
                    data-testid={`button-view-details-${inspection.id}`}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Inspection Details Dialog */}
      <Dialog open={!!selectedInspectionId} onOpenChange={(open) => !open && setSelectedInspectionId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedInspection?.vehicleName} - Inspection Details
            </DialogTitle>
          </DialogHeader>

          {selectedInspection && (
            <div className="space-y-6">
              {/* Inspection Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  {selectedInspection.status === 'pass' ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Passed
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className="h-3 w-3 mr-1" />
                      Failed
                    </Badge>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Inspector</p>
                  <p className="font-medium">{selectedInspection.inspectorName}</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Date</p>
                  <p className="font-medium">
                    {format(new Date(selectedInspection.inspectionDate), 'dd/MM/yyyy h:mm a')}
                  </p>
                </div>

                {selectedInspection.speedometerReading && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Odometer</p>
                    <p className="font-medium">{selectedInspection.speedometerReading.toLocaleString()} km</p>
                  </div>
                )}

                {selectedInspection.vehicleRegistration && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Registration</p>
                    <p className="font-medium">{selectedInspection.vehicleRegistration}</p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Template</p>
                  <p className="font-medium">{selectedInspection.templateName}</p>
                </div>
              </div>

              {/* Notes */}
              {selectedInspection.overallNotes && (
                <div>
                  <h3 className="font-semibold mb-2">Additional Notes</h3>
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-sm">{selectedInspection.overallNotes}</p>
                  </div>
                </div>
              )}

              {/* Checklist Responses */}
              <div>
                <h3 className="font-semibold mb-3">Inspection Checklist</h3>
                <div className="space-y-4">
                  {responses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No checklist responses found
                    </p>
                  ) : (
                    (() => {
                      // Group by category
                      const groupedResponses = responses.reduce((acc, response) => {
                        const category = response.category || 'Other';
                        if (!acc[category]) acc[category] = [];
                        acc[category].push(response);
                        return acc;
                      }, {} as Record<string, InspectionResponse[]>);

                      return Object.entries(groupedResponses).map(([category, categoryResponses]) => (
                        <div key={category} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-3 text-sm text-muted-foreground uppercase tracking-wide">
                            {category}
                          </h4>
                          <div className="space-y-3">
                            {categoryResponses
                              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                              .map((response) => (
                                <div key={response.id} className="space-y-2 pb-3 border-b last:border-0">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm font-medium flex-1">{response.question}</p>
                                    <div>
                                      {response.response === 'YES' && (
                                        <Badge variant="default" className="bg-green-600">
                                          <Check className="h-3 w-3 mr-1" />
                                          YES
                                        </Badge>
                                      )}
                                      {response.response === 'NO' && (
                                        <Badge variant="destructive">
                                          <X className="h-3 w-3 mr-1" />
                                          NO
                                        </Badge>
                                      )}
                                      {response.response === 'N/A' && (
                                        <Badge variant="secondary">
                                          <AlertTriangle className="h-3 w-3 mr-1" />
                                          N/A
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {response.comment && (
                                    <div className="bg-muted/50 rounded-md p-2 ml-4">
                                      <p className="text-xs font-medium text-muted-foreground mb-1">
                                        {response.response === 'NO' ? 'Issue Details:' : 'Note:'}
                                      </p>
                                      <p className="text-sm">{response.comment}</p>
                                    </div>
                                  )}

                                  {response.photos && response.photos.length > 0 && (
                                    <div className="ml-4 flex flex-wrap gap-2">
                                      {response.photos.map((photoUrl, idx) => (
                                        <img
                                          key={idx}
                                          src={photoUrl}
                                          alt={`Photo ${idx + 1}`}
                                          className="h-24 w-24 object-cover rounded border"
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      ));
                    })()
                  )}
                </div>
              </div>

              {/* Signature */}
              {selectedInspection.signature && (
                <div>
                  <h3 className="font-semibold mb-2">Inspector Signature</h3>
                  <div className="border rounded-md p-4 bg-white">
                    <img 
                      src={selectedInspection.signature} 
                      alt="Inspector signature"
                      className="max-h-32"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
