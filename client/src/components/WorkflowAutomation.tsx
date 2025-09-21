import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  Settings,
  Zap,
  Play,
  Pause,
  Plus,
  Edit,
  Trash2,
  Clock,
  Users,
  Mail,
  MessageSquare,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Activity,
  Bot,
  Workflow,
  GitBranch,
  Timer,
  Target
} from 'lucide-react';

interface WorkflowRule {
  id: string;
  name: string;
  trigger: {
    type: string;
    filters?: Record<string, any>;
  };
  conditions: Array<{
    field: string;
    operator: string;
    value: any;
  }>;
  actions: Array<{
    type: string;
    parameters: Record<string, any>;
  }>;
  enabled: boolean;
  priority: number;
}

const triggerTypeIcons = {
  job_created: Target,
  job_status_changed: Activity,
  quote_accepted: DollarSign,
  customer_created: Users,
  invoice_due: DollarSign,
  time_based: Clock
};

const actionTypeIcons = {
  assign_job: Users,
  send_notification: Mail,
  create_invoice: DollarSign,
  schedule_follow_up: Clock,
  update_status: CheckCircle,
  create_task: Plus
};

export function WorkflowAutomation() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowRule | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch workflows
  const { data: workflowsData, isLoading } = useQuery({
    queryKey: ['/api/workflows'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const workflows: WorkflowRule[] = workflowsData?.data || [];

  // Toggle workflow mutation
  const toggleWorkflowMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const response = await apiRequest('PATCH', `/api/workflows/${id}/toggle`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: "Success",
        description: "Workflow updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to update workflow: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  // Test workflow trigger mutation
  const testTriggerMutation = useMutation({
    mutationFn: async (data: { triggerType: string; data: any; context?: any }) => {
      const response = await apiRequest('POST', '/api/workflows/trigger', data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Workflow trigger tested successfully",
      });
      setShowTestDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: `Failed to test workflow: ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleToggleWorkflow = (id: string, enabled: boolean) => {
    toggleWorkflowMutation.mutate({ id, enabled });
  };

  const handleTestTrigger = (triggerType: string, testData: any) => {
    testTriggerMutation.mutate({
      triggerType,
      data: testData,
      context: { test: true }
    });
  };

  const getStatusColor = (enabled: boolean) => {
    return enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: number) => {
    if (priority === 0) return 'bg-red-100 text-red-800';
    if (priority <= 2) return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
  };

  const formatTriggerType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading workflow automation...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Workflow className="h-6 w-6 text-blue-600" />
            Workflow Automation
          </h2>
          <p className="text-gray-600 mt-1">
            Automate your business processes with intelligent workflows
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowTestDialog(true)}
            data-testid="button-test-workflow"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Trigger
          </Button>
          <Button 
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-workflow"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Workflows</p>
                <p className="text-2xl font-bold text-gray-900" data-testid="stat-total-workflows">
                  {workflows.length}
                </p>
              </div>
              <Workflow className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-active-workflows">
                  {workflows.filter(w => w.enabled).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Priority</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-priority-workflows">
                  {workflows.filter(w => w.priority <= 2).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Auto-assignments</p>
                <p className="text-2xl font-bold text-purple-600" data-testid="stat-assignment-workflows">
                  {workflows.filter(w => w.actions.some(a => a.type === 'assign_job')).length}
                </p>
              </div>
              <Bot className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Workflow Rules
          </CardTitle>
          <CardDescription>
            Manage your automated business process workflows
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflows.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Workflows Configured</h3>
              <p className="text-gray-600 mb-4">Create your first workflow to automate business processes.</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Workflow
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {workflows.map((workflow) => {
                const TriggerIcon = triggerTypeIcons[workflow.trigger.type as keyof typeof triggerTypeIcons] || Activity;
                
                return (
                  <Card 
                    key={workflow.id} 
                    className={`transition-all duration-200 hover:shadow-md ${workflow.enabled ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-gray-300'}`}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <TriggerIcon className="h-5 w-5 text-blue-600" />
                            <h3 className="text-lg font-semibold text-gray-900">{workflow.name}</h3>
                            <Badge className={getStatusColor(workflow.enabled)}>
                              {workflow.enabled ? 'Active' : 'Inactive'}
                            </Badge>
                            <Badge className={getPriorityColor(workflow.priority)}>
                              Priority {workflow.priority}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                            <span className="flex items-center gap-1">
                              <Zap className="h-4 w-4" />
                              Trigger: {formatTriggerType(workflow.trigger.type)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Settings className="h-4 w-4" />
                              {workflow.conditions.length} condition(s)
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="h-4 w-4" />
                              {workflow.actions.length} action(s)
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {workflow.actions.map((action, index) => {
                              const ActionIcon = actionTypeIcons[action.type as keyof typeof actionTypeIcons] || Activity;
                              return (
                                <Badge key={index} variant="outline" className="flex items-center gap-1">
                                  <ActionIcon className="h-3 w-3" />
                                  {action.type.replace(/_/g, ' ')}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={workflow.enabled}
                            onCheckedChange={(enabled) => handleToggleWorkflow(workflow.id, enabled)}
                            disabled={toggleWorkflowMutation.isPending}
                            data-testid={`switch-workflow-${workflow.id}`}
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestTrigger(workflow.trigger.type, { test: true })}
                            disabled={testTriggerMutation.isPending}
                            data-testid={`button-test-${workflow.id}`}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Trigger Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Test Workflow Trigger
            </DialogTitle>
            <DialogDescription>
              Test your workflow automation by manually triggering an event
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="trigger-type">Trigger Type</Label>
              <Select>
                <SelectTrigger data-testid="select-trigger-type">
                  <SelectValue placeholder="Select trigger type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="job_created">Job Created</SelectItem>
                  <SelectItem value="job_status_changed">Job Status Changed</SelectItem>
                  <SelectItem value="quote_accepted">Quote Accepted</SelectItem>
                  <SelectItem value="customer_created">Customer Created</SelectItem>
                  <SelectItem value="invoice_due">Invoice Due</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="test-data">Test Data (JSON)</Label>
              <Textarea
                id="test-data"
                placeholder='{"id": "test-123", "status": "completed", "customerId": "customer-1"}'
                className="h-32"
                data-testid="textarea-test-data"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTestDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleTestTrigger('job_created', { test: true })}
                disabled={testTriggerMutation.isPending}
                data-testid="button-execute-test"
              >
                <Play className="h-4 w-4 mr-2" />
                Execute Test
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}