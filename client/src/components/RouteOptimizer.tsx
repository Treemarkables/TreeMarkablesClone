import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  MapPin, 
  Route, 
  Clock, 
  Fuel,
  Navigation,
  Users,
  Calendar,
  Target,
  TrendingUp,
  Settings,
  RefreshCw,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Truck,
  Zap
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface JobLocation {
  id: string;
  jobTitle: string;
  customerName: string;
  address: string;
  coordinates: { lat: number; lng: number };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimatedDuration: number; // hours
  crewRequired: number;
  preferredTime?: 'morning' | 'afternoon' | 'flexible';
  equipment: string[];
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  scheduledDate: string;
}

interface RouteOptimization {
  id: string;
  routeName: string;
  date: string;
  crew: string;
  totalDistance: number; // km
  estimatedTime: number; // hours
  fuelCost: number;
  jobSequence: JobLocation[];
  efficiency: number; // percentage
  status: 'draft' | 'active' | 'completed';
}

interface RouteOptimizerProps {
  compact?: boolean;
}

const mockJobLocations: JobLocation[] = [
  {
    id: '1',
    jobTitle: 'Large Oak Removal',
    customerName: 'Sarah Williams',
    address: '123 Main Street, Auckland Central',
    coordinates: { lat: -36.8485, lng: 174.7633 },
    priority: 'high',
    estimatedDuration: 4,
    crewRequired: 3,
    preferredTime: 'morning',
    equipment: ['crane', 'chainsaw', 'chipper'],
    status: 'scheduled',
    scheduledDate: '2024-12-21'
  },
  {
    id: '2',
    jobTitle: 'Hedge Trimming Commercial',
    customerName: 'Auckland Council',
    address: '456 Queen Street, Auckland CBD',
    coordinates: { lat: -36.8467, lng: 174.7650 },
    priority: 'medium',
    estimatedDuration: 2,
    crewRequired: 2,
    preferredTime: 'flexible',
    equipment: ['hedge_trimmer', 'ladder'],
    status: 'scheduled',
    scheduledDate: '2024-12-21'
  },
  {
    id: '3',
    jobTitle: 'Storm Damage Cleanup',
    customerName: 'Mike Chen',
    address: '789 Ponsonby Road, Ponsonby',
    coordinates: { lat: -36.8502, lng: 174.7420 },
    priority: 'urgent',
    estimatedDuration: 6,
    crewRequired: 4,
    preferredTime: 'morning',
    equipment: ['crane', 'chainsaw', 'chipper', 'truck'],
    status: 'in_progress',
    scheduledDate: '2024-12-20'
  },
  {
    id: '4',
    jobTitle: 'Tree Pruning Residential',
    customerName: 'Jennifer Davis',
    address: '321 Parnell Road, Parnell',
    coordinates: { lat: -36.8516, lng: 174.7807 },
    priority: 'low',
    estimatedDuration: 3,
    crewRequired: 2,
    preferredTime: 'afternoon',
    equipment: ['chainsaw', 'ladder'],
    status: 'scheduled',
    scheduledDate: '2024-12-21'
  },
  {
    id: '5',
    jobTitle: 'Emergency Tree Removal',
    customerName: 'North Shore Council',
    address: '555 Taharoto Road, North Shore',
    coordinates: { lat: -36.7888, lng: 174.7473 },
    priority: 'urgent',
    estimatedDuration: 5,
    crewRequired: 3,
    preferredTime: 'morning',
    equipment: ['crane', 'chainsaw'],
    status: 'scheduled',
    scheduledDate: '2024-12-21'
  }
];

const mockRouteOptimizations: RouteOptimization[] = [
  {
    id: '1',
    routeName: 'North Shore Priority Route',
    date: '2024-12-21',
    crew: 'Team Alpha',
    totalDistance: 45.2,
    estimatedTime: 8.5,
    fuelCost: 68,
    jobSequence: [mockJobLocations[4], mockJobLocations[0], mockJobLocations[1]],
    efficiency: 92,
    status: 'active'
  },
  {
    id: '2',
    routeName: 'Central Auckland Circuit',
    date: '2024-12-21',
    crew: 'Team Beta',
    totalDistance: 32.8,
    estimatedTime: 6.2,
    fuelCost: 49,
    jobSequence: [mockJobLocations[2], mockJobLocations[3]],
    efficiency: 88,
    status: 'draft'
  }
];

export function RouteOptimizer({ compact = false }: RouteOptimizerProps) {
  const [optimizing, setOptimizing] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteOptimization | null>(null);
  const [showOptimizeDialog, setShowOptimizeDialog] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low': return 'bg-green-500';
      case 'medium': return 'bg-yellow-500';
      case 'high': return 'bg-orange-500';
      case 'urgent': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500';
      case 'in_progress': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      case 'cancelled': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const calculateOptimalRoute = async () => {
    setOptimizing(true);
    // Simulate route optimization
    await new Promise(resolve => setTimeout(resolve, 3000));
    setOptimizing(false);
  };

  if (compact) {
    const activeRoutes = mockRouteOptimizations.filter(route => route.status === 'active').length;
    const todayJobs = mockJobLocations.filter(job => 
      job.scheduledDate === '2024-12-21' && job.status === 'scheduled'
    ).length;
    const totalDistance = mockRouteOptimizations
      .filter(route => route.status === 'active')
      .reduce((sum, route) => sum + route.totalDistance, 0);
    const avgEfficiency = mockRouteOptimizations
      .filter(route => route.status === 'active')
      .reduce((sum, route) => sum + route.efficiency, 0) / activeRoutes || 0;

    return (
      <Card data-testid="route-optimizer-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5" />
            Route Optimization
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Active Routes</span>
              </div>
              <Badge variant="secondary" data-testid="active-routes">
                {activeRoutes}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                <span className="text-sm">Today's Jobs</span>
              </div>
              <Badge variant="outline" data-testid="todays-jobs">
                {todayJobs}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Total Distance</span>
              </div>
              <span className="font-medium" data-testid="total-distance">
                {totalDistance.toFixed(1)} km
              </span>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">Efficiency</span>
                <span className="text-sm font-medium" data-testid="efficiency-score">
                  {avgEfficiency.toFixed(0)}%
                </span>
              </div>
              <Progress value={avgEfficiency} className="h-2" data-testid="efficiency-progress" />
            </div>

            <Button variant="outline" size="sm" className="w-full" data-testid="view-routes">
              <MapPin className="h-4 w-4 mr-2" />
              View All Routes
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
              <Route className="h-5 w-5" />
              Route Optimization & Job Scheduling
            </CardTitle>
            <div className="flex gap-2">
              <Dialog open={showOptimizeDialog} onOpenChange={setShowOptimizeDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="optimize-routes">
                    <Zap className="h-4 w-4 mr-2" />
                    Optimize Routes
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Route Optimization</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Optimization Date</label>
                      <input 
                        type="date" 
                        className="w-full p-2 border rounded-md" 
                        defaultValue="2024-12-21"
                        data-testid="optimization-date"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium mb-1 block">Crew Assignment</label>
                      <Select>
                        <SelectTrigger data-testid="crew-select">
                          <SelectValue placeholder="Select crew" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="team-alpha">Team Alpha</SelectItem>
                          <SelectItem value="team-beta">Team Beta</SelectItem>
                          <SelectItem value="team-gamma">Team Gamma</SelectItem>
                          <SelectItem value="all-teams">All Teams</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Optimization Priority</label>
                      <Select>
                        <SelectTrigger data-testid="priority-select">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="time">Minimize Travel Time</SelectItem>
                          <SelectItem value="distance">Minimize Distance</SelectItem>
                          <SelectItem value="fuel">Minimize Fuel Costs</SelectItem>
                          <SelectItem value="balanced">Balanced Optimization</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Alert className="border-blue-200 bg-blue-50">
                      <Zap className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        AI will optimize routes considering traffic, job priorities, crew skills, and equipment requirements.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      className="w-full" 
                      onClick={calculateOptimalRoute} 
                      disabled={optimizing}
                      data-testid="start-optimization"
                    >
                      {optimizing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Optimizing...
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Start Optimization
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button variant="outline" size="sm" data-testid="route-settings">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Current Routes */}
            <div className="space-y-4">
              <h3 className="font-semibold">Current Routes</h3>
              <div className="space-y-3">
                {mockRouteOptimizations.map((route) => (
                  <Card
                    key={route.id}
                    className="hover-elevate cursor-pointer"
                    onClick={() => setSelectedRoute(route)}
                    data-testid={`route-card-${route.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium" data-testid={`route-name-${route.id}`}>
                            {route.routeName}
                          </h4>
                          <p className="text-sm text-muted-foreground" data-testid={`route-crew-${route.id}`}>
                            {route.crew} • {format(new Date(route.date), 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Badge className={`${route.status === 'active' ? 'bg-green-500' : route.status === 'draft' ? 'bg-blue-500' : 'bg-gray-500'} text-white text-xs`}>
                            {route.status}
                          </Badge>
                          <Badge variant="outline" className="text-xs" data-testid={`route-efficiency-${route.id}`}>
                            {route.efficiency}% efficient
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span data-testid={`route-distance-${route.id}`}>
                            {route.totalDistance} km
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span data-testid={`route-time-${route.id}`}>
                            {route.estimatedTime}h
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Fuel className="h-3 w-3 text-muted-foreground" />
                          <span data-testid={`route-fuel-${route.id}`}>
                            ${route.fuelCost}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1">Job Sequence:</p>
                        <div className="flex flex-wrap gap-1">
                          {route.jobSequence.map((job, index) => (
                            <Badge
                              key={job.id}
                              variant="outline"
                              className="text-xs"
                              data-testid={`job-sequence-${route.id}-${index}`}
                            >
                              {index + 1}. {job.jobTitle.substring(0, 15)}...
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 flex gap-2">
                        {route.status === 'active' && (
                          <Button size="sm" variant="outline" className="flex-1" data-testid={`pause-route-${route.id}`}>
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        )}
                        {route.status === 'draft' && (
                          <Button size="sm" className="flex-1" data-testid={`activate-route-${route.id}`}>
                            <Play className="h-3 w-3 mr-1" />
                            Activate
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="flex-1" data-testid={`view-route-${route.id}`}>
                          <MapPin className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Job Locations */}
            <div className="space-y-4">
              <h3 className="font-semibold">Unscheduled Jobs</h3>
              <div className="space-y-3">
                {mockJobLocations
                  .filter(job => job.status === 'scheduled' && !mockRouteOptimizations.some(route => 
                    route.jobSequence.some(routeJob => routeJob.id === job.id)
                  ))
                  .map((job) => (
                    <Card key={job.id} className="hover-elevate" data-testid={`unscheduled-job-${job.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-sm" data-testid={`job-title-${job.id}`}>
                              {job.jobTitle}
                            </h4>
                            <p className="text-xs text-muted-foreground" data-testid={`job-customer-${job.id}`}>
                              {job.customerName}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Badge className={`${getPriorityColor(job.priority)} text-white text-xs`}>
                              {job.priority}
                            </Badge>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate" data-testid={`job-address-${job.id}`}>
                              {job.address}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span data-testid={`job-duration-${job.id}`}>
                                {job.estimatedDuration}h
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              <span data-testid={`job-crew-${job.id}`}>
                                {job.crewRequired} crew
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-2">
                          <Button size="sm" variant="outline" className="w-full text-xs" data-testid={`add-to-route-${job.id}`}>
                            <Target className="h-3 w-3 mr-1" />
                            Add to Route
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Route Detail Modal */}
      {selectedRoute && (
        <Dialog open={!!selectedRoute} onOpenChange={() => setSelectedRoute(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle data-testid="route-detail-title">
                {selectedRoute.routeName} - Route Details
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{selectedRoute.totalDistance} km</div>
                  <div className="text-xs text-muted-foreground">Total Distance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{selectedRoute.estimatedTime}h</div>
                  <div className="text-xs text-muted-foreground">Estimated Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">${selectedRoute.fuelCost}</div>
                  <div className="text-xs text-muted-foreground">Fuel Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{selectedRoute.efficiency}%</div>
                  <div className="text-xs text-muted-foreground">Efficiency</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Route Sequence</h4>
                <div className="space-y-2">
                  {selectedRoute.jobSequence.map((job, index) => (
                    <div key={job.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{job.jobTitle}</div>
                        <div className="text-xs text-muted-foreground">{job.address}</div>
                        <div className="flex gap-2 mt-1">
                          <Badge className={`${getPriorityColor(job.priority)} text-white text-xs`}>
                            {job.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {job.estimatedDuration}h
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" data-testid="modify-route">
                  <Settings className="h-4 w-4 mr-2" />
                  Modify Route
                </Button>
                <Button variant="outline" className="flex-1" data-testid="view-map">
                  <MapPin className="h-4 w-4 mr-2" />
                  View on Map
                </Button>
                {selectedRoute.status === 'active' && (
                  <Button className="flex-1" data-testid="complete-route">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark Complete
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}