import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import {
  useDroppable,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  GripVertical
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
  estimatedValue?: number;
  source: string;
  status: 'new_lead' | 'quote_scheduled' | 'proposal_sent' | 'closed' | 'new' | 'contacted' | 'quoted' | 'won' | 'lost';
  scheduledDate?: string;
  notes?: string;
  createdAt: string;
}

// Status mapping between UI stages and API statuses
const StageMap = {
  // UI stage ID -> API status
  toApiStatus: {
    'new_lead': 'new',
    'quote_scheduled': 'contacted', 
    'proposal_sent': 'quoted',
    'closed': 'won'
  } as Record<string, string>,
  
  // API status -> UI stage ID
  toStageId: {
    'new': 'new_lead',
    'contacted': 'quote_scheduled',
    'quoted': 'proposal_sent', 
    'won': 'closed',
    'lost': 'closed'
  } as Record<string, string>
};

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

// Droppable Stage Column Component
function DroppableStageColumn({ 
  stage, 
  children 
}: { 
  stage: any; 
  children: React.ReactNode; 
}) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <CardContent 
      ref={setNodeRef}
      className="space-y-3 min-h-[200px]"
      data-testid={`droppable-stage-${stage.id}`}
    >
      {children}
    </CardContent>
  );
}

// Draggable Opportunity Card Component
function DraggableOpportunityCard({ 
  opportunity, 
  isLoading, 
  onMoveOpportunity 
}: { 
  opportunity: any; 
  isLoading?: boolean;
  onMoveOpportunity: (id: string, status: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: opportunity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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

  return (
    <Card 
      ref={setNodeRef} 
      style={style} 
      className={`bg-white hover-elevate cursor-pointer ${isLoading ? 'opacity-50' : ''}`}
      data-testid={`opportunity-card-${opportunity.id}`}
    >
      <CardContent className="p-2 sm:p-4">
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-semibold text-xs sm:text-sm leading-tight mr-2 min-w-0 truncate" data-testid={`opportunity-name-${opportunity.id}`}>
            {opportunity.name || opportunity.customerName}
          </h4>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="cursor-grab active:cursor-grabbing h-8 w-8"
              {...attributes}
              {...listeners}
              data-testid={`drag-handle-${opportunity.id}`}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`menu-${opportunity.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pipelineStages.map((stage) => {
                  const currentStageId = StageMap.toStageId[opportunity.status] || opportunity.status;
                  if (stage.id === currentStageId) return null;
                  return (
                    <DropdownMenuItem
                      key={stage.id}
                      onClick={() => onMoveOpportunity(opportunity.id, stage.id)}
                      data-testid={`move-to-${stage.id}-${opportunity.id}`}
                    >
                      Move to {stage.title}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <div className="space-y-2 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Opportunity Value:</span>
            <span className="font-medium" data-testid={`opportunity-value-${opportunity.id}`}>
              {formatCurrency(parseFloat(opportunity.estimatedValue || '0'))}
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

        <div className="flex items-center gap-1 mt-2 sm:mt-3">
          {opportunity.phone && (
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`call-${opportunity.id}`}>
              <Phone className="h-4 w-4" />
            </Button>
          )}
          {opportunity.email && (
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`email-${opportunity.id}`}>
              <Mail className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`schedule-${opportunity.id}`}>
            <Calendar className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`view-${opportunity.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}


export default function Pipeline() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const isMobile = useIsMobile();
  const [selectedSource, setSelectedSource] = useState('all');
  const [showNewOpportunityDialog, setShowNewOpportunityDialog] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedMobileStage, setSelectedMobileStage] = useState('new_lead');
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

  // DnD sensors - configure for mobile vs desktop
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: isMobile ? { distance: 50, tolerance: 5, delay: 250 } : { distance: 3 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
      // Map frontend field names to schema field names
      const mappedData = {
        name: data.customerName,
        email: data.email,
        phone: data.phone,
        address: data.address,
        serviceRequested: data.serviceRequested,
        estimatedValue: data.opportunityValue || undefined,
        source: data.source,
        status: StageMap.toApiStatus[data.status] || data.status,
        notes: data.notes
      };
      return await apiRequest('POST', '/api/pipeline-leads', mappedData);
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

  // Update opportunity status mutation with optimistic updates
  const updateOpportunityMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const apiStatus = StageMap.toApiStatus[status] || status;
      return await apiRequest('PUT', `/api/pipeline-leads/${id}`, { status: apiStatus });
    },
    onMutate: async ({ id, status }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['/api/pipeline-leads'] });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(['/api/pipeline-leads']);
      
      // Optimistically update
      queryClient.setQueryData(['/api/pipeline-leads'], (old: any) => {
        if (!old) return old;
        return old.map((opp: any) => 
          opp.id === id 
            ? { ...opp, status: StageMap.toApiStatus[status] || status }
            : opp
        );
      });
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['/api/pipeline-leads'], context.previousData);
      }
      toast({
        title: "Error",
        description: "Failed to update opportunity",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['/api/pipeline-leads'] });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Opportunity moved successfully"
      });
    }
  });
  
  // Handle moving opportunities between stages
  const handleMoveOpportunity = (opportunityId: string, newStatus: string) => {
    updateOpportunityMutation.mutate({ id: opportunityId, status: newStatus });
  };

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the opportunity being dragged
    const opportunity = opportunities.find((opp: any) => opp.id === activeId);
    if (!opportunity) return;

    const currentStageId = StageMap.toStageId[opportunity.status] || opportunity.status;
    
    // Check if overId is a stage (droppable area) or an item
    const isStageId = pipelineStages.some(stage => stage.id === overId);
    
    if (isStageId) {
      // Dropped on a stage column
      if (overId !== currentStageId) {
        handleMoveOpportunity(activeId, overId);
      }
    } else {
      // Dropped on an item - find which stage the target item belongs to
      const targetOpportunity = opportunities.find((opp: any) => opp.id === overId);
      if (targetOpportunity) {
        const targetStageId = StageMap.toStageId[targetOpportunity.status] || targetOpportunity.status;
        if (targetStageId !== currentStageId) {
          handleMoveOpportunity(activeId, targetStageId);
        }
      }
    }
  };

  const opportunities = Array.isArray(pipelineData) ? pipelineData : [];

  // Group opportunities by status (map API status to UI stage)
  const opportunitiesByStatus = opportunities.length > 0 || !isLoading 
    ? pipelineStages.reduce((acc, stage) => {
        acc[stage.id] = opportunities.filter((opp: any) => {
          const uiStageId = StageMap.toStageId[opp.status] || opp.status;
          return uiStageId === stage.id;
        });
        return acc;
      }, {} as Record<string, any[]>)
    : {};

  // Calculate stage totals
  const getStageTotals = (stageId: string) => {
    const stageOpportunities = opportunitiesByStatus[stageId] || [];
    const count = stageOpportunities.length;
    const value = stageOpportunities.reduce((sum, opp) => {
      return sum + (parseFloat(opp.estimatedValue || '0') || 0);
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Opportunities</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Track leads through your sales pipeline</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button variant="outline" size="sm" className="w-full sm:w-auto" data-testid="import-opportunities">
            <Import className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Dialog open={showNewOpportunityDialog} onOpenChange={setShowNewOpportunityDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto" data-testid="add-opportunity">
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
                <AddressAutocomplete
                  value={newOpportunityData.address}
                  onChange={(value) => handleInputChange('address', value)}
                  placeholder="Service Address"
                  mode="full"
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
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="opportunities" className="text-xs sm:text-sm" data-testid="tab-opportunities">Opportunities</TabsTrigger>
          <TabsTrigger value="pipelines" className="text-xs sm:text-sm" data-testid="tab-pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="bulk-actions" className="text-xs sm:text-sm" data-testid="tab-bulk-actions">Bulk Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="opportunities" className="space-y-4">
          {/* Filters and Controls */}
          <Card>
            <CardContent className="p-2 sm:p-4">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <Select value={selectedSource} onValueChange={setSelectedSource}>
                    <SelectTrigger className="w-full sm:w-40" data-testid="filter-source">
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
                  <Badge variant="outline" className="px-3 py-1 self-start sm:self-center" data-testid="opportunity-count">
                    {opportunities.length} opportunities
                  </Badge>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search Opportunities"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
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
          {isMobile ? (
            <div className="space-y-4">
              {/* Compact Pipeline Overview - Fits on screen */}
              <Card className="p-4">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Pipeline Overview</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {pipelineStages.map((stage) => {
                      const stageTotals = getStageTotals(stage.id);
                      return (
                        <div 
                          key={stage.id}
                          className={`${stage.color} rounded-lg p-3 border-2 cursor-pointer transition-all`}
                          onClick={() => setSelectedMobileStage(stage.id)}
                          data-testid={`stage-overview-${stage.id}`}
                        >
                          <div className="text-xs font-medium text-center">
                            {stage.title}
                          </div>
                          <div className="text-center mt-1">
                            <Badge variant="secondary" className="bg-white/20 text-xs">
                              {stageTotals.count}
                            </Badge>
                          </div>
                          <div className="text-xs text-center mt-1 font-medium">
                            {formatCurrency(stageTotals.value)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* Selected Stage Detail - Move through pipeline */}
              <Card className="flex-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {pipelineStages.find(s => s.id === selectedMobileStage)?.title || 'Select Stage'}
                    </CardTitle>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          const currentIndex = pipelineStages.findIndex(s => s.id === selectedMobileStage);
                          if (currentIndex > 0) {
                            setSelectedMobileStage(pipelineStages[currentIndex - 1].id);
                          }
                        }}
                        disabled={pipelineStages.findIndex(s => s.id === selectedMobileStage) === 0}
                        data-testid="prev-stage"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          const currentIndex = pipelineStages.findIndex(s => s.id === selectedMobileStage);
                          if (currentIndex < pipelineStages.length - 1) {
                            setSelectedMobileStage(pipelineStages[currentIndex + 1].id);
                          }
                        }}
                        disabled={pipelineStages.findIndex(s => s.id === selectedMobileStage) === pipelineStages.length - 1}
                        data-testid="next-stage"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {(() => {
                    const selectedStage = pipelineStages.find(s => s.id === selectedMobileStage);
                    const stageOpportunities = opportunitiesByStatus[selectedMobileStage] || [];
                    
                    if (!selectedStage) return null;
                    
                    return (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        <DroppableStageColumn stage={selectedStage}>
                          <SortableContext 
                            items={stageOpportunities.map((opp: any) => opp.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {stageOpportunities.length === 0 ? (
                              <div className="text-center py-8 text-gray-500">
                                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No opportunities in this stage</p>
                                <p className="text-xs mt-1">Drag opportunities here</p>
                              </div>
                            ) : (
                              stageOpportunities.map((opportunity: any) => (
                                <div key={opportunity.id} className="mb-3">
                                  <DraggableOpportunityCard
                                    opportunity={opportunity}
                                    isLoading={updateOpportunityMutation.isPending}
                                    onMoveOpportunity={handleMoveOpportunity}
                                  />
                                </div>
                              ))
                            )}
                          </SortableContext>
                        </DroppableStageColumn>
                      </div>
                    );
                  })() 
                }
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Desktop: Grid layout */
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {pipelineStages.map((stage) => {
                const stageTotals = getStageTotals(stage.id);
                const stageOpportunities = opportunitiesByStatus[stage.id] || [];

                return (
                  <Card 
                    key={stage.id} 
                    className={`${stage.color} border-2`}
                    data-testid={`stage-column-${stage.id}`}
                  >
                    <CardHeader className={`${stage.headerColor} -m-6 mb-4 rounded-t-lg p-6`}>
                      <CardTitle className="text-lg flex items-center justify-between">
                        <span className="truncate mr-2">{stage.title}</span>
                        <Badge variant="secondary" className="bg-white/20 text-sm flex-shrink-0">
                          {stageTotals.count}
                        </Badge>
                      </CardTitle>
                      <div className="text-sm font-medium">
                        {formatCurrency(stageTotals.value)}
                      </div>
                    </CardHeader>
                    <DroppableStageColumn stage={stage}>
                      <SortableContext 
                        items={stageOpportunities.map((opp: any) => opp.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {stageOpportunities.length === 0 ? (
                          <div 
                            className="text-center py-8 text-gray-500 px-2"
                            style={{ minHeight: '100px' }}
                          >
                            <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No opportunities</p>
                            <p className="text-xs mt-1">Drop opportunities here</p>
                          </div>
                        ) : (
                          stageOpportunities.map((opportunity: any) => (
                            <DraggableOpportunityCard
                              key={opportunity.id}
                              opportunity={opportunity}
                              isLoading={updateOpportunityMutation.isPending}
                              onMoveOpportunity={handleMoveOpportunity}
                            />
                          ))
                        )}
                      </SortableContext>
                    </DroppableStageColumn>
                  </Card>
                );
              })}
            </div>
          )}
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
      
      {/* Drag Overlay */}
      <DragOverlay>
        {activeId ? (
          <div className="opacity-50 rotate-3 scale-105">
            {(() => {
              const draggedOpp = opportunities.find((opp: any) => opp.id === activeId);
              return draggedOpp ? (
                <Card className="bg-white border-orange-500 border-2">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-sm">
                      {draggedOpp.name || draggedOpp.customerName}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {draggedOpp.serviceRequested}
                    </p>
                  </CardContent>
                </Card>
              ) : null;
            })()}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}