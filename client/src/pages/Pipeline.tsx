import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Grid3X3,
  List,
  Search,
  Filter,
  Import,
  Plus,
  MoreVertical,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  User,
  MapPin,
  ChevronDown,
  Eye,
  Edit,
  Trash2
} from "lucide-react";

interface Opportunity {
  id: string;
  name: string;
  customerName: string;
  email?: string;
  phone?: string;
  address?: string;
  serviceRequested: string;
  opportunityValue: string;
  source: string;
  status: 'new_lead' | 'quote_scheduled' | 'proposal_sent' | 'closed';
  scheduledDate?: string;
  notes?: string;
  createdAt: string;
}

const pipelineStages = [
  {
    id: 'new_lead',
    title: 'New Lead',
    color: 'bg-blue-50 border-blue-200',
    headerColor: 'bg-blue-100 text-blue-800'
  },
  {
    id: 'quote_scheduled',
    title: 'Quote Scheduled', 
    color: 'bg-yellow-50 border-yellow-200',
    headerColor: 'bg-yellow-100 text-yellow-800'
  },
  {
    id: 'proposal_sent',
    title: 'Proposal Sent',
    color: 'bg-orange-50 border-orange-200', 
    headerColor: 'bg-orange-100 text-orange-800'
  },
  {
    id: 'closed',
    title: 'Closed',
    color: 'bg-green-50 border-green-200',
    headerColor: 'bg-green-100 text-green-800'
  }
];

export default function Pipeline() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [showNewOpportunityDialog, setShowNewOpportunityDialog] = useState(false);
  const [newOpportunityData, setNewOpportunityData] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: '',
    serviceRequested: '',
    opportunityValue: '',
    source: '',
    status: 'new_lead' as const,
    notes: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch pipeline leads
  const { data: pipelineData, isLoading } = useQuery({
    queryKey: ['/api/pipeline-leads'],
    queryFn: async () => {
      const response = await fetch('/api/pipeline-leads');
      if (!response.ok) throw new Error('Failed to fetch pipeline data');
      const result = await response.json();
      return result.data;
    }
  });

  // Create new opportunity mutation
  const createOpportunityMutation = useMutation({
    mutationFn: async (data: typeof newOpportunityData) => {
      return await apiRequest('POST', '/api/pipeline-leads', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-leads'] });
      toast({
        title: "Success",
        description: "New opportunity created successfully"
      });
      setShowNewOpportunityDialog(false);
      setNewOpportunityData({
        customerName: '',
        email: '',
        phone: '',
        address: '',
        serviceRequested: '',
        opportunityValue: '',
        source: '',
        status: 'new_lead',
        notes: ''
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create opportunity",
        variant: "destructive"
      });
    }
  });

  // Update opportunity status mutation
  const updateOpportunityMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await apiRequest('PUT', `/api/pipeline-leads/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-leads'] });
      toast({
        title: "Success",
        description: "Opportunity status updated"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update opportunity",
        variant: "destructive"
      });
    }
  });

  const opportunities = Array.isArray(pipelineData) ? pipelineData : [];

  // Group opportunities by status (only if data is loaded)
  const opportunitiesByStatus = opportunities.length > 0 || !isLoading 
    ? pipelineStages.reduce((acc, stage) => {
        acc[stage.id] = opportunities.filter((opp: any) => opp.status === stage.id);
        return acc;
      }, {} as Record<string, any[]>)
    : {};

  // Calculate stage totals
  const getStageTotals = (stageId: string) => {
    const stageOpportunities = opportunitiesByStatus[stageId] || [];
    const count = stageOpportunities.length;
    const value = stageOpportunities.reduce((sum, opp) => {
      return sum + (parseFloat(opp.opportunityValue || '0') || 0);
    }, 0);
    return { count, value };
  };

  const handleCreateOpportunity = () => {
    createOpportunityMutation.mutate(newOpportunityData);
  };

  const handleInputChange = (field: string, value: string) => {
    setNewOpportunityData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMoveOpportunity = (opportunityId: string, newStatus: string) => {
    updateOpportunityMutation.mutate({ id: opportunityId, status: newStatus });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NZ', {
      style: 'currency',
      currency: 'NZD'
    }).format(amount);
  };

  const getSourceBadgeColor = (source: string) => {
    switch (source.toLowerCase()) {
      case 'facebook': return 'bg-blue-100 text-blue-800';
      case 'google': return 'bg-green-100 text-green-800';
      case 'referral': return 'bg-purple-100 text-purple-800';
      case 'repeat': return 'bg-orange-100 text-orange-800';
      case 'word of mouth': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pipeline...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-600 mt-1">Track leads through your sales pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" data-testid="import-opportunities">
            <Import className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Dialog open={showNewOpportunityDialog} onOpenChange={setShowNewOpportunityDialog}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="add-opportunity">
                <Plus className="h-4 w-4 mr-2" />
                Add opportunity
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Opportunity</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input
                  placeholder="Customer Name"
                  value={newOpportunityData.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  data-testid="input-customer-name"
                />
                <Input
                  placeholder="Email"
                  type="email"
                  value={newOpportunityData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  data-testid="input-email"
                />
                <Input
                  placeholder="Phone"
                  value={newOpportunityData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  data-testid="input-phone"
                />
                <Input
                  placeholder="Service Address"
                  value={newOpportunityData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  data-testid="input-address"
                />
                <Select value={newOpportunityData.serviceRequested} onValueChange={(value) => handleInputChange('serviceRequested', value)}>
                  <SelectTrigger data-testid="select-service">
                    <SelectValue placeholder="Service Requested" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tree Removal">Tree Removal</SelectItem>
                    <SelectItem value="Tree Pruning">Tree Pruning</SelectItem>
                    <SelectItem value="Stump Grinding">Stump Grinding</SelectItem>
                    <SelectItem value="Emergency Tree Service">Emergency Tree Service</SelectItem>
                    <SelectItem value="Hedge Trimming">Hedge Trimming</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Opportunity Value (NZD)"
                  type="number"
                  value={newOpportunityData.opportunityValue}
                  onChange={(e) => handleInputChange('opportunityValue', e.target.value)}
                  data-testid="input-value"
                />
                <Select value={newOpportunityData.source} onValueChange={(value) => handleInputChange('source', value)}>
                  <SelectTrigger data-testid="select-source">
                    <SelectValue placeholder="Lead Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="Google">Google</SelectItem>
                    <SelectItem value="Referral">Referral</SelectItem>
                    <SelectItem value="Repeat">Repeat Customer</SelectItem>
                    <SelectItem value="Word of Mouth">Word of Mouth</SelectItem>
                    <SelectItem value="Website">Website</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Notes (optional)"
                  value={newOpportunityData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  data-testid="input-notes"
                />
                <Button 
                  className="w-full" 
                  onClick={handleCreateOpportunity}
                  disabled={createOpportunityMutation.isPending}
                  data-testid="create-opportunity"
                >
                  {createOpportunityMutation.isPending ? 'Creating...' : 'Create Opportunity'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="opportunities" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="opportunities" data-testid="tab-opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="pipelines" data-testid="tab-pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="bulk-actions" data-testid="tab-bulk-actions">Bulk Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          {/* Filters and Controls */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger className="w-32" data-testid="filter-source">
                      <SelectValue placeholder="All Sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="google">Google</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="repeat">Repeat</SelectItem>
                      <SelectItem value="word of mouth">Word of Mouth</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="px-3 py-1" data-testid="opportunity-count">
                    {opportunities.length} opportunities
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search Opportunities"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="search-opportunities"
                    />
                  </div>
                  <div className="flex border rounded-lg">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      data-testid="view-grid"
                    >
                      <Grid3X3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      data-testid="view-list"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Stages */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pipelineStages.map((stage) => {
              const stageTotals = getStageTotals(stage.id);
              const stageOpportunities = opportunitiesByStatus[stage.id] || [];

              return (
                <Card key={stage.id} className={`${stage.color} border-2`}>
                  <CardHeader className={`${stage.headerColor} -m-6 mb-4 rounded-t-lg`}>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{stage.title}</span>
                      <Badge variant="secondary" className="bg-white/20">
                        {stageTotals.count}
                      </Badge>
                    </CardTitle>
                    <div className="text-sm font-medium">
                      {formatCurrency(stageTotals.value)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {stageOpportunities.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No opportunities</p>
                      </div>
                    ) : (
                      stageOpportunities.map((opportunity: any) => (
                        <Card key={opportunity.id} className="bg-white hover-elevate cursor-pointer">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-sm" data-testid={`opportunity-name-${opportunity.id}`}>
                                {opportunity.name || opportunity.customerName}
                              </h4>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </div>
                            
                            <div className="space-y-2 text-xs text-gray-600">
                              <div className="flex items-center justify-between">
                                <span>Opportunity Value:</span>
                                <span className="font-medium" data-testid={`opportunity-value-${opportunity.id}`}>
                                  {formatCurrency(parseFloat(opportunity.opportunityValue || '0'))}
                                </span>
                              </div>
                              
                              {opportunity.source && (
                                <div className="flex items-center justify-between">
                                  <span>Source:</span>
                                  <Badge className={`${getSourceBadgeColor(opportunity.source)} text-xs`}>
                                    {opportunity.source}
                                  </Badge>
                                </div>
                              )}

                              {opportunity.serviceRequested && (
                                <div className="text-xs text-gray-500 mt-2">
                                  {opportunity.serviceRequested}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-1 mt-3">
                              {opportunity.phone && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`call-${opportunity.id}`}>
                                  <Phone className="h-3 w-3" />
                                </Button>
                              )}
                              {opportunity.email && (
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`email-${opportunity.id}`}>
                                  <Mail className="h-3 w-3" />
                                </Button>
                              )}
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`schedule-${opportunity.id}`}>
                                <Calendar className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" data-testid={`view-${opportunity.id}`}>
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>

                            {/* Stage Movement Buttons */}
                            <div className="flex gap-1 mt-2">
                              {stage.id !== 'closed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  onClick={() => {
                                    const currentIndex = pipelineStages.findIndex(s => s.id === stage.id);
                                    const nextStage = pipelineStages[currentIndex + 1];
                                    if (nextStage) {
                                      handleMoveOpportunity(opportunity.id, nextStage.id);
                                    }
                                  }}
                                  data-testid={`move-forward-${opportunity.id}`}
                                >
                                  Move Forward
                                </Button>
                              )}
                              {stage.id !== 'new_lead' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-6 px-2"
                                  onClick={() => {
                                    const currentIndex = pipelineStages.findIndex(s => s.id === stage.id);
                                    const prevStage = pipelineStages[currentIndex - 1];
                                    if (prevStage) {
                                      handleMoveOpportunity(opportunity.id, prevStage.id);
                                    }
                                  }}
                                  data-testid={`move-back-${opportunity.id}`}
                                >
                                  Move Back
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="pipelines" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Pipeline Management</h3>
              <p className="text-gray-600">Configure and manage your sales pipelines here.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk-actions" className="space-y-4">
          <Card>
            <CardContent className="p-8 text-center">
              <h3 className="text-lg font-semibold mb-2">Bulk Actions</h3>
              <p className="text-gray-600">Perform bulk operations on multiple opportunities.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}