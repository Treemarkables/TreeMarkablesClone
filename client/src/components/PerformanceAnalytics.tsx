import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown,
  Users,
  Clock,
  Target,
  Award,
  Activity,
  BarChart3,
  Calendar,
  DollarSign,
  Zap,
  Star,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface CrewPerformance {
  id: string;
  name: string;
  role: string;
  totalHours: number;
  jobsCompleted: number;
  efficiency: number; // percentage
  safetyScore: number; // percentage
  customerRating: number; // 1-5 stars
  revenue: number;
  skills: string[];
  recentTrends: { date: string; efficiency: number; hours: number }[];
}

interface TeamMetrics {
  teamName: string;
  members: string[];
  avgEfficiency: number;
  totalRevenue: number;
  jobsCompleted: number;
  safetyIncidents: number;
  customerSatisfaction: number;
}

interface PerformanceAnalyticsProps {
  compact?: boolean;
}

const mockCrewPerformance: CrewPerformance[] = [
  {
    id: '1',
    name: 'Mike Johnson',
    role: 'Senior Arborist',
    totalHours: 160,
    jobsCompleted: 28,
    efficiency: 94,
    safetyScore: 98,
    customerRating: 4.8,
    revenue: 14200,
    skills: ['Crane Operation', 'Hazardous Removal', 'Team Leadership'],
    recentTrends: [
      { date: '2024-12-16', efficiency: 92, hours: 8 },
      { date: '2024-12-17', efficiency: 96, hours: 7.5 },
      { date: '2024-12-18', efficiency: 94, hours: 8 },
      { date: '2024-12-19', efficiency: 95, hours: 8.5 }
    ]
  },
  {
    id: '2',
    name: 'Sarah Chen',
    role: 'Arborist',
    totalHours: 152,
    jobsCompleted: 31,
    efficiency: 89,
    safetyScore: 100,
    customerRating: 4.9,
    revenue: 11800,
    skills: ['Tree Climbing', 'Pruning Specialist', 'Safety Protocols'],
    recentTrends: [
      { date: '2024-12-16', efficiency: 87, hours: 8 },
      { date: '2024-12-17', efficiency: 91, hours: 8 },
      { date: '2024-12-18', efficiency: 89, hours: 7.5 },
      { date: '2024-12-19', efficiency: 90, hours: 8 }
    ]
  },
  {
    id: '3',
    name: 'David Wilson',
    role: 'Ground Crew',
    totalHours: 145,
    jobsCompleted: 35,
    efficiency: 87,
    safetyScore: 95,
    customerRating: 4.6,
    revenue: 8700,
    skills: ['Equipment Operation', 'Cleanup Specialist', 'First Aid'],
    recentTrends: [
      { date: '2024-12-16', efficiency: 85, hours: 8 },
      { date: '2024-12-17', efficiency: 89, hours: 8 },
      { date: '2024-12-18', efficiency: 87, hours: 8 },
      { date: '2024-12-19', efficiency: 88, hours: 7.5 }
    ]
  },
  {
    id: '4',
    name: 'Emma Thompson',
    role: 'Equipment Specialist',
    totalHours: 138,
    jobsCompleted: 26,
    efficiency: 92,
    safetyScore: 97,
    customerRating: 4.7,
    revenue: 9400,
    skills: ['Heavy Machinery', 'Maintenance', 'Technical Support'],
    recentTrends: [
      { date: '2024-12-16', efficiency: 90, hours: 8 },
      { date: '2024-12-17', efficiency: 94, hours: 8 },
      { date: '2024-12-18', efficiency: 92, hours: 8 },
      { date: '2024-12-19', efficiency: 93, hours: 7 }
    ]
  }
];

const mockTeamMetrics: TeamMetrics[] = [
  {
    teamName: 'Team Alpha',
    members: ['Mike Johnson', 'Sarah Chen', 'David Wilson'],
    avgEfficiency: 90,
    totalRevenue: 34700,
    jobsCompleted: 94,
    safetyIncidents: 0,
    customerSatisfaction: 4.8
  },
  {
    teamName: 'Team Beta',
    members: ['Emma Thompson', 'John Smith', 'Lisa Brown'],
    avgEfficiency: 88,
    totalRevenue: 28900,
    jobsCompleted: 72,
    safetyIncidents: 1,
    customerSatisfaction: 4.6
  }
];

const monthlyProductivity = [
  { month: 'Jul', jobs: 45, revenue: 42000, efficiency: 85 },
  { month: 'Aug', jobs: 52, revenue: 48000, efficiency: 87 },
  { month: 'Sep', jobs: 48, revenue: 45000, efficiency: 89 },
  { month: 'Oct', jobs: 58, revenue: 54000, efficiency: 91 },
  { month: 'Nov', jobs: 62, revenue: 58000, efficiency: 88 },
  { month: 'Dec', jobs: 55, revenue: 52000, efficiency: 92 }
];

const skillDistribution = [
  { name: 'Tree Climbing', value: 35, color: '#8884d8' },
  { name: 'Crane Operation', value: 25, color: '#82ca9d' },
  { name: 'Pruning', value: 20, color: '#ffc658' },
  { name: 'Equipment Maintenance', value: 20, color: '#ff7300' }
];

export function PerformanceAnalytics({ compact = false }: PerformanceAnalyticsProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedTeam, setSelectedTeam] = useState('all');

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 95) return 'text-green-600';
    if (efficiency >= 90) return 'text-blue-600';
    if (efficiency >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  if (compact) {
    const totalRevenue = mockCrewPerformance.reduce((sum, crew) => sum + crew.revenue, 0);
    const avgEfficiency = mockCrewPerformance.reduce((sum, crew) => sum + crew.efficiency, 0) / mockCrewPerformance.length;
    const totalJobs = mockCrewPerformance.reduce((sum, crew) => sum + crew.jobsCompleted, 0);
    const topPerformer = mockCrewPerformance.reduce((prev, current) => 
      (current.efficiency > prev.efficiency) ? current : prev
    );

    return (
      <Card data-testid="performance-summary-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                <span className="text-sm">Total Revenue</span>
              </div>
              <span className="font-bold" data-testid="total-revenue">
                {formatCurrency(totalRevenue)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-sm">Avg Efficiency</span>
              </div>
              <span className={`font-bold ${getEfficiencyColor(avgEfficiency)}`} data-testid="avg-efficiency">
                {avgEfficiency.toFixed(0)}%
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-sm">Jobs Completed</span>
              </div>
              <Badge variant="secondary" data-testid="jobs-completed">
                {totalJobs}
              </Badge>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-4 w-4 text-yellow-500" />
                <span className="text-sm">Top Performer</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                <span className="text-sm font-medium" data-testid="top-performer">
                  {topPerformer.name}
                </span>
                <Badge className="bg-yellow-500 text-white" data-testid="top-efficiency">
                  {topPerformer.efficiency}%
                </Badge>
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full" data-testid="view-full-analytics">
              <Activity className="h-4 w-4 mr-2" />
              View Detailed Analytics
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
              <BarChart3 className="h-5 w-5" />
              Performance Analytics & Crew Productivity
            </CardTitle>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-32" data-testid="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                <SelectTrigger className="w-32" data-testid="team-select">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  <SelectItem value="alpha">Team Alpha</SelectItem>
                  <SelectItem value="beta">Team Beta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Productivity Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Productivity Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyProductivity}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="jobs" fill="hsl(var(--primary))" fillOpacity={0.6} />
                    <Line yAxisId="right" type="monotone" dataKey="efficiency" stroke="hsl(var(--destructive))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Skill Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Skill Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={skillDistribution}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {skillDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Individual Performance Cards */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Individual Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockCrewPerformance.map((crew) => (
                <Card key={crew.id} className="hover-elevate" data-testid={`crew-performance-${crew.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold" data-testid={`crew-name-${crew.id}`}>{crew.name}</h4>
                        <p className="text-sm text-muted-foreground" data-testid={`crew-role-${crew.id}`}>{crew.role}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium" data-testid={`crew-rating-${crew.id}`}>
                          {crew.customerRating}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">Efficiency</span>
                          <span className={`text-sm font-medium ${getEfficiencyColor(crew.efficiency)}`}>
                            {crew.efficiency}%
                          </span>
                        </div>
                        <Progress value={crew.efficiency} className="h-2" data-testid={`crew-efficiency-${crew.id}`} />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm">Safety Score</span>
                          <span className="text-sm font-medium text-green-600">
                            {crew.safetyScore}%
                          </span>
                        </div>
                        <Progress value={crew.safetyScore} className="h-2" data-testid={`crew-safety-${crew.id}`} />
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span data-testid={`crew-hours-${crew.id}`}>{crew.totalHours}h</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-muted-foreground" />
                            <span data-testid={`crew-jobs-${crew.id}`}>{crew.jobsCompleted} jobs</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span data-testid={`crew-revenue-${crew.id}`}>{formatCurrency(crew.revenue)}</span>
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-muted-foreground" />
                            <span data-testid={`crew-trend-${crew.id}`}>
                              {crew.recentTrends[crew.recentTrends.length - 1].efficiency > crew.recentTrends[0].efficiency ? (
                                <TrendingUp className="h-3 w-3 inline text-green-500" />
                              ) : (
                                <TrendingDown className="h-3 w-3 inline text-red-500" />
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Key Skills:</p>
                        <div className="flex flex-wrap gap-1">
                          {crew.skills.slice(0, 2).map((skill, index) => (
                            <Badge key={index} variant="outline" className="text-xs" data-testid={`crew-skill-${crew.id}-${index}`}>
                              {skill}
                            </Badge>
                          ))}
                          {crew.skills.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{crew.skills.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Team Performance Summary */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Team Performance Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mockTeamMetrics.map((team, index) => (
                <Card key={index} data-testid={`team-metrics-${index}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold" data-testid={`team-name-${index}`}>{team.teamName}</h4>
                      <Badge variant="outline" data-testid={`team-members-${index}`}>
                        {team.members.length} members
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="text-center">
                        <div className="text-lg font-bold text-blue-600" data-testid={`team-efficiency-${index}`}>
                          {team.avgEfficiency}%
                        </div>
                        <div className="text-xs text-muted-foreground">Avg Efficiency</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-green-600" data-testid={`team-revenue-${index}`}>
                          {formatCurrency(team.totalRevenue)}
                        </div>
                        <div className="text-xs text-muted-foreground">Total Revenue</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-bold text-purple-600" data-testid={`team-jobs-${index}`}>
                          {team.jobsCompleted}
                        </div>
                        <div className="text-xs text-muted-foreground">Jobs Completed</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-bold ${team.safetyIncidents === 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {team.safetyIncidents}
                        </div>
                        <div className="text-xs text-muted-foreground">Safety Incidents</div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm">Customer Satisfaction</span>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span className="text-sm font-medium" data-testid={`team-satisfaction-${index}`}>
                            {team.customerSatisfaction}
                          </span>
                        </div>
                      </div>
                      <Progress value={team.customerSatisfaction * 20} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}