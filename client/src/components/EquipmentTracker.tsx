import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Wrench, 
  Truck, 
  MapPin, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Battery,
  Settings,
  Eye
} from 'lucide-react';
import { useState } from 'react';

interface Equipment {
  id: string;
  name: string;
  type: 'chainsaw' | 'crane' | 'truck' | 'chipper' | 'cherry_picker' | 'safety';
  status: 'available' | 'in_use' | 'maintenance' | 'out_of_service';
  location: string;
  assignedTo?: string;
  lastMaintenance: string;
  nextMaintenance: string;
  hoursUsed: number;
  maxHours: number;
  batteryLevel?: number;
  fuelLevel?: number;
}

interface EquipmentTrackerProps {
  compact?: boolean;
}

const mockEquipmentData: Equipment[] = [
  {
    id: '1',
    name: 'Stihl MS 880',
    type: 'chainsaw',
    status: 'in_use',
    location: 'North Shore Job Site',
    assignedTo: 'Mike Johnson',
    lastMaintenance: '2024-12-10',
    nextMaintenance: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 days from now
    hoursUsed: 45,
    maxHours: 50,
    fuelLevel: 75
  },
  {
    id: '2', 
    name: 'Crane 25T Liebherr',
    type: 'crane',
    status: 'available',
    location: 'Main Depot',
    lastMaintenance: '2024-12-05',
    nextMaintenance: '2024-12-19',
    hoursUsed: 120,
    maxHours: 200,
    fuelLevel: 90
  },
  {
    id: '3',
    name: 'Ford Ranger',
    type: 'truck',
    status: 'in_use',
    location: 'West Auckland',
    assignedTo: 'Sarah Chen',
    lastMaintenance: '2024-11-30',
    nextMaintenance: '2024-12-30',
    hoursUsed: 2800,
    maxHours: 5000,
    fuelLevel: 45
  },
  {
    id: '4',
    name: 'Wood Chipper 12"',
    type: 'chipper',
    status: 'maintenance',
    location: 'Service Center',
    lastMaintenance: '2024-12-15',
    nextMaintenance: '2024-12-22',
    hoursUsed: 85,
    maxHours: 100,
    fuelLevel: 20
  },
  {
    id: '5',
    name: 'Cherry Picker 60ft',
    type: 'cherry_picker',
    status: 'available',
    location: 'Main Depot',
    lastMaintenance: '2024-12-08',
    nextMaintenance: '2024-12-22',
    hoursUsed: 35,
    maxHours: 80,
    batteryLevel: 95
  }
];

export function EquipmentTracker({ compact = false }: EquipmentTrackerProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'in_use': return 'bg-blue-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'out_of_service': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available': return 'Available';
      case 'in_use': return 'In Use';
      case 'maintenance': return 'Maintenance';
      case 'out_of_service': return 'Out of Service';
      default: return 'Unknown';
    }
  };

  const getEquipmentIcon = (type: string) => {
    switch (type) {
      case 'chainsaw': return <Wrench className="h-5 w-5" />;
      case 'crane': return <Settings className="h-5 w-5" />;
      case 'truck': return <Truck className="h-5 w-5" />;
      case 'chipper': return <Settings className="h-5 w-5" />;
      case 'cherry_picker': return <Settings className="h-5 w-5" />;
      default: return <Wrench className="h-5 w-5" />;
    }
  };

  const getMaintenanceUrgency = (nextMaintenance: string) => {
    const daysUntil = Math.floor((new Date(nextMaintenance).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil <= 3) return { level: 'urgent', color: 'text-red-600' };
    if (daysUntil <= 7) return { level: 'soon', color: 'text-yellow-600' };
    return { level: 'good', color: 'text-green-600' };
  };

  if (compact) {
    const availableCount = mockEquipmentData.filter(e => e.status === 'available').length;
    const inUseCount = mockEquipmentData.filter(e => e.status === 'in_use').length;
    const maintenanceCount = mockEquipmentData.filter(e => e.status === 'maintenance').length;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Equipment Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Available</span>
              </div>
              <span className="font-bold text-green-600">{availableCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">In Use</span>
              </div>
              <span className="font-bold text-blue-600">{inUseCount}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm">Maintenance</span>
              </div>
              <span className="font-bold text-yellow-600">{maintenanceCount}</span>
            </div>

            <div className="pt-2">
              <Progress value={(availableCount / mockEquipmentData.length) * 100} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {availableCount} of {mockEquipmentData.length} available
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full">
              View All Equipment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Equipment Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockEquipmentData.map((equipment) => {
            const maintenanceUrgency = getMaintenanceUrgency(equipment.nextMaintenance);
            
            return (
              <Card key={equipment.id} className="hover-elevate">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getEquipmentIcon(equipment.type)}
                      <div>
                        <h4 className="font-semibold">{equipment.name}</h4>
                        <p className="text-sm text-muted-foreground capitalize">{equipment.type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <Badge className={`${getStatusColor(equipment.status)} text-white`}>
                      {getStatusText(equipment.status)}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{equipment.location}</span>
                    </div>

                    {equipment.assignedTo && (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs">
                          {equipment.assignedTo.split(' ')[0][0]}
                        </div>
                        <span>{equipment.assignedTo}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className={maintenanceUrgency.color}>
                        Next maintenance: {new Date(equipment.nextMaintenance).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{equipment.hoursUsed}h / {equipment.maxHours}h used</span>
                    </div>
                  </div>

                  {/* Usage Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Usage</span>
                      <span>{Math.round((equipment.hoursUsed / equipment.maxHours) * 100)}%</span>
                    </div>
                    <Progress 
                      value={(equipment.hoursUsed / equipment.maxHours) * 100} 
                      className="h-2"
                    />
                  </div>

                  {/* Fuel/Battery Level */}
                  {equipment.fuelLevel && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Fuel Level</span>
                        <span>{equipment.fuelLevel}%</span>
                      </div>
                      <Progress 
                        value={equipment.fuelLevel} 
                        className="h-2"
                      />
                    </div>
                  )}

                  {equipment.batteryLevel && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2">
                        <Battery className="h-4 w-4 text-green-500" />
                        <span className="text-sm">{equipment.batteryLevel}% Battery</span>
                      </div>
                    </div>
                  )}

                  {/* Maintenance Alert */}
                  {maintenanceUrgency.level === 'urgent' && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-md">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-xs">Maintenance due soon!</span>
                      </div>
                    </div>
                  )}

                  {maintenanceUrgency.level === 'soon' && (
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div className="flex items-center gap-2 text-yellow-700">
                        <Clock className="h-4 w-4" />
                        <span className="text-xs">Maintenance due within a week</span>
                      </div>
                    </div>
                  )}

                  {equipment.status === 'available' && (
                    <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-md">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">Ready for assignment</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Maintenance
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Track Locations
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Usage Reports
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}