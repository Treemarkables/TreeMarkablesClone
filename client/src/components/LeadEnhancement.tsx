import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  TrendingUp,
  Users,
  Target,
  Calendar,
  Phone,
  Mail,
  MessageSquare,
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  Filter,
  Search,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Award,
  Timer,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  status: string;
  estimatedValue?: number;
  createdAt: string;
  lastContactDate?: string;
  serviceRequested?: string;
  urgency?: string;
  notes?: string;
}

interface LeadScore {
  total: number;
  breakdown: {
    valueScore: number;
    urgencyScore: number;
    sourceScore: number;
    engagementScore: number;
    timeScore: number;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recommendations: string[];
}

interface ConversionMetrics {
  totalLeads: number;
  conversionRate: number;
  averageTimeToClose: number;
  totalValue: number;
  byStage: {
    stage: string;
    count: number;
    value: number;
    conversionRate: number;
  }[];
  bySource: {
    source: string;
    count: number;
    conversionRate: number;
    averageValue: number;
  }[];
}

export function LeadEnhancement() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('30');
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch leads data
  const { data: leadsResponse, isLoading } = useQuery({
    queryKey: ['/api/pipeline-leads'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline-leads');
      if (!response.ok) throw new Error('Failed to fetch leads');
      return response.json();
    }
  });

  const leads = leadsResponse?.data || [];

  // Calculate lead scores
  const calculateLeadScore = (lead: Lead): LeadScore => {
    const scores = {
      valueScore: 0,
      urgencyScore: 0,
      sourceScore: 0,
      engagementScore: 0,
      timeScore: 0
    };

    // Value-based scoring (0-25 points)
    if (lead.estimatedValue) {
      if (lead.estimatedValue >= 5000) scores.valueScore = 25;
      else if (lead.estimatedValue >= 2000) scores.valueScore = 20;
      else if (lead.estimatedValue >= 1000) scores.valueScore = 15;
      else if (lead.estimatedValue >= 500) scores.valueScore = 10;
      else scores.valueScore = 5;
    }

    // Urgency-based scoring (0-20 points)
    switch (lead.urgency) {
      case 'emergency': scores.urgencyScore = 20; break;
      case 'high': scores.urgencyScore = 15; break;
      case 'medium': scores.urgencyScore = 10; break;
      default: scores.urgencyScore = 5;
    }

    // Source quality scoring (0-20 points)
    switch (lead.source?.toLowerCase()) {
      case 'referral': scores.sourceScore = 20; break;
      case 'website': scores.sourceScore = 15; break;
      case 'google': scores.sourceScore = 12; break;
      case 'facebook': scores.sourceScore = 8; break;
      default: scores.sourceScore = 5;
    }

    // Engagement scoring (0-20 points)
    if (lead.phone && lead.email) scores.engagementScore = 20;
    else if (lead.phone || lead.email) scores.engagementScore = 15;
    else scores.engagementScore = 5;

    // Time-based scoring (0-15 points) - newer leads get higher scores
    const daysSinceCreated = Math.floor(
      (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceCreated <= 1) scores.timeScore = 15;
    else if (daysSinceCreated <= 3) scores.timeScore = 12;
    else if (daysSinceCreated <= 7) scores.timeScore = 8;
    else if (daysSinceCreated <= 14) scores.timeScore = 5;
    else scores.timeScore = 2;

    const total = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    let priority: LeadScore['priority'] = 'low';
    if (total >= 80) priority = 'urgent';
    else if (total >= 60) priority = 'high';
    else if (total >= 40) priority = 'medium';

    const recommendations: string[] = [];
    if (scores.valueScore >= 20) recommendations.push('High-value opportunity - prioritize immediately');
    if (scores.urgencyScore >= 15) recommendations.push('Urgent request - respond within 2 hours');
    if (scores.sourceScore >= 15) recommendations.push('Quality lead source - high conversion potential');
    if (scores.timeScore <= 5) recommendations.push('Aging lead - immediate follow-up required');
    if (!lead.phone && !lead.email) recommendations.push('Missing contact information - gather details');

    return {
      total,
      breakdown: scores,
      priority,
      recommendations
    };
  };

  // Calculate conversion metrics
  const conversionMetrics = useMemo((): ConversionMetrics => {
    const totalLeads = leads.length;
    const wonLeads = leads.filter((lead: Lead) => lead.status === 'won').length;
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;
    
    const totalValue = leads
      .filter((lead: Lead) => lead.status === 'won')
      .reduce((sum: number, lead: Lead) => sum + (lead.estimatedValue || 0), 0);

    // Calculate average time to close (mock data for demonstration)
    const averageTimeToClose = 14; // days

    // Group by stage
    const stageGroups = leads.reduce((acc: any, lead: Lead) => {
      const stage = lead.status;
      if (!acc[stage]) {
        acc[stage] = { count: 0, value: 0 };
      }
      acc[stage].count++;
      acc[stage].value += lead.estimatedValue || 0;
      return acc;
    }, {});

    const byStage = Object.entries(stageGroups).map(([stage, data]: [string, any]) => ({
      stage,
      count: data.count,
      value: data.value,
      conversionRate: stage === 'won' ? 100 : (data.count / totalLeads) * 100
    }));

    // Group by source
    const sourceGroups = leads.reduce((acc: any, lead: Lead) => {
      const source = lead.source || 'unknown';
      if (!acc[source]) {
        acc[source] = { count: 0, totalValue: 0, wonCount: 0 };
      }
      acc[source].count++;
      acc[source].totalValue += lead.estimatedValue || 0;
      if (lead.status === 'won') acc[source].wonCount++;
      return acc;
    }, {});

    const bySource = Object.entries(sourceGroups).map(([source, data]: [string, any]) => ({
      source,
      count: data.count,
      conversionRate: data.count > 0 ? (data.wonCount / data.count) * 100 : 0,
      averageValue: data.count > 0 ? data.totalValue / data.count : 0
    }));

    return {
      totalLeads,
      conversionRate,
      averageTimeToClose,
      totalValue,
      byStage,
      bySource
    };
  }, [leads]);

  // Filter leads based on search and priority
  const filteredLeads = useMemo(() => {
    return leads.filter((lead: Lead) => {
      const matchesSearch = !searchTerm || 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.source?.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (priorityFilter === 'all') return true;
      
      const score = calculateLeadScore(lead);
      return score.priority === priorityFilter;
    });
  }, [leads, searchTerm, priorityFilter]);

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return <AlertCircle className="h-3 w-3" />;
      case 'high': return <ArrowUp className="h-3 w-3" />;
      case 'medium': return <Timer className="h-3 w-3" />;
      default: return <ArrowDown className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading lead analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="lead-enhancement-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" data-testid="heading-lead-enhancement">Lead Management & Analytics</h2>
          <p className="text-muted-foreground">Advanced lead scoring, conversion tracking, and pipeline analytics</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="metric-total-leads">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-total-leads">{conversionMetrics.totalLeads}</div>
            <p className="text-xs text-muted-foreground">Active opportunities</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-conversion-rate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="value-conversion-rate">
              {conversionMetrics.conversionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">Leads to customers</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-avg-close-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Close Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-avg-close-time">
              {conversionMetrics.averageTimeToClose} days
            </div>
            <p className="text-xs text-muted-foreground">Time to conversion</p>
          </CardContent>
        </Card>

        <Card data-testid="metric-total-value">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="value-total-value">
              ${conversionMetrics.totalValue.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Won opportunities</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="leads" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="leads" data-testid="tab-leads">Lead Scoring</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          <TabsTrigger value="automation" data-testid="tab-automation">Automation</TabsTrigger>
        </TabsList>

        {/* Lead Scoring Tab */}
        <TabsContent value="leads" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search leads..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                data-testid="input-search-leads"
              />
            </div>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Lead List with Scoring */}
          <div className="space-y-3">
            {filteredLeads.map((lead: Lead) => {
              const score = calculateLeadScore(lead);
              return (
                <Card key={lead.id} className="hover-elevate" data-testid={`lead-card-${lead.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium" data-testid={`lead-name-${lead.id}`}>{lead.name}</h4>
                          <Badge className={`text-xs ${getPriorityColor(score.priority)}`}>
                            {getPriorityIcon(score.priority)}
                            <span className="ml-1">{score.priority.toUpperCase()}</span>
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Star className="h-3 w-3 mr-1" />
                            {score.total}/100
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{lead.source}</span>
                          <span>{lead.serviceRequested || 'Service TBD'}</span>
                          {lead.estimatedValue && (
                            <span className="font-medium text-green-600">
                              ${lead.estimatedValue.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedLead(lead);
                            setScoreDialogOpen(true);
                          }}
                          data-testid={`button-view-score-${lead.id}`}
                        >
                          <BarChart3 className="h-4 w-4 mr-1" />
                          View Score
                        </Button>
                        <div className="flex gap-1">
                          {lead.phone && (
                            <Button size="sm" variant="ghost" data-testid={`button-call-${lead.id}`}>
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                          {lead.email && (
                            <Button size="sm" variant="ghost" data-testid={`button-email-${lead.id}`}>
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                        <span>Lead Score</span>
                        <span>{score.total}/100</span>
                      </div>
                      <Progress value={score.total} className="h-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion by Stage */}
            <Card data-testid="chart-conversion-by-stage">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Conversion by Stage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {conversionMetrics.byStage.map((stage) => (
                    <div key={stage.stage} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <span className="text-sm capitalize">{stage.stage.replace('_', ' ')}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{stage.count} leads</div>
                        <div className="text-xs text-muted-foreground">
                          {stage.conversionRate.toFixed(1)}% conversion
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance by Source */}
            <Card data-testid="chart-performance-by-source">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {conversionMetrics.bySource.map((source) => (
                    <div key={source.source} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium capitalize">{source.source}</span>
                        <span className="text-sm text-muted-foreground">
                          {source.conversionRate.toFixed(1)}% conversion
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{source.count} leads</span>
                        <span>Avg: ${source.averageValue.toLocaleString()}</span>
                      </div>
                      <Progress value={source.conversionRate} className="h-1" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card data-testid="automation-follow-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  Auto Follow-up
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Automatically send follow-up emails to leads based on time and engagement
                </p>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </CardContent>
            </Card>

            <Card data-testid="automation-scoring">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Award className="h-5 w-5 text-blue-600" />
                  Lead Scoring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Automatically calculate and update lead scores based on multiple factors
                </p>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </CardContent>
            </Card>

            <Card data-testid="automation-notifications">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-5 w-5 text-purple-600" />
                  Smart Notifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-3">
                  Get notified about high-priority leads and important milestones
                </p>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Score Detail Dialog */}
      <Dialog open={scoreDialogOpen} onOpenChange={setScoreDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lead Score Breakdown</DialogTitle>
          </DialogHeader>
          {selectedLead && (
            <div className="space-y-4">
              {(() => {
                const score = calculateLeadScore(selectedLead);
                return (
                  <>
                    <div className="text-center">
                      <div className="text-3xl font-bold mb-2">{score.total}/100</div>
                      <Badge className={`${getPriorityColor(score.priority)} text-sm`}>
                        {score.priority.toUpperCase()} PRIORITY
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Value Score</span>
                        <span className="font-medium">{score.breakdown.valueScore}/25</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Urgency Score</span>
                        <span className="font-medium">{score.breakdown.urgencyScore}/20</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Source Quality</span>
                        <span className="font-medium">{score.breakdown.sourceScore}/20</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Engagement</span>
                        <span className="font-medium">{score.breakdown.engagementScore}/20</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Timing</span>
                        <span className="font-medium">{score.breakdown.timeScore}/15</span>
                      </div>
                    </div>

                    {score.recommendations.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-medium text-sm">Recommendations:</h4>
                        <ul className="space-y-1">
                          {score.recommendations.map((rec, index) => (
                            <li key={index} className="text-xs text-muted-foreground flex items-start gap-2">
                              <div className="w-1 h-1 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}