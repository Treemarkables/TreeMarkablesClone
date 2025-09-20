import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Calendar,
  Clock,
  MapPin,
  Phone,
  User,
  Users,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List
} from 'lucide-react';
import { useState } from 'react';
import { format, addDays, subDays, startOfDay, addHours, isSameDay, parseISO } from 'date-fns';

interface StaffMember {
  id: string;
  name: string;
  role: string;
  skills: string[];
  status: 'available' | 'busy' | 'offline';
  color: string;
}

interface Team {
  id: string;
  name: string;
  description?: string;
  teamLeaderId: string;
  members: string[]; // Staff IDs
  specialties: string[];
  maxCapacity: number;
  status: 'available' | 'busy' | 'offline';
  color: string;
}

interface JobAssignment {
  id: string;
  jobId: string;
  teamId: string; // Changed from staffId to teamId
  assignedTeam: string[]; // Array of staff member IDs
  customerName: string;
  customerPhone: string;
  address: string;
  serviceType: string;
  startTime: string;
  endTime: string;
  duration: number; // hours
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string;
}

interface DispatchBoardProps {
  compact?: boolean;
}

const mockStaffMembers: StaffMember[] = [
  {
    id: '1',
    name: 'Daniel Rodriguez',
    role: 'Senior Arborist',
    skills: ['Crane Operation', 'Hazardous Removal'],
    status: 'available',
    color: 'bg-blue-500'
  },
  {
    id: '2', 
    name: 'Fenton Chavez',
    role: 'Arborist',
    skills: ['Tree Climbing', 'Pruning'],
    status: 'busy',
    color: 'bg-green-500'
  },
  {
    id: '3',
    name: 'Jack Williams',
    role: 'Ground Crew',
    skills: ['Equipment Operation', 'Cleanup'],
    status: 'available',
    color: 'bg-orange-500'
  },
  {
    id: '4',
    name: 'Josh Martinez',
    role: 'Equipment Specialist',
    skills: ['Heavy Machinery', 'Maintenance'],
    status: 'available',
    color: 'bg-purple-500'
  },
  {
    id: '5',
    name: 'Julian Thompson',
    role: 'Arborist',
    skills: ['Tree Climbing', 'Safety'],
    status: 'offline',
    color: 'bg-red-500'
  },
  {
    id: '6',
    name: 'Kelsey Johnson',
    role: 'Ground Crew',
    skills: ['Cleanup', 'Customer Service'],
    status: 'available',
    color: 'bg-pink-500'
  }
];

const mockTeams: Team[] = [
  {
    id: 'team1',
    name: 'Alpha Crew',
    description: 'Emergency response and hazardous removals',
    teamLeaderId: '1',
    members: ['1', '2'],
    specialties: ['Crane Operation', 'Hazardous Removal', 'Emergency Response'],
    maxCapacity: 3,
    status: 'busy',
    color: 'bg-red-500'
  },
  {
    id: 'team2',
    name: 'Beta Crew',
    description: 'General tree services and maintenance',
    teamLeaderId: '3',
    members: ['3', '6'],
    specialties: ['Tree Pruning', 'Cleanup', 'Customer Service'],
    maxCapacity: 4,
    status: 'available',
    color: 'bg-green-500'
  },
  {
    id: 'team3',
    name: 'Equipment Team',
    description: 'Heavy machinery and specialized equipment jobs',
    teamLeaderId: '4',
    members: ['4', '5'],
    specialties: ['Heavy Machinery', 'Equipment Operation', 'Maintenance'],
    maxCapacity: 2,
    status: 'available',
    color: 'bg-purple-500'
  }
];

const mockJobAssignments: JobAssignment[] = [
  {
    id: '1',
    jobId: 'J001',
    teamId: 'team1',
    assignedTeam: ['1', '2'],
    customerName: 'Stephanie Syre',
    customerPhone: '(555) 123-4567',
    address: '123 Norfolk Pine Ave',
    serviceType: 'Tree Removal',
    startTime: '2024-12-20T09:00:00',
    endTime: '2024-12-20T12:00:00',
    duration: 3,
    status: 'scheduled',
    priority: 'high',
    notes: 'Large oak near power lines'
  },
  {
    id: '2',
    jobId: 'J002',
    teamId: 'team1',
    assignedTeam: ['1', '2'],
    customerName: 'Dave Tarry',
    customerPhone: '(555) 234-5678',
    address: '33 Wellington St, Gisborne',
    serviceType: 'Emergency Removal',
    startTime: '2024-12-20T07:30:00',
    endTime: '2024-12-20T10:30:00',
    duration: 3,
    status: 'in_progress',
    priority: 'urgent'
  },
  {
    id: '3',
    jobId: 'J003',
    teamId: 'team2',
    assignedTeam: ['3', '6'],
    customerName: 'Johnson, Sarah',
    customerPhone: '(555) 345-6789',
    address: '456 Elm Street',
    serviceType: 'Tree Pruning',
    startTime: '2024-12-20T13:00:00',
    endTime: '2024-12-20T15:00:00',
    duration: 2,
    status: 'scheduled',
    priority: 'medium',
    notes: 'Quote for removing large oak tree'
  },
  {
    id: '4',
    jobId: 'J004',
    teamId: 'team3',
    assignedTeam: ['4', '5'],
    customerName: 'Gray, Alex',
    customerPhone: '(555) 456-7890',
    address: '789 Pine Avenue',
    serviceType: 'Equipment Setup',
    startTime: '2024-12-20T15:45:00',
    endTime: '2024-12-20T16:15:00',
    duration: 0.5,
    status: 'scheduled',
    priority: 'low',
    notes: 'Heavy equipment positioning'
  },
  {
    id: '5',
    jobId: 'J005',
    teamId: 'team2',
    assignedTeam: ['3', '6'],
    customerName: 'Baty, Katrina',
    customerPhone: '(555) 567-8901',
    address: '321 Maple Drive',
    serviceType: 'Quote',
    startTime: '2024-12-20T10:00:00',
    endTime: '2024-12-20T11:00:00',
    duration: 1,
    status: 'scheduled',
    priority: 'medium'
  }
];

const timeSlots = [
  '7:00', '8:00', '9:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'
];

export function DispatchBoard({ compact = false }: DispatchBoardProps) {
  const [selectedDate, setSelectedDate] = useState(new Date('2024-12-20'));
  const [selectedJob, setSelectedJob] = useState<JobAssignment | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800';
      case 'busy': return 'bg-yellow-100 text-yellow-800';
      case 'offline': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getJobsForTeam = (teamId: string) => {
    return mockJobAssignments.filter(job => {
      if (job.teamId !== teamId) return false;
      return isSameDay(new Date(job.startTime), selectedDate);
    });
  };

  const getTeamMembers = (teamId: string) => {
    const team = mockTeams.find(t => t.id === teamId);
    if (!team) return [];
    return team.members.map(memberId => mockStaffMembers.find(s => s.id === memberId)).filter(Boolean) as StaffMember[];
  };

  const getTodaysJobs = () => {
    return mockJobAssignments
      .filter(job => isSameDay(new Date(job.startTime), selectedDate))
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  };

  if (compact) {
    const todaysJobs = getTodaysJobs();
    const activeTeams = mockTeams.filter(team => team.status === 'available').length;
    const scheduledJobs = todaysJobs.filter(job => job.status === 'scheduled').length;

    return (
      <Card data-testid="dispatch-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dispatch Board
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Active Teams</span>
              </div>
              <Badge variant="secondary" data-testid="active-teams">
                {activeTeams}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm">Scheduled Jobs</span>
              </div>
              <Badge variant="outline" data-testid="scheduled-jobs">
                {scheduledJobs}
              </Badge>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Next Jobs</span>
                <span className="text-xs text-muted-foreground" data-testid="dispatch-date">
                  {format(selectedDate, 'MMM dd')}
                </span>
              </div>
              <div className="space-y-2">
                {todaysJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-sm"
                    data-testid={`next-job-${job.id}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${getPriorityColor(job.priority)}`} />
                    <div className="flex-1 truncate">
                      <div className="font-medium">{job.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(job.startTime), 'HH:mm')} - {job.serviceType}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              className="w-full" 
              data-testid="open-dispatch-board"
              onClick={() => {
                // Create a custom event to switch to dispatch tab
                const event = new CustomEvent('switchTab', { detail: 'dispatch' });
                window.dispatchEvent(event);
              }}
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Open Dispatch Board
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Dispatch Board
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(subDays(selectedDate, 1))}
                data-testid="prev-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium px-4" data-testid="current-date">
                {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                data-testid="next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDate(new Date())}
                data-testid="today-btn"
              >
                Today
              </Button>
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  data-testid="grid-view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  data-testid="list-view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="flex gap-4 h-[600px]">
            {/* Team Column */}
            <div className="w-48 border-r pr-4">
              <h3 className="font-semibold mb-4 text-sm text-muted-foreground">TEAMS</h3>
              <div className="space-y-2">
                {mockTeams.map((team) => {
                  const teamMembers = getTeamMembers(team.id);
                  const todaysJobs = getJobsForTeam(team.id);
                  return (
                    <div
                      key={team.id}
                      className="flex items-center gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                      data-testid={`team-${team.id}`}
                    >
                      <div className={`w-3 h-3 rounded-full ${team.color}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{team.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {teamMembers.length} members • {todaysJobs.length} jobs
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${getStatusColor(team.status)}`}
                      >
                        {team.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Grid */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Time Headers */}
                <div className="grid grid-cols-12 gap-1 mb-2">
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      className="text-center text-xs font-medium text-muted-foreground p-2 border-b"
                      data-testid={`time-slot-${time}`}
                    >
                      {time}
                    </div>
                  ))}
                </div>

                {/* Team Rows */}
                <div className="space-y-1">
                  {mockTeams.map((team) => {
                    const teamJobs = getJobsForTeam(team.id);
                    return (
                      <div key={team.id} className="relative h-16" data-testid={`team-row-${team.id}`}>
                        {/* Time Grid Background */}
                        <div className="grid grid-cols-12 gap-1 h-full absolute inset-0 z-0">
                          {timeSlots.map((time) => (
                            <div
                              key={`${team.id}-${time}`}
                              className="border border-gray-200 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                              data-testid={`time-cell-${team.id}-${time}`}
                            />
                          ))}
                        </div>
                        
                        {/* Job Blocks */}
                        <div className="relative h-full z-10">
                          {teamJobs.map((job) => {
                            const jobStart = new Date(job.startTime);
                            const jobEnd = new Date(job.endTime);
                            const dayStart = new Date(selectedDate);
                            dayStart.setHours(7, 0, 0, 0); // 7:00 AM start
                            
                            const startHour = jobStart.getHours();
                            const startMinutes = jobStart.getMinutes();
                            const endHour = jobEnd.getHours();
                            const endMinutes = jobEnd.getMinutes();
                            
                            // Calculate position and width as percentage of the 12-hour grid (7 AM to 7 PM)
                            const totalMinutes = 12 * 60; // 7 AM to 7 PM = 12 hours = 720 minutes
                            const jobStartMinutes = (startHour - 7) * 60 + startMinutes;
                            const jobEndMinutes = (endHour - 7) * 60 + endMinutes;
                            
                            const leftPercent = Math.max(0, (jobStartMinutes / totalMinutes) * 100);
                            const widthPercent = Math.min(100 - leftPercent, ((jobEndMinutes - jobStartMinutes) / totalMinutes) * 100);
                            
                            return (
                              <div
                                key={job.id}
                                className={`absolute ${getPriorityColor(job.priority)} text-white rounded text-xs p-1 cursor-pointer hover:opacity-80 transition-opacity top-1 bottom-1`}
                                onClick={() => setSelectedJob(job)}
                                data-testid={`job-block-${job.id}`}
                                style={{
                                  left: `${leftPercent}%`,
                                  width: `${widthPercent}%`,
                                  minWidth: '80px'
                                }}
                              >
                                <div className="font-medium truncate text-[10px]">
                                  {job.customerName}
                                </div>
                                <div className="truncate text-[9px] opacity-90">
                                  {job.serviceType}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Jobs Panel */}
            <div className="w-80 border-l pl-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-muted-foreground">JOBS</h3>
                <Button size="sm" data-testid="add-job-btn">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              <div className="h-[540px] overflow-y-auto">
                <div className="space-y-3">
                  {getTodaysJobs().map((job) => {
                    const team = mockTeams.find(t => t.id === job.teamId);
                    const teamMembers = team ? getTeamMembers(team.id) : [];
                    return (
                      <Card
                        key={job.id}
                        className="hover-elevate cursor-pointer"
                        onClick={() => setSelectedJob(job)}
                        data-testid={`job-card-${job.id}`}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${getPriorityColor(job.priority)}`} />
                              <span className="font-medium text-sm">#{job.jobId}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-xs ${job.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-700'}`}
                            >
                              {job.status}
                            </Badge>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-medium text-sm" data-testid={`job-customer-${job.id}`}>
                              {job.customerName}
                            </h4>
                            <p className="text-xs text-muted-foreground" data-testid={`job-service-${job.id}`}>
                              {job.serviceType}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate" data-testid={`job-address-${job.id}`}>
                                {job.address}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span data-testid={`job-time-${job.id}`}>
                                {format(new Date(job.startTime), 'HH:mm')} - {format(new Date(job.endTime), 'HH:mm')}
                              </span>
                            </div>
                            {team && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                <span data-testid={`job-team-${job.id}`}>
                                  {team.name} ({teamMembers.length} members)
                                </span>
                              </div>
                            )}
                          </div>

                          {job.notes && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              {job.notes}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job Detail Modal */}
      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getPriorityColor(selectedJob.priority)}`} />
                Job #{selectedJob.jobId} Details
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Customer Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Name:</span>
                    <span className="font-medium">{selectedJob.customerName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span>{selectedJob.customerPhone}</span>
                  </div>
                  <div className="flex items-start justify-between">
                    <span className="text-muted-foreground">Address:</span>
                    <span className="text-right max-w-[200px]">{selectedJob.address}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Team Assignment</h4>
                <div className="space-y-2 text-sm">
                  {(() => {
                    const team = mockTeams.find(t => t.id === selectedJob.teamId);
                    const teamMembers = team ? getTeamMembers(team.id) : [];
                    return (
                      <div>
                        {team && (
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Team:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{team.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {teamMembers.length} members
                              </Badge>
                            </div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-xs text-muted-foreground">Team Members:</span>
                          <div className="space-y-1 ml-2">
                            {teamMembers.map((member) => (
                              <div key={member.id} className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-xs">
                                    {member.name.split(' ').map(n => n[0]).join('')}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <span className="text-xs font-medium">{member.name}</span>
                                  <div className="text-xs text-muted-foreground">{member.role}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-sm mb-2">Job Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="font-medium">{selectedJob.serviceType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span>{selectedJob.duration}h</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Priority:</span>
                    <Badge className={`${getPriorityColor(selectedJob.priority)} text-white text-xs`}>
                      {selectedJob.priority}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant="outline" className="text-xs">
                      {selectedJob.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {selectedJob.notes && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted/50 p-2 rounded-md">
                    {selectedJob.notes}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" data-testid="edit-job">
                  Edit Job
                </Button>
                <Button className="flex-1" data-testid="complete-job">
                  Mark Complete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}