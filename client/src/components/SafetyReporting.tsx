import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  User,
  MapPin,
  Calendar,
  FileText,
  Plus,
  Eye,
  Bell,
  TrendingDown,
  Activity
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';

interface SafetyIncident {
  id: string;
  incidentNumber: string;
  type: 'near_miss' | 'minor_injury' | 'major_injury' | 'property_damage' | 'environmental' | 'equipment_failure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  title: string;
  description: string;
  location: string;
  jobId?: string;
  reportedBy: string;
  reportedAt: string;
  involvedPersons: string[];
  witnesses: string[];
  injuriesDescription?: string;
  immediateActions: string;
  rootCause?: string;
  preventiveActions?: string;
  followUpRequired: boolean;
  followUpDate?: string;
  assignedTo?: string;
  photos?: string[];
  cost?: number;
}

interface SafetyReportingProps {
  compact?: boolean;
}

const mockIncidentData: SafetyIncident[] = [
  {
    id: '1',
    incidentNumber: 'INC-2024-001',
    type: 'near_miss',
    severity: 'medium',
    status: 'resolved',
    title: 'Branch fell near team member',
    description: 'Large branch fell within 2 meters of ground crew member during tree removal. No injury occurred.',
    location: '123 Main Street, Auckland',
    jobId: '1',
    reportedBy: 'Mike Johnson',
    reportedAt: '2024-12-15T11:30:00Z',
    involvedPersons: ['David Wilson'],
    witnesses: ['Sarah Chen'],
    immediateActions: 'Stopped work, reviewed cutting plan, improved communication protocols',
    rootCause: 'Insufficient communication between climber and ground crew',
    preventiveActions: 'Implemented radio communication for all tree work, updated safety briefing procedures',
    followUpRequired: false,
    photos: ['incident-1-photo-1.jpg', 'incident-1-photo-2.jpg']
  },
  {
    id: '2',
    incidentNumber: 'INC-2024-002',
    type: 'minor_injury',
    severity: 'low',
    status: 'closed',
    title: 'Minor cut from chainsaw chain',
    description: 'Team member sustained minor cut on hand while cleaning chainsaw chain. First aid administered on site.',
    location: '456 Oak Avenue, North Shore',
    jobId: '2',
    reportedBy: 'Sarah Chen',
    reportedAt: '2024-12-12T14:15:00Z',
    involvedPersons: ['Emma Thompson'],
    witnesses: ['Mike Johnson'],
    injuriesDescription: 'Small laceration on left index finger, approximately 1cm long, shallow',
    immediateActions: 'First aid administered, work stopped for safety review, injury documented',
    rootCause: 'Improper handling of chainsaw during maintenance',
    preventiveActions: 'Refresher training on chainsaw maintenance safety, updated PPE requirements',
    followUpRequired: false,
    cost: 50
  },
  {
    id: '3',
    incidentNumber: 'INC-2024-003',
    type: 'equipment_failure',
    severity: 'high',
    status: 'investigating',
    title: 'Crane hydraulic system failure',
    description: 'Crane hydraulic system lost pressure during tree removal operation. Load was safely lowered using backup systems.',
    location: 'Central Business District, Auckland',
    jobId: '3',
    reportedBy: 'David Wilson',
    reportedAt: '2024-12-18T09:45:00Z',
    involvedPersons: ['David Wilson', 'Mike Johnson'],
    witnesses: ['Sarah Chen', 'Emma Thompson'],
    immediateActions: 'Operation stopped immediately, area evacuated, backup systems engaged, equipment isolated',
    followUpRequired: true,
    followUpDate: '2024-12-25T00:00:00Z',
    assignedTo: 'Mike Johnson',
    cost: 2500
  },
  {
    id: '4',
    incidentNumber: 'INC-2024-004',
    type: 'property_damage',
    severity: 'medium',
    status: 'reported',
    title: 'Tree branch damaged fence',
    description: 'During controlled tree removal, branch deflected and damaged section of customer\'s fence.',
    location: '789 Pine Street, West Auckland',
    jobId: '4',
    reportedBy: 'Emma Thompson',
    reportedAt: '2024-12-19T13:20:00Z',
    involvedPersons: ['Emma Thompson'],
    witnesses: ['Customer - John Smith'],
    immediateActions: 'Work stopped, damage assessed, customer notified, photos taken, insurance contacted',
    followUpRequired: true,
    followUpDate: '2024-12-22T00:00:00Z',
    assignedTo: 'Sarah Chen',
    cost: 800,
    photos: ['property-damage-1.jpg']
  }
];

export function SafetyReporting({ compact = false }: SafetyReportingProps) {
  const [selectedIncident, setSelectedIncident] = useState<SafetyIncident | null>(null);
  const [showNewIncidentDialog, setShowNewIncidentDialog] = useState(false);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'near_miss': return 'bg-blue-500';
      case 'minor_injury': return 'bg-yellow-500';
      case 'major_injury': return 'bg-red-500';
      case 'property_damage': return 'bg-orange-500';
      case 'environmental': return 'bg-green-500';
      case 'equipment_failure': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reported': return 'bg-blue-500';
      case 'investigating': return 'bg-yellow-500';
      case 'resolved': return 'bg-green-500';
      case 'closed': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const formatIncidentType = (type: string) => {
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (compact) {
    const openIncidents = mockIncidentData.filter(incident => 
      incident.status === 'reported' || incident.status === 'investigating'
    ).length;
    
    const recentIncidents = mockIncidentData
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .slice(0, 3);

    const highSeverityOpen = mockIncidentData.filter(incident => 
      (incident.status === 'reported' || incident.status === 'investigating') && 
      (incident.severity === 'high' || incident.severity === 'critical')
    ).length;

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
              <Badge variant={openIncidents > 0 ? "destructive" : "secondary"} data-testid="open-incidents">
                {openIncidents}
              </Badge>
            </div>

            {highSeverityOpen > 0 && (
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {highSeverityOpen} high-severity incident{highSeverityOpen > 1 ? 's' : ''} require attention
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Recent Incidents</h4>
              <div className="space-y-2">
                {recentIncidents.map((incident) => (
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
    <div className="space-y-6">
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
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Report Safety Incident</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Incident Type</label>
                      <Select>
                        <SelectTrigger data-testid="incident-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="near_miss">Near Miss</SelectItem>
                          <SelectItem value="minor_injury">Minor Injury</SelectItem>
                          <SelectItem value="major_injury">Major Injury</SelectItem>
                          <SelectItem value="property_damage">Property Damage</SelectItem>
                          <SelectItem value="equipment_failure">Equipment Failure</SelectItem>
                          <SelectItem value="environmental">Environmental</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Severity</label>
                      <Select>
                        <SelectTrigger data-testid="incident-severity">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-1 block">Incident Title</label>
                      <Input placeholder="Brief description of the incident" data-testid="incident-title" />
                    </div>

                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-1 block">Location</label>
                      <Input placeholder="Where did this incident occur?" data-testid="incident-location" />
                    </div>

                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-1 block">Detailed Description</label>
                      <Textarea 
                        placeholder="Provide detailed description of what happened, when, and circumstances" 
                        className="min-h-[100px]"
                        data-testid="incident-description"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-1 block">Immediate Actions Taken</label>
                      <Textarea 
                        placeholder="What immediate actions were taken to address the situation?" 
                        className="min-h-[80px]"
                        data-testid="immediate-actions"
                      />
                    </div>

                    <div className="col-span-2 flex gap-2">
                      <Button className="flex-1" data-testid="submit-incident">
                        Submit Report
                      </Button>
                      <Button variant="outline" className="flex-1" data-testid="submit-notify">
                        Submit & Notify Manager
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockIncidentData.map((incident) => (
              <Card 
                key={incident.id} 
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedIncident(incident)}
                data-testid={`incident-card-${incident.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold" data-testid={`incident-title-${incident.id}`}>
                        {incident.incidentNumber}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`incident-desc-${incident.id}`}>
                        {incident.title}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Badge className={`${getStatusColor(incident.status)} text-white text-xs`}>
                        {incident.status}
                      </Badge>
                      <Badge className={`${getSeverityColor(incident.severity)} text-white text-xs`}>
                        {incident.severity}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge className={`${getTypeColor(incident.type)} text-white text-xs`}>
                        {formatIncidentType(incident.type)}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span data-testid={`incident-date-${incident.id}`}>
                        {format(new Date(incident.reportedAt), 'MMM dd, yyyy HH:mm')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate" data-testid={`incident-location-${incident.id}`}>
                        {incident.location}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span data-testid={`incident-reporter-${incident.id}`}>
                        Reported by {incident.reportedBy}
                      </span>
                    </div>

                    {incident.cost && (
                      <div className="flex items-center justify-between">
                        <span>Estimated cost:</span>
                        <span className="font-medium text-red-600" data-testid={`incident-cost-${incident.id}`}>
                          ${incident.cost}
                        </span>
                      </div>
                    )}
                  </div>

                  {incident.followUpRequired && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center gap-2 text-yellow-700">
                        <Bell className="h-4 w-4" />
                        <span className="text-xs">
                          Follow-up required by {incident.followUpDate && format(new Date(incident.followUpDate), 'MMM dd')}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="incident-detail-title">
                {selectedIncident.incidentNumber} - {selectedIncident.title}
              </DialogTitle>
            </DialogHeader>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Incident Overview</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <Badge className={`${getTypeColor(selectedIncident.type)} text-white`}>
                        {formatIncidentType(selectedIncident.type)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Severity:</span>
                      <Badge className={`${getSeverityColor(selectedIncident.severity)} text-white`}>
                        {selectedIncident.severity}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <Badge className={`${getStatusColor(selectedIncident.status)} text-white`}>
                        {selectedIncident.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Reported:</span>
                      <span>{format(new Date(selectedIncident.reportedAt), 'MMM dd, yyyy HH:mm')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Location:</span>
                      <span className="text-right">{selectedIncident.location}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">People Involved</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">Reported by:</span> {selectedIncident.reportedBy}
                    </div>
                    {selectedIncident.involvedPersons.length > 0 && (
                      <div>
                        <span className="font-medium">Involved:</span> {selectedIncident.involvedPersons.join(', ')}
                      </div>
                    )}
                    {selectedIncident.witnesses.length > 0 && (
                      <div>
                        <span className="font-medium">Witnesses:</span> {selectedIncident.witnesses.join(', ')}
                      </div>
                    )}
                  </div>
                </div>

                {selectedIncident.cost && (
                  <div>
                    <h4 className="font-semibold mb-2">Financial Impact</h4>
                    <div className="text-lg font-bold text-red-600">
                      ${selectedIncident.cost} estimated cost
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Immediate Actions</h4>
                  <p className="text-sm text-muted-foreground">{selectedIncident.immediateActions}</p>
                </div>

                {selectedIncident.rootCause && (
                  <div>
                    <h4 className="font-semibold mb-2">Root Cause</h4>
                    <p className="text-sm text-muted-foreground">{selectedIncident.rootCause}</p>
                  </div>
                )}

                {selectedIncident.preventiveActions && (
                  <div>
                    <h4 className="font-semibold mb-2">Preventive Actions</h4>
                    <p className="text-sm text-muted-foreground">{selectedIncident.preventiveActions}</p>
                  </div>
                )}

                {selectedIncident.followUpRequired && (
                  <Alert className="border-yellow-200 bg-yellow-50">
                    <Bell className="h-4 w-4" />
                    <AlertDescription>
                      Follow-up required by{' '}
                      {selectedIncident.followUpDate && format(new Date(selectedIncident.followUpDate), 'MMM dd, yyyy')}
                      {selectedIncident.assignedTo && ` - Assigned to ${selectedIncident.assignedTo}`}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button variant="outline" data-testid="update-incident">
                <FileText className="h-4 w-4 mr-2" />
                Update Incident
              </Button>
              <Button variant="outline" data-testid="print-report">
                <FileText className="h-4 w-4 mr-2" />
                Print Report
              </Button>
              {selectedIncident.status !== 'closed' && (
                <Button data-testid="close-incident">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Close Incident
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}