import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, FileText, User, Calendar, Gauge } from "lucide-react";
import { format } from "date-fns";
import type { VehicleInspection } from "@shared/schema";

export default function VehicleInspectionHistory() {
  const { data: inspectionsData, isLoading } = useQuery({
    queryKey: ['/api/vehicle-inspections'],
  });
  
  const inspections = Array.isArray((inspectionsData as any)?.data) 
    ? (inspectionsData as any).data as VehicleInspection[] 
    : [];

  const { data: equipmentData } = useQuery({
    queryKey: ['/api/equipment'],
  });
  const vehicles = Array.isArray((equipmentData as any)?.data) ? (equipmentData as any).data : [];

  const getVehicleName = (vehicleId: string) => {
    const vehicle = vehicles.find((v: any) => v.id === vehicleId);
    return vehicle?.name || 'Unknown Vehicle';
  };

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
                      {getVehicleName(inspection.equipmentId)}
                      {inspection.passedInspection ? (
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
    </div>
  );
}
