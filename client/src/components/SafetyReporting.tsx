import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, 
  Plus, 
  TrendingDown, 
  AlertTriangle, 
  Activity,
  Eye,
  Edit,
  Trash2,
  Calendar,
  MapPin,
  User,
  FileText
} from 'lucide-react';
import type { 
  SafetyIncident, InsertSafetyIncident, 
  RiskAssessment, InsertRiskAssessment,
  ComplianceRequirement, InsertComplianceRequirement 
} from '@shared/schema';
import { 
  safetyIncidentInsertSchema, 
  riskAssessmentInsertSchema,
  complianceRequirementInsertSchema 
} from '@shared/schema';
import { queryClient, apiRequest } from '@/lib/queryClient';

// Use shared schema for consistency
type SafetyIncidentFormData = InsertSafetyIncident;
type RiskAssessmentFormData = InsertRiskAssessment;
type ComplianceRequirementFormData = InsertComplianceRequirement;

interface SafetyReportingProps {
  compact?: boolean;
}

export function SafetyReporting({ compact = false }: SafetyReportingProps) {
  const { toast } = useToast();
  const [showNewIncidentDialog, setShowNewIncidentDialog] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [filter, setFilter] = useState<{ type?: string; severity?: string; status?: string }>({});
  
  // Risk Assessment State
  const [showNewRiskAssessmentDialog, setShowNewRiskAssessmentDialog] = useState(false);
  const [selectedRiskAssessment, setSelectedRiskAssessment] = useState<RiskAssessment | null>(null);
  const [showEditRiskAssessmentDialog, setShowEditRiskAssessmentDialog] = useState(false);
  
  // Compliance State
  const [showNewComplianceDialog, setShowNewComplianceDialog] = useState(false);
  const [selectedCompliance, setSelectedCompliance] = useState<ComplianceRequirement | null>(null);
  const [showEditComplianceDialog, setShowEditComplianceDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'incidents' | 'assessments' | 'compliance'>('incidents');

  // Fetch safety incidents
  const { data: incidentsResponse, isLoading } = useQuery({
    queryKey: ['/api/safety-incidents'],
  });
  
  const incidents = incidentsResponse?.data || [];

  // Fetch risk assessments
  const { data: assessmentsResponse, isLoading: isLoadingAssessments } = useQuery({
    queryKey: ['/api/risk-assessments'],
  });
  
  const riskAssessments = assessmentsResponse?.data || [];

  // Fetch compliance requirements
  const { data: complianceResponse, isLoading: isLoadingCompliance } = useQuery({
    queryKey: ['/api/compliance/requirements'],
  });
  
  const complianceRequirements = complianceResponse?.data || [];

  // Fetch compliance analytics
  const { data: complianceAnalyticsResponse } = useQuery({
    queryKey: ['/api/compliance/analytics'],
  });
  
  const complianceAnalytics = complianceAnalyticsResponse?.data || {};

  // Create incident mutation
  const createIncidentMutation = useMutation({
    mutationFn: async (data: SafetyIncidentFormData) => {
      // Let server generate incident number for security and consistency
      const payload: InsertSafetyIncident = {
        ...data,
        status: 'reported',
        reportedBy: data.reportedBy || 'Current User',
      };
      return apiRequest('POST', '/api/safety-incidents', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safety-incidents'] });
      setShowNewIncidentDialog(false);
      toast({
        title: 'Success',
        description: 'Safety incident reported successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create incident: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update incident mutation
  const updateIncidentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SafetyIncidentFormData> }) => {
      return apiRequest('PUT', `/api/safety-incidents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safety-incidents'] });
      setShowEditDialog(false);
      setSelectedIncident(null);
      toast({
        title: 'Success',
        description: 'Incident updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update incident: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Create risk assessment mutation
  const createRiskAssessmentMutation = useMutation({
    mutationFn: async (data: RiskAssessmentFormData) => {
      return apiRequest('POST', '/api/risk-assessments', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/risk-assessments'] });
      setShowNewRiskAssessmentDialog(false);
      toast({
        title: 'Success',
        description: 'Risk assessment created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create risk assessment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update risk assessment mutation
  const updateRiskAssessmentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RiskAssessmentFormData> }) => {
      return apiRequest('PUT', `/api/risk-assessments/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/risk-assessments'] });
      setShowEditRiskAssessmentDialog(false);
      setSelectedRiskAssessment(null);
      toast({
        title: 'Success',
        description: 'Risk assessment updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update risk assessment: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Create compliance requirement mutation
  const createComplianceMutation = useMutation({
    mutationFn: async (data: ComplianceRequirementFormData) => {
      return apiRequest('POST', '/api/compliance/requirements', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/requirements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/analytics'] });
      setShowNewComplianceDialog(false);
      toast({
        title: 'Success',
        description: 'Compliance requirement created successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create compliance requirement: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Update compliance requirement mutation
  const updateComplianceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ComplianceRequirementFormData> }) => {
      return apiRequest('PUT', `/api/compliance/requirements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/requirements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/compliance/analytics'] });
      setShowEditComplianceDialog(false);
      setSelectedCompliance(null);
      toast({
        title: 'Success',
        description: 'Compliance requirement updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update compliance requirement: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Delete incident mutation
  const deleteIncidentMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/safety-incidents/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/safety-incidents'] });
      toast({
        title: 'Success',
        description: 'Incident deleted successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to delete incident: ${error.message}`,
        variant: 'destructive',
      });
    },
  });

  // Form for creating new incidents
  const newIncidentForm = useForm<SafetyIncidentFormData>({
    resolver: zodResolver(safetyIncidentInsertSchema),
    defaultValues: {
      type: '',
      severity: '',
      title: '',
      location: '',
      description: '',
      immediateActions: '',
      reportedBy: 'Current User',
    },
  });

  // Form for editing incidents
  const editIncidentForm = useForm<SafetyIncidentFormData>({
    resolver: zodResolver(safetyIncidentInsertSchema),
  });

  // Set edit form values when incident is selected (fix useEffect usage)
  useEffect(() => {
    if (selectedIncident) {
      editIncidentForm.reset({
        type: selectedIncident.type,
        severity: selectedIncident.severity,
        title: selectedIncident.title,
        location: selectedIncident.location,
        description: selectedIncident.description,
        immediateActions: selectedIncident.immediateActions,
        resolutionNotes: selectedIncident.resolutionNotes || '',
      });
    }
  }, [selectedIncident, editIncidentForm]);

  // Risk Assessment Forms
  const newRiskAssessmentForm = useForm<RiskAssessmentFormData>({
    resolver: zodResolver(riskAssessmentInsertSchema),
    defaultValues: {
      jobId: '',
      assessedBy: 'Current User',
      overallRisk: '',
      weatherRisk: '',
      equipmentRisk: '',
      siteConditions: '',
      hazards: [],
      controlMeasures: [],
      requiredPPE: [],
      recommendations: '',
      approvedBy: '',
      isActive: true,
    },
  });

  const editRiskAssessmentForm = useForm<RiskAssessmentFormData>({
    resolver: zodResolver(riskAssessmentInsertSchema),
  });

  // Set edit form values when risk assessment is selected
  useEffect(() => {
    if (selectedRiskAssessment) {
      editRiskAssessmentForm.reset({
        jobId: selectedRiskAssessment.jobId,
        assessedBy: selectedRiskAssessment.assessedBy,
        overallRisk: selectedRiskAssessment.overallRisk,
        weatherRisk: selectedRiskAssessment.weatherRisk || '',
        equipmentRisk: selectedRiskAssessment.equipmentRisk || '',
        siteConditions: selectedRiskAssessment.siteConditions,
        hazards: selectedRiskAssessment.hazards || [],
        controlMeasures: selectedRiskAssessment.controlMeasures || [],
        requiredPPE: selectedRiskAssessment.requiredPPE || [],
        recommendations: selectedRiskAssessment.recommendations || '',
        approvedBy: selectedRiskAssessment.approvedBy || '',
        isActive: selectedRiskAssessment.isActive,
      });
    }
  }, [selectedRiskAssessment, editRiskAssessmentForm]);

  const onSubmitNewIncident = (data: SafetyIncidentFormData) => {
    createIncidentMutation.mutate(data);
  };

  const onSubmitEditIncident = (data: SafetyIncidentFormData) => {
    if (selectedIncident) {
      updateIncidentMutation.mutate({ id: selectedIncident.id, data });
    }
  };

  const onSubmitNewRiskAssessment = (data: RiskAssessmentFormData) => {
    createRiskAssessmentMutation.mutate(data);
  };

  const onSubmitEditRiskAssessment = (data: RiskAssessmentFormData) => {
    if (selectedRiskAssessment) {
      updateRiskAssessmentMutation.mutate({ id: selectedRiskAssessment.id, data });
    }
  };

  const onSubmitNewCompliance = (data: ComplianceRequirementFormData) => {
    createComplianceMutation.mutate(data);
  };

  const onSubmitEditCompliance = (data: ComplianceRequirementFormData) => {
    if (selectedCompliance) {
      updateComplianceMutation.mutate({ id: selectedCompliance.id, data });
    }
  };

  // Compliance forms
  const newComplianceForm = useForm<ComplianceRequirementFormData>({
    resolver: zodResolver(complianceRequirementInsertSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      type: '',
      frequency: '',
      regulatoryBody: '',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      nextDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      priority: 'medium',
      status: 'pending',
      assignedTo: 'Current User',
      requirements: [],
      attachments: [],
      notes: '',
      complianceScore: undefined,
      isActive: true,
    },
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'reported': return 'bg-blue-500';
      case 'investigating': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'injury': return 'bg-red-500';
      case 'near_miss': return 'bg-yellow-500';
      case 'equipment_malfunction': return 'bg-orange-500';
      case 'environmental_hazard': return 'bg-green-600';
      case 'property_damage': return 'bg-purple-500';
      case 'violation': return 'bg-red-600';
      default: return 'bg-gray-500';
    }
  };

  const formatIncidentType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Filter incidents
  const filteredIncidents = incidents.filter((incident: SafetyIncident) => {
    if (filter.type && incident.type !== filter.type) return false;
    if (filter.severity && incident.severity !== filter.severity) return false;
    if (filter.status && incident.status !== filter.status) return false;
    return true;
  });

  // Calculate statistics
  const stats = {
    total: incidents.length,
    open: incidents.filter((i: SafetyIncident) => i.status === 'reported' || i.status === 'investigating').length,
    resolved: incidents.filter((i: SafetyIncident) => i.status === 'resolved').length,
    highSeverity: incidents.filter((i: SafetyIncident) => i.severity === 'high' || i.severity === 'critical').length,
  };

  if (compact) {
    const recentIncidents = incidents
      .sort((a: SafetyIncident, b: SafetyIncident) => 
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
      )
      .slice(0, 3);

    return (
      <Card data-testid="safety-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Safety Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Open Incidents</span>
              </div>
              <Badge variant={stats.open > 0 ? "destructive" : "secondary"} data-testid="open-incidents">
                {stats.open}
              </Badge>
            </div>

            {stats.highSeverity > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {stats.highSeverity} high-severity incident{stats.highSeverity > 1 ? 's' : ''} require attention
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Recent Incidents</h4>
              <div className="space-y-2">
                {recentIncidents.map((incident: SafetyIncident) => (
                  <div
                    key={incident.id}
                    className="flex items-center justify-between p-2 bg-muted/50 rounded-md cursor-pointer hover:bg-muted"
                    onClick={() => setSelectedIncident(incident)}
                    data-testid={`recent-incident-${incident.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={`${getTypeColor(incident.type)} text-white text-xs`}>
                        {formatIncidentType(incident.type)}
                      </Badge>
                      <span className="text-sm truncate">{incident.title}</span>
                    </div>
                    <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs`}>
                      {incident.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full" data-testid="view-all-incidents">
              <Eye className="h-4 w-4 mr-2" />
              View All Incidents
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 w-full max-w-full min-w-0 overflow-x-hidden">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground truncate">Safety Management</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'incidents' | 'assessments' | 'compliance')}>
        <TabsList className="grid w-full grid-cols-3 gap-1">
          <TabsTrigger value="incidents" data-testid="tab-incidents">
            <Shield className="w-4 h-4 mr-2" />
            Safety Incidents
          </TabsTrigger>
          <TabsTrigger value="assessments" data-testid="tab-assessments">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Risk Assessments
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">
            <FileText className="w-4 h-4 mr-2" />
            Compliance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incidents" className="space-y-4 sm:space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full max-w-full">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-open">{stats.open}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-resolved">{stats.resolved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Severity</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600" data-testid="stat-high-severity">{stats.highSeverity}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Incident Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Safety Incident Management
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" data-testid="safety-trends">
                <TrendingDown className="h-4 w-4 mr-2" />
                Trends
              </Button>
              <Dialog open={showNewIncidentDialog} onOpenChange={setShowNewIncidentDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="report-incident">
                    <Plus className="h-4 w-4 mr-2" />
                    Report Incident
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl" aria-describedby="new-incident-description">
                  <DialogHeader>
                    <DialogTitle>Report Safety Incident</DialogTitle>
                  </DialogHeader>
                  <div id="new-incident-description" className="sr-only">
                    Create a new safety incident report with details about the incident
                  </div>
                  <Form {...newIncidentForm}>
                    <form onSubmit={newIncidentForm.handleSubmit(onSubmitNewIncident)} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <FormField
                          control={newIncidentForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Incident Type</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="incident-type">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="near_miss">Near Miss</SelectItem>
                                  <SelectItem value="injury">Injury</SelectItem>
                                  <SelectItem value="equipment_malfunction">Equipment Malfunction</SelectItem>
                                  <SelectItem value="environmental_hazard">Environmental Hazard</SelectItem>
                                  <SelectItem value="property_damage">Property Damage</SelectItem>
                                  <SelectItem value="violation">Violation</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={newIncidentForm.control}
                          name="severity"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Severity</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="incident-severity">
                                    <SelectValue placeholder="Select severity" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                  <SelectItem value="critical">Critical</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={newIncidentForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Incident Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Brief description of the incident" data-testid="incident-title" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={newIncidentForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input placeholder="Where did this incident occur?" data-testid="incident-location" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={newIncidentForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Detailed Description</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Provide a detailed description of what happened" 
                                data-testid="incident-description"
                                rows={3}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={newIncidentForm.control}
                        name="immediateActions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Immediate Actions Taken</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="What immediate actions were taken to address this incident?" 
                                data-testid="immediate-actions"
                                rows={3}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button 
                          type="submit" 
                          disabled={createIncidentMutation.isPending}
                          data-testid="submit-incident"
                        >
                          {createIncidentMutation.isPending ? 'Submitting...' : 'Submit Report'}
                        </Button>
                        <Button 
                          type="submit" 
                          variant="outline"
                          disabled={createIncidentMutation.isPending}
                          data-testid="submit-notify"
                        >
                          {createIncidentMutation.isPending ? 'Submitting...' : 'Submit & Notify Manager'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Select value={filter.type || 'all'} onValueChange={(value) => setFilter(prev => ({ ...prev, type: value === 'all' ? undefined : value }))}>
              <SelectTrigger className="w-48" data-testid="filter-type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="near_miss">Near Miss</SelectItem>
                <SelectItem value="injury">Injury</SelectItem>
                <SelectItem value="equipment_malfunction">Equipment Malfunction</SelectItem>
                <SelectItem value="environmental_hazard">Environmental Hazard</SelectItem>
                <SelectItem value="property_damage">Property Damage</SelectItem>
                <SelectItem value="violation">Violation</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter.severity || 'all'} onValueChange={(value) => setFilter(prev => ({ ...prev, severity: value === 'all' ? undefined : value }))}>
              <SelectTrigger className="w-48" data-testid="filter-severity">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter.status || 'all'} onValueChange={(value) => setFilter(prev => ({ ...prev, status: value === 'all' ? undefined : value }))}>
              <SelectTrigger className="w-48" data-testid="filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="reported">Reported</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Incidents Table */}
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading incidents...</div>
              </div>
            ) : filteredIncidents.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-muted-foreground mb-2">No incidents found</h3>
                  <p className="text-sm text-muted-foreground">
                    {incidents.length === 0 ? 'No safety incidents have been reported yet.' : 'Try adjusting your filters.'}
                  </p>
                </div>
              </div>
            ) : (
              filteredIncidents.map((incident: SafetyIncident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`incident-row-${incident.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={`${getTypeColor(incident.type)} text-white text-xs`}>
                        {formatIncidentType(incident.type)}
                      </Badge>
                      <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs`}>
                        {incident.severity}
                      </Badge>
                      <Badge className={`${getStatusColor(incident.status)} text-white text-xs`}>
                        {incident.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <h4 className="font-medium" data-testid={`incident-title-${incident.id}`}>{incident.title}</h4>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{incident.location}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(incident.reportedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        <span>{incident.reportedBy}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedIncident(incident);
                        setShowEditDialog(true);
                      }}
                      data-testid={`edit-incident-${incident.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this incident?')) {
                          deleteIncidentMutation.mutate(incident.id);
                        }
                      }}
                      data-testid={`delete-incident-${incident.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Incident Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl" aria-describedby="edit-incident-description">
          <DialogHeader>
            <DialogTitle>Edit Safety Incident</DialogTitle>
          </DialogHeader>
          <div id="edit-incident-description" className="sr-only">
            Edit details of the selected safety incident
          </div>
          {selectedIncident && (
            <Form {...editIncidentForm}>
              <form onSubmit={editIncidentForm.handleSubmit(onSubmitEditIncident)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <FormField
                    control={editIncidentForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Incident Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="near_miss">Near Miss</SelectItem>
                            <SelectItem value="injury">Injury</SelectItem>
                            <SelectItem value="equipment_malfunction">Equipment Malfunction</SelectItem>
                            <SelectItem value="environmental_hazard">Environmental Hazard</SelectItem>
                            <SelectItem value="property_damage">Property Damage</SelectItem>
                            <SelectItem value="violation">Violation</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editIncidentForm.control}
                    name="severity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select severity" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editIncidentForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Incident Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief description of the incident" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editIncidentForm.control}
                  name="resolutionNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Add resolution notes if incident is resolved" 
                          rows={3}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button 
                    type="submit" 
                    disabled={updateIncidentMutation.isPending}
                  >
                    {updateIncidentMutation.isPending ? 'Updating...' : 'Update Incident'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setShowEditDialog(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="assessments" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground">Risk Assessments</h3>
            <Dialog open={showNewRiskAssessmentDialog} onOpenChange={setShowNewRiskAssessmentDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-assessment">
                  <Plus className="w-4 h-4 mr-2" />
                  New Assessment
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Risk Assessment</DialogTitle>
                </DialogHeader>
                <Form {...newRiskAssessmentForm}>
                  <form onSubmit={newRiskAssessmentForm.handleSubmit(onSubmitNewRiskAssessment)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={newRiskAssessmentForm.control}
                        name="jobId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job ID</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter job ID" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newRiskAssessmentForm.control}
                        name="assessedBy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assessed By</FormLabel>
                            <FormControl>
                              <Input placeholder="Assessor name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={newRiskAssessmentForm.control}
                        name="overallRisk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Overall Risk Level</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select risk level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newRiskAssessmentForm.control}
                        name="weatherRisk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weather Risk</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select weather risk" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="safe">Safe</SelectItem>
                                <SelectItem value="caution">Caution</SelectItem>
                                <SelectItem value="unsafe">Unsafe</SelectItem>
                                <SelectItem value="suspended">Suspended</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newRiskAssessmentForm.control}
                        name="equipmentRisk"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Equipment Risk</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select equipment risk" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={newRiskAssessmentForm.control}
                      name="siteConditions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Conditions</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Describe current site conditions..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newRiskAssessmentForm.control}
                      name="recommendations"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Recommendations</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Safety recommendations and additional measures..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="submit" 
                        disabled={createRiskAssessmentMutation.isPending}
                      >
                        {createRiskAssessmentMutation.isPending ? 'Creating...' : 'Create Assessment'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setShowNewRiskAssessmentDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Risk Assessment Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{riskAssessments.length}</div>
                  <div className="text-sm text-muted-foreground">Total Assessments</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {riskAssessments.filter((a: RiskAssessment) => a.overallRisk === 'high' || a.overallRisk === 'critical').length}
                  </div>
                  <div className="text-sm text-muted-foreground">High Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {riskAssessments.filter((a: RiskAssessment) => a.isActive).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Active</div>
                </div>
              </div>

              {isLoadingAssessments ? (
                <div className="text-center py-4">Loading assessments...</div>
              ) : riskAssessments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No risk assessments found. Create your first assessment to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {riskAssessments.map((assessment: RiskAssessment) => (
                    <div
                      key={assessment.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                      data-testid={`assessment-${assessment.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={`${getSeverityColor(assessment.overallRisk)} text-white`}>
                            {assessment.overallRisk.toUpperCase()}
                          </Badge>
                          <span className="font-medium">Job: {assessment.jobId}</span>
                          {assessment.weatherRisk && (
                            <Badge variant="outline">
                              Weather: {assessment.weatherRisk}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={assessment.isActive ? "default" : "secondary"}>
                            {assessment.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(assessment.assessmentDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Assessed by: {assessment.assessedBy}
                      </div>
                      {assessment.recommendations && (
                        <div className="mt-2 text-sm">
                          <strong>Recommendations:</strong> {assessment.recommendations}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-foreground">Compliance Monitoring</h3>
            <Dialog open={showNewComplianceDialog} onOpenChange={setShowNewComplianceDialog}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-compliance">
                  <Plus className="w-4 h-4 mr-2" />
                  New Requirement
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create Compliance Requirement</DialogTitle>
                </DialogHeader>
                <Form {...newComplianceForm}>
                  <form onSubmit={newComplianceForm.handleSubmit(onSubmitNewCompliance)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={newComplianceForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Requirement Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., Monthly Safety Inspection" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newComplianceForm.control}
                        name="assignedTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Assigned To</FormLabel>
                            <FormControl>
                              <Input placeholder="Responsible person" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={newComplianceForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Detailed description of the compliance requirement..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={newComplianceForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="safety">Safety</SelectItem>
                                <SelectItem value="environmental">Environmental</SelectItem>
                                <SelectItem value="regulatory">Regulatory</SelectItem>
                                <SelectItem value="internal">Internal</SelectItem>
                                <SelectItem value="certification">Certification</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newComplianceForm.control}
                        name="type"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="inspection">Inspection</SelectItem>
                                <SelectItem value="audit">Audit</SelectItem>
                                <SelectItem value="training">Training</SelectItem>
                                <SelectItem value="certification">Certification</SelectItem>
                                <SelectItem value="documentation">Documentation</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newComplianceForm.control}
                        name="frequency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Frequency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select frequency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                <SelectItem value="annual">Annual</SelectItem>
                                <SelectItem value="one_time">One Time</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newComplianceForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={newComplianceForm.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Date</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                value={field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={newComplianceForm.control}
                        name="nextDue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Next Due Date</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                value={field.value instanceof Date && !isNaN(field.value.getTime()) ? field.value.toISOString().split('T')[0] : ''}
                                onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={newComplianceForm.control}
                      name="regulatoryBody"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Regulatory Body (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., OSHA, EPA, Local Authority" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={newComplianceForm.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder="Additional notes or requirements..."
                              rows={3}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-2 pt-4">
                      <Button 
                        type="submit" 
                        disabled={createComplianceMutation.isPending}
                      >
                        {createComplianceMutation.isPending ? 'Creating...' : 'Create Requirement'}
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => setShowNewComplianceDialog(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Compliance Analytics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Requirements</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{complianceAnalytics.totalRequirements || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{complianceAnalytics.overdueRequirements || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming (30 days)</CardTitle>
                <Calendar className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{complianceAnalytics.upcomingRequirements || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{complianceAnalytics.averageComplianceScore || 0}%</div>
              </CardContent>
            </Card>
          </div>

          {/* Compliance Requirements List */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCompliance ? (
                <div className="text-center py-4">Loading requirements...</div>
              ) : complianceRequirements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No compliance requirements found. Create your first requirement to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {complianceRequirements.map((requirement: ComplianceRequirement) => (
                    <div
                      key={requirement.id}
                      className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                      data-testid={`requirement-${requirement.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={`${getSeverityColor(requirement.priority)} text-white`}>
                            {requirement.priority.toUpperCase()}
                          </Badge>
                          <span className="font-medium">{requirement.title}</span>
                          <Badge variant="outline">
                            {requirement.category}
                          </Badge>
                          <Badge variant="outline">
                            {requirement.frequency}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={
                              requirement.status === 'completed' ? 'default' : 
                              requirement.status === 'overdue' ? 'destructive' : 
                              'secondary'
                            }
                          >
                            {requirement.status}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            Due: {new Date(requirement.nextDue).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-muted-foreground">
                        Assigned to: {requirement.assignedTo}
                      </div>
                      <div className="mt-2 text-sm">
                        {requirement.description}
                      </div>
                      {requirement.regulatoryBody && (
                        <div className="mt-2 text-sm">
                          <strong>Regulatory Body:</strong> {requirement.regulatoryBody}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}