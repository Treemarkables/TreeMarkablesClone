import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardCheck, Check, X, AlertTriangle, Camera, CheckCircle2, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { 
  SelectInspectionTemplate, 
  SelectInspectionChecklistItem, 
  InsertVehicleInspection,
  InsertInspectionResponse,
  SelectEquipment
} from "@shared/schema";

type ResponseValue = 'YES' | 'NO' | 'N/A';

interface InspectionResponse {
  checklistItemId: string;
  questionText: string;
  category: string | null;
  requiresComment: boolean;
  requiresPhoto: boolean;
  responseValue: ResponseValue | null;
  comments: string;
  photoUrl: string | null;
}

export default function VehicleInspection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [responses, setResponses] = useState<Map<string, InspectionResponse>>(new Map());
  const [currentStep, setCurrentStep] = useState<'vehicle' | 'inspection' | 'signature'>('vehicle');
  const [odometerReading, setOdometerReading] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState('');

  // Fetch equipment (vehicles)
  const { data: vehicles = [] } = useQuery<SelectEquipment[]>({
    queryKey: ['/api/equipment'],
  });

  // Fetch templates
  const { data: templates = [] } = useQuery<SelectInspectionTemplate[]>({
    queryKey: ['/api/inspection-templates'],
  });

  // Fetch default template for selected vehicle
  const { data: defaultTemplate } = useQuery<SelectInspectionTemplate>({
    queryKey: ['/api/inspection-templates/default', selectedVehicleId],
    enabled: !!selectedVehicleId && !selectedTemplateId,
  });

  // Fetch checklist items for selected template
  const { data: checklistItems = [] } = useQuery<SelectInspectionChecklistItem[]>({
    queryKey: ['/api/inspection-templates', selectedTemplateId || defaultTemplate?.id, 'items'],
    enabled: !!(selectedTemplateId || defaultTemplate?.id),
  });

  // Initialize responses when checklist items load (preserve existing answers)
  useEffect(() => {
    if (checklistItems.length > 0) {
      setResponses(prevResponses => {
        const newResponses = new Map(prevResponses);
        
        // Only add missing items, preserve existing responses
        checklistItems.forEach(item => {
          if (!newResponses.has(item.id)) {
            newResponses.set(item.id, {
              checklistItemId: item.id,
              questionText: item.questionText,
              category: item.category,
              requiresComment: item.requiresComment || false,
              requiresPhoto: item.requiresPhoto || false,
              responseValue: null,
              comments: '',
              photoUrl: null,
            });
          }
        });
        
        // Remove responses for items no longer in the checklist
        const currentItemIds = new Set(checklistItems.map(i => i.id));
        Array.from(newResponses.keys()).forEach(id => {
          if (!currentItemIds.has(id)) {
            newResponses.delete(id);
          }
        });
        
        return newResponses;
      });
    }
  }, [checklistItems]);

  const createInspectionMutation = useMutation({
    mutationFn: async () => {
      const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);
      const templateToUse = selectedTemplateId 
        ? templates.find(t => t.id === selectedTemplateId)
        : defaultTemplate;

      if (!selectedVehicle || !templateToUse || !user) {
        throw new Error('Missing required data');
      }

      // Get signature as base64
      const canvas = signatureCanvasRef.current;
      const signatureDataUrl = canvas ? canvas.toDataURL() : null;

      // Create inspection record
      const inspectionData: InsertVehicleInspection = {
        vehicleId: selectedVehicleId,
        vehicleName: selectedVehicle.name,
        templateId: templateToUse.id,
        templateName: templateToUse.name,
        inspectorId: user.id,
        inspectorName: user.username || user.employeeId || 'Unknown',
        status: 'completed',
        odometerReading: odometerReading ? parseInt(odometerReading) : null,
        notes: inspectorNotes || null,
        signatureDataUrl: signatureDataUrl || null,
        passedInspection: Array.from(responses.values()).every(r => r.responseValue !== 'NO'),
      };

      const inspectionResult = await apiRequest('/api/vehicle-inspections', 'POST', inspectionData);
      const inspectionId = inspectionResult.data.id;

      // Create all responses
      const responsePromises = Array.from(responses.values()).map(response => {
        if (response.responseValue) {
          const responseData: InsertInspectionResponse = {
            inspectionId,
            checklistItemId: response.checklistItemId,
            questionText: response.questionText,
            category: response.category,
            requiresComment: response.requiresComment,
            requiresPhoto: response.requiresPhoto,
            responseValue: response.responseValue,
            comments: response.comments || null,
            photoUrl: response.photoUrl || null,
          };
          return apiRequest(`/api/vehicle-inspections/${inspectionId}/responses`, 'POST', responseData);
        }
        return Promise.resolve();
      });

      await Promise.all(responsePromises);
      return inspectionResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicle-inspections'] });
      toast({ 
        title: 'Inspection completed',
        description: 'Vehicle inspection has been saved successfully',
      });
      
      // Reset form
      setSelectedVehicleId('');
      setSelectedTemplateId('');
      setResponses(new Map());
      setCurrentStep('vehicle');
      setOdometerReading('');
      setInspectorNotes('');
      setHasSignature(false);
      
      // Clear signature
      const canvas = signatureCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
    },
    onError: (error) => {
      toast({ 
        title: 'Failed to complete inspection',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleResponseChange = (itemId: string, value: ResponseValue) => {
    const currentResponse = responses.get(itemId);
    if (currentResponse) {
      const updatedResponse = { ...currentResponse, responseValue: value };
      // Clear comments and photo if switching from NO to YES/N/A
      if (value !== 'NO') {
        updatedResponse.comments = '';
        updatedResponse.photoUrl = null;
      }
      setResponses(new Map(responses.set(itemId, updatedResponse)));
    }
  };

  const handleCommentChange = (itemId: string, comments: string) => {
    const currentResponse = responses.get(itemId);
    if (currentResponse) {
      setResponses(new Map(responses.set(itemId, { ...currentResponse, comments })));
    }
  };

  const handlePhotoUpload = async (itemId: string, file: File) => {
    // In production, upload to storage and get URL
    // For now, create a data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const currentResponse = responses.get(itemId);
      if (currentResponse && e.target?.result) {
        setResponses(new Map(responses.set(itemId, { 
          ...currentResponse, 
          photoUrl: e.target.result as string 
        })));
      }
    };
    reader.readAsDataURL(file);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      setIsDrawing(true);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasSignature(false);
      }
    }
  };

  const canProceedToInspection = selectedVehicleId && (selectedTemplateId || defaultTemplate);
  const canProceedToSignature = 
    checklistItems.length > 0 && 
    responses.size === checklistItems.length && 
    Array.from(responses.values()).every(r => {
      if (!r.responseValue) return false;
      if (r.responseValue === 'NO' && r.requiresComment && !r.comments) return false;
      if (r.responseValue === 'NO' && r.requiresPhoto && !r.photoUrl) return false;
      return true;
    });

  const groupedItems = checklistItems.reduce((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, SelectInspectionChecklistItem[]>);

  if (currentStep === 'vehicle') {
    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Vehicle Pre-Start Inspection</h1>
          <p className="text-muted-foreground">Select vehicle and template to begin</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inspection Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="vehicle">Select Vehicle *</Label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger className="text-base md:text-sm" data-testid="select-vehicle">
                  <SelectValue placeholder="Choose a vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map(vehicle => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      {vehicle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedVehicleId && (
              <>
                <div>
                  <Label htmlFor="template">Inspection Template (optional)</Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger className="text-base md:text-sm" data-testid="select-template">
                      <SelectValue placeholder={defaultTemplate ? `Using default: ${defaultTemplate.name}` : "Choose a template"} />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} {template.isDefault && '(Default)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {defaultTemplate && !selectedTemplateId && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Default template will be used
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="odometer">Odometer Reading (optional)</Label>
                  <Input
                    id="odometer"
                    type="number"
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    placeholder="Enter reading"
                    className="text-base md:text-sm"
                    data-testid="input-odometer"
                  />
                </div>
              </>
            )}

            <Button
              onClick={() => setCurrentStep('inspection')}
              disabled={!canProceedToInspection}
              className="w-full"
              data-testid="button-start-inspection"
            >
              Start Inspection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (currentStep === 'inspection') {
    return (
      <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Inspection Checklist</h1>
          <p className="text-muted-foreground">
            {vehicles.find(v => v.id === selectedVehicleId)?.name}
          </p>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedItems).map(([category, items]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="text-lg">{category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map(item => {
                  const response = responses.get(item.id);
                  if (!response) return null;

                  return (
                    <div key={item.id} className="space-y-3 pb-4 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm md:text-base">{item.questionText}</p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant={response.responseValue === 'YES' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleResponseChange(item.id, 'YES')}
                          className="flex-1 min-h-10"
                          data-testid={`button-yes-${item.id}`}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          YES
                        </Button>
                        <Button
                          variant={response.responseValue === 'NO' ? 'destructive' : 'outline'}
                          size="sm"
                          onClick={() => handleResponseChange(item.id, 'NO')}
                          className="flex-1 min-h-10"
                          data-testid={`button-no-${item.id}`}
                        >
                          <X className="w-4 h-4 mr-1" />
                          NO
                        </Button>
                        <Button
                          variant={response.responseValue === 'N/A' ? 'secondary' : 'outline'}
                          size="sm"
                          onClick={() => handleResponseChange(item.id, 'N/A')}
                          className="flex-1 min-h-10"
                          data-testid={`button-na-${item.id}`}
                        >
                          <AlertTriangle className="w-4 h-4 mr-1" />
                          N/A
                        </Button>
                      </div>

                      {response.responseValue === 'NO' && (
                        <div className="space-y-3 bg-muted/50 p-3 rounded-md">
                          {response.requiresComment && (
                            <div>
                              <Label htmlFor={`comment-${item.id}`} className="text-xs">
                                Comment Required *
                              </Label>
                              <Textarea
                                id={`comment-${item.id}`}
                                value={response.comments}
                                onChange={(e) => handleCommentChange(item.id, e.target.value)}
                                placeholder="Explain the issue..."
                                className="text-base md:text-sm"
                                data-testid={`textarea-comment-${item.id}`}
                              />
                            </div>
                          )}

                          {response.requiresPhoto && (
                            <div>
                              <Label htmlFor={`photo-${item.id}`} className="text-xs">
                                Photo Required *
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  id={`photo-${item.id}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePhotoUpload(item.id, file);
                                  }}
                                  className="text-base md:text-sm"
                                  data-testid={`input-photo-${item.id}`}
                                />
                                {response.photoUrl && (
                                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 sticky bottom-0 bg-background py-4 border-t">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('vehicle')}
            className="flex-1"
            data-testid="button-back"
          >
            Back
          </Button>
          <Button
            onClick={() => setCurrentStep('signature')}
            disabled={!canProceedToSignature}
            className="flex-1"
            data-testid="button-next"
          >
            Next: Signature
          </Button>
        </div>
      </div>
    );
  }

  // Signature step
  return (
    <div className="flex flex-col h-full p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Complete Inspection</h1>
        <p className="text-muted-foreground">Sign to confirm inspection</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Additional Notes (optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={inspectorNotes}
            onChange={(e) => setInspectorNotes(e.target.value)}
            placeholder="Any additional observations..."
            className="text-base md:text-sm"
            data-testid="textarea-notes"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Inspector Signature *</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSignature}
              data-testid="button-clear-signature"
            >
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <canvas
            ref={signatureCanvasRef}
            width={400}
            height={200}
            className="w-full border rounded-md bg-white cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            data-testid="canvas-signature"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Sign above using your mouse or finger
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-2 sticky bottom-0 bg-background py-4 border-t">
        <Button
          variant="outline"
          onClick={() => setCurrentStep('inspection')}
          className="flex-1"
          data-testid="button-back-to-inspection"
        >
          Back
        </Button>
        <Button
          onClick={() => createInspectionMutation.mutate()}
          disabled={!hasSignature || createInspectionMutation.isPending}
          className="flex-1"
          data-testid="button-submit"
        >
          {createInspectionMutation.isPending ? 'Submitting...' : 'Complete Inspection'}
        </Button>
      </div>
    </div>
  );
}
