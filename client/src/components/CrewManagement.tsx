import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { 
  Users, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Clock,
  Star,
  CheckCircle,
  AlertCircle,
  Calendar,
  Wrench,
  Shield,
  Award
} from 'lucide-react';
import { useState } from 'react';

interface CrewMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  skills: string[];
  certifications: string[];
  availability: 'available' | 'busy' | 'off-duty';
  currentLocation?: string;
  rating: number;
  totalJobs: number;
  hoursWorked: number;
  specialties: string[];
}

interface CrewManagementProps {
  showDetailed?: boolean;
}

const mockCrewData: CrewMember[] = [
  {
    id: '1',
    name: 'Mike Johnson',
    email: 'mike@treemarkables.co.nz',
    phone: '021 555 0123',
    position: 'Senior Arborist',
    skills: ['Tree Climbing', 'Chainsaw Operation', 'Risk Assessment', 'First Aid'],
    certifications: ['NZQA Level 4 Arboriculture', 'First Aid Certificate', 'Chainsaw Operation'],
    availability: 'available',
    currentLocation: 'Auckland CBD',
    rating: 4.8,
    totalJobs: 234,
    hoursWorked: 1850,
    specialties: ['Large Tree Removal', 'Hazardous Tree Assessment']
  },
  {
    id: '2', 
    name: 'Sarah Chen',
    email: 'sarah@treemarkables.co.nz',
    phone: '021 555 0456',
    position: 'Arborist',
    skills: ['Tree Pruning', 'Hedge Trimming', 'Plant Health', 'Customer Service'],
    certifications: ['NZQA Level 3 Arboriculture', 'First Aid Certificate'],
    availability: 'busy',
    currentLocation: 'North Shore',
    rating: 4.9,
    totalJobs: 189,
    hoursWorked: 1420,
    specialties: ['Ornamental Tree Care', 'Garden Maintenance']
  },
  {
    id: '3',
    name: 'David Wilson',
    email: 'david@treemarkables.co.nz', 
    phone: '021 555 0789',
    position: 'Equipment Operator',
    skills: ['Crane Operation', 'Cherry Picker', 'Heavy Machinery', 'Safety Management'],
    certifications: ['Crane Operator License', 'Height Safety', 'First Aid Certificate'],
    availability: 'available',
    currentLocation: 'West Auckland',
    rating: 4.7,
    totalJobs: 156,
    hoursWorked: 1240,
    specialties: ['Crane-Assisted Removal', 'Technical Rigging']
  },
  {
    id: '4',
    name: 'Emma Thompson',
    email: 'emma@treemarkables.co.nz',
    phone: '021 555 0321',
    position: 'Junior Arborist',
    skills: ['Basic Tree Care', 'Ground Support', 'Customer Relations'],
    certifications: ['NZQA Level 2 Arboriculture', 'First Aid Certificate'],
    availability: 'available',
    currentLocation: 'South Auckland',
    rating: 4.5,
    totalJobs: 87,
    hoursWorked: 680,
    specialties: ['Residential Tree Care', 'Storm Cleanup']
  }
];

export function CrewManagement({ showDetailed = false }: CrewManagementProps) {
  const [selectedMember, setSelectedMember] = useState<CrewMember | null>(null);

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-orange-500';  
      case 'off-duty': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getAvailabilityText = (availability: string) => {
    switch (availability) {
      case 'available': return 'Available';
      case 'busy': return 'On Job';
      case 'off-duty': return 'Off Duty';
      default: return 'Unknown';
    }
  };

  if (!showDetailed) {
    // Compact crew overview
    const availableCount = mockCrewData.filter(m => m.availability === 'available').length;
    const busyCount = mockCrewData.filter(m => m.availability === 'busy').length;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Crew Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm">Available</span>
              </div>
              <span className="font-bold text-green-600">{availableCount}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm">On Jobs</span>
              </div>
              <span className="font-bold text-orange-600">{busyCount}</span>
            </div>

            <div className="pt-2">
              <Progress value={(availableCount / mockCrewData.length) * 100} className="h-2" />
              <div className="text-xs text-muted-foreground mt-1">
                {availableCount} of {mockCrewData.length} available
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full">
              View All Crew
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
          <Users className="h-5 w-5" />
          Crew Management
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockCrewData.map((member) => (
            <Card key={member.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedMember(member)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-semibold">{member.name}</h4>
                      <p className="text-sm text-muted-foreground">{member.position}</p>
                    </div>
                  </div>
                  <Badge className={`${getAvailabilityColor(member.availability)} text-white`}>
                    {getAvailabilityText(member.availability)}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{member.phone}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{member.currentLocation}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    <span>{member.rating}/5.0 ({member.totalJobs} jobs)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{member.hoursWorked} hours worked</span>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Specialties:</div>
                  <div className="flex flex-wrap gap-1">
                    {member.specialties.slice(0, 2).map((specialty, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                    {member.specialties.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{member.specialties.length - 2}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-muted-foreground mb-1">Skills:</div>
                  <div className="flex flex-wrap gap-1">
                    {member.skills.slice(0, 3).map((skill, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {skill}
                      </Badge>
                    ))}
                    {member.skills.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{member.skills.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                      <Award className="h-3 w-3" />
                      <span>{member.certifications.length} certs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {member.certifications.includes('First Aid Certificate') && (
                        <Shield className="h-3 w-3 text-green-500" />
                      )}
                      {member.skills.includes('Risk Assessment') && (
                        <CheckCircle className="h-3 w-3 text-blue-500" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex gap-2">
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Schedule Crew
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Track Locations
          </Button>
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Equipment Assignments
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}