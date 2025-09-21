import { Job, Employee, Customer, Quote } from '@shared/schema';

interface WorkflowRule {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
  enabled: boolean;
  priority: number;
}

interface WorkflowTrigger {
  type: 'job_created' | 'job_status_changed' | 'quote_accepted' | 'customer_created' | 'invoice_due' | 'time_based';
  filters?: Record<string, any>;
}

interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in' | 'not_in';
  value: any;
}

interface WorkflowAction {
  type: 'assign_job' | 'send_notification' | 'create_invoice' | 'schedule_follow_up' | 'update_status' | 'create_task';
  parameters: Record<string, any>;
}

interface AutoAssignmentCriteria {
  skillsRequired: string[];
  locationPreference: boolean;
  workloadBalancing: boolean;
  priorityLevel: 'low' | 'medium' | 'high' | 'urgent';
}

class WorkflowAutomationService {
  private workflows: WorkflowRule[] = [];

  constructor() {
    this.initializeDefaultWorkflows();
  }

  // Initialize common workflow automation rules
  private initializeDefaultWorkflows(): void {
    this.workflows = [
      // Auto-assign jobs based on crew availability and skills
      {
        id: 'auto-assign-standard-jobs',
        name: 'Auto-assign Standard Tree Removal Jobs',
        trigger: { type: 'job_created' },
        conditions: [
          { field: 'serviceType', operator: 'in', value: ['tree_removal', 'tree_pruning', 'stump_grinding'] },
          { field: 'priority', operator: 'not_equals', value: 'urgent' }
        ],
        actions: [
          { 
            type: 'assign_job', 
            parameters: { 
              criteria: {
                skillsRequired: ['chainsaw_certified', 'climbing_certified'],
                locationPreference: true,
                workloadBalancing: true,
                priorityLevel: 'medium'
              }
            }
          }
        ],
        enabled: true,
        priority: 1
      },

      // Auto-generate invoices when jobs are completed
      {
        id: 'auto-invoice-completed-jobs',
        name: 'Generate Invoice for Completed Jobs',
        trigger: { type: 'job_status_changed', filters: { newStatus: 'completed' } },
        conditions: [
          { field: 'totalCost', operator: 'greater_than', value: 0 },
          { field: 'invoiceGenerated', operator: 'equals', value: false }
        ],
        actions: [
          { 
            type: 'create_invoice', 
            parameters: { 
              dueDate: 30, // 30 days from completion
              includePhotos: true,
              emailToCustomer: true
            }
          }
        ],
        enabled: true,
        priority: 2
      },

      // Schedule follow-up for customer satisfaction
      {
        id: 'auto-schedule-followup',
        name: 'Schedule Customer Follow-up',
        trigger: { type: 'job_status_changed', filters: { newStatus: 'completed' } },
        conditions: [
          { field: 'customerType', operator: 'equals', value: 'residential' }
        ],
        actions: [
          { 
            type: 'schedule_follow_up', 
            parameters: { 
              delay: 7, // 7 days after completion
              followUpType: 'satisfaction_survey',
              channel: 'email'
            }
          },
          { 
            type: 'schedule_follow_up', 
            parameters: { 
              delay: 30, // 30 days for maintenance reminder
              followUpType: 'maintenance_reminder',
              channel: 'sms'
            }
          }
        ],
        enabled: true,
        priority: 3
      },

      // Emergency job handling
      {
        id: 'emergency-job-handling',
        name: 'Emergency Job Auto-handling',
        trigger: { type: 'job_created' },
        conditions: [
          { field: 'priority', operator: 'equals', value: 'emergency' }
        ],
        actions: [
          { 
            type: 'send_notification', 
            parameters: { 
              recipients: ['all_supervisors', 'on_call_crew'],
              channel: 'sms',
              message: 'EMERGENCY: New urgent job requires immediate attention'
            }
          },
          { 
            type: 'assign_job', 
            parameters: { 
              criteria: {
                priorityLevel: 'urgent',
                onCallOnly: true,
                immediateResponse: true
              }
            }
          }
        ],
        enabled: true,
        priority: 0 // Highest priority
      },

      // Quote follow-up automation
      {
        id: 'quote-followup-sequence',
        name: 'Quote Follow-up Sequence',
        trigger: { type: 'time_based' },
        conditions: [
          { field: 'status', operator: 'equals', value: 'sent' },
          { field: 'daysSinceSent', operator: 'greater_than', value: 3 }
        ],
        actions: [
          { 
            type: 'send_notification', 
            parameters: { 
              channel: 'email',
              template: 'quote_follow_up',
              includeQuoteLink: true
            }
          }
        ],
        enabled: true,
        priority: 4
      }
    ];
  }

  // Execute workflow automation based on triggers
  async processWorkflowTrigger(
    triggerType: WorkflowTrigger['type'], 
    data: any, 
    additionalContext?: Record<string, any>
  ): Promise<void> {
    try {
      const applicableWorkflows = this.workflows
        .filter(workflow => 
          workflow.enabled && 
          workflow.trigger.type === triggerType &&
          this.matchesTriggerFilters(workflow.trigger, data)
        )
        .sort((a, b) => a.priority - b.priority); // Higher priority (lower number) first

      for (const workflow of applicableWorkflows) {
        if (await this.evaluateConditions(workflow.conditions, data, additionalContext)) {
          await this.executeActions(workflow.actions, data, additionalContext);
          console.log(`✅ Executed workflow: ${workflow.name}`);
        }
      }
    } catch (error) {
      console.error('Error processing workflow trigger:', error);
    }
  }

  // Check if trigger filters match
  private matchesTriggerFilters(trigger: WorkflowTrigger, data: any): boolean {
    if (!trigger.filters) return true;
    
    return Object.entries(trigger.filters).every(([key, value]) => {
      return data[key] === value;
    });
  }

  // Evaluate workflow conditions
  private async evaluateConditions(
    conditions: WorkflowCondition[], 
    data: any, 
    context?: Record<string, any>
  ): Promise<boolean> {
    for (const condition of conditions) {
      const fieldValue = this.getFieldValue(condition.field, data, context);
      
      if (!this.evaluateCondition(condition, fieldValue)) {
        return false;
      }
    }
    return true;
  }

  // Get field value from data or context
  private getFieldValue(field: string, data: any, context?: Record<string, any>): any {
    // Support dot notation for nested fields
    const fieldParts = field.split('.');
    let value = data;
    
    for (const part of fieldParts) {
      value = value?.[part];
    }
    
    // If not found in data, check context
    if (value === undefined && context) {
      value = context[field];
    }
    
    return value;
  }

  // Evaluate individual condition
  private evaluateCondition(condition: WorkflowCondition, fieldValue: any): boolean {
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'greater_than':
        return fieldValue > condition.value;
      case 'less_than':
        return fieldValue < condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      default:
        return false;
    }
  }

  // Execute workflow actions
  private async executeActions(
    actions: WorkflowAction[], 
    data: any, 
    context?: Record<string, any>
  ): Promise<void> {
    for (const action of actions) {
      try {
        await this.executeAction(action, data, context);
      } catch (error) {
        console.error(`Error executing action ${action.type}:`, error);
      }
    }
  }

  // Execute individual action
  private async executeAction(
    action: WorkflowAction, 
    data: any, 
    context?: Record<string, any>
  ): Promise<void> {
    switch (action.type) {
      case 'assign_job':
        await this.executeJobAssignment(data, action.parameters);
        break;
      case 'send_notification':
        await this.executeSendNotification(data, action.parameters);
        break;
      case 'create_invoice':
        await this.executeCreateInvoice(data, action.parameters);
        break;
      case 'schedule_follow_up':
        await this.executeScheduleFollowUp(data, action.parameters);
        break;
      case 'update_status':
        await this.executeUpdateStatus(data, action.parameters);
        break;
      case 'create_task':
        await this.executeCreateTask(data, action.parameters);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }
  }

  // Intelligent job assignment based on criteria
  private async executeJobAssignment(job: any, parameters: any): Promise<void> {
    const criteria: AutoAssignmentCriteria = parameters.criteria;
    
    // Mock intelligent assignment logic
    console.log(`🤖 Auto-assigning job ${job.id} with criteria:`, criteria);
    
    // This would integrate with your staff/crew management system
    // For now, implementing the logic structure
    const availableStaff = await this.getAvailableStaff(job.scheduledDate || new Date());
    const suitableStaff = this.filterStaffByCriteria(availableStaff, criteria, job);
    
    if (suitableStaff.length > 0) {
      const assignedStaff = criteria.workloadBalancing 
        ? this.selectStaffByWorkload(suitableStaff)
        : suitableStaff[0];
        
      console.log(`✅ Auto-assigned job to staff member: ${assignedStaff.id}`);
      // TODO: Update job with assigned staff member
    } else {
      console.warn(`⚠️ No suitable staff found for job ${job.id}`);
      // TODO: Notify supervisors about assignment issue
    }
  }

  // Send automated notifications
  private async executeSendNotification(data: any, parameters: any): Promise<void> {
    console.log(`📧 Sending automated notification:`, parameters);
    // TODO: Integrate with existing notification service
  }

  // Create automated invoice
  private async executeCreateInvoice(job: any, parameters: any): Promise<void> {
    console.log(`💰 Auto-generating invoice for job ${job.id}`);
    
    const invoice = {
      jobId: job.id,
      customerId: job.customerId,
      amount: job.totalCost,
      dueDate: new Date(Date.now() + (parameters.dueDate * 24 * 60 * 60 * 1000)),
      items: job.services || [],
      includePhotos: parameters.includePhotos,
      autoGenerated: true
    };
    
    console.log(`✅ Invoice created:`, invoice);
    // TODO: Save invoice and optionally email to customer
  }

  // Schedule automated follow-up
  private async executeScheduleFollowUp(data: any, parameters: any): Promise<void> {
    const followUpDate = new Date(Date.now() + (parameters.delay * 24 * 60 * 60 * 1000));
    
    console.log(`📅 Scheduling follow-up for ${followUpDate.toISOString()}:`, parameters);
    // TODO: Add to follow-up queue/calendar
  }

  // Update status automation
  private async executeUpdateStatus(data: any, parameters: any): Promise<void> {
    console.log(`🔄 Auto-updating status:`, parameters);
    // TODO: Update record status
  }

  // Create automated task
  private async executeCreateTask(data: any, parameters: any): Promise<void> {
    console.log(`📋 Creating automated task:`, parameters);
    // TODO: Create task in task management system
  }

  // Helper methods for staff assignment
  private async getAvailableStaff(date: Date): Promise<any[]> {
    // TODO: Query actual staff availability
    return [
      { id: 'staff1', name: 'John Doe', skills: ['chainsaw_certified', 'climbing_certified'], location: 'Auckland' },
      { id: 'staff2', name: 'Jane Smith', skills: ['chainsaw_certified', 'chipper_operator'], location: 'Wellington' }
    ];
  }

  private filterStaffByCriteria(staff: any[], criteria: AutoAssignmentCriteria, job: any): any[] {
    return staff.filter(member => {
      // Check required skills
      if (criteria.skillsRequired.length > 0) {
        const hasRequiredSkills = criteria.skillsRequired.some(skill => 
          member.skills.includes(skill)
        );
        if (!hasRequiredSkills) return false;
      }
      
      // Check location preference
      if (criteria.locationPreference && job.location && member.location) {
        // Simple location matching - could be enhanced with distance calculation
        const sameLocation = member.location === job.location;
        if (!sameLocation) return false;
      }
      
      return true;
    });
  }

  private selectStaffByWorkload(staff: any[]): any {
    // TODO: Implement workload-based selection
    // For now, return first available
    return staff[0];
  }

  // Add new workflow rule
  addWorkflowRule(workflow: WorkflowRule): void {
    this.workflows.push(workflow);
    console.log(`✅ Added workflow rule: ${workflow.name}`);
  }

  // Enable/disable workflow
  toggleWorkflow(workflowId: string, enabled: boolean): boolean {
    const workflow = this.workflows.find(w => w.id === workflowId);
    if (workflow) {
      workflow.enabled = enabled;
      console.log(`🔄 Workflow ${workflowId} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    return false;
  }

  // Get all workflows
  getWorkflows(): WorkflowRule[] {
    return this.workflows;
  }

  // Get workflow by ID
  getWorkflow(id: string): WorkflowRule | undefined {
    return this.workflows.find(w => w.id === id);
  }
}

export const workflowAutomationService = new WorkflowAutomationService();
export { WorkflowRule, WorkflowTrigger, WorkflowCondition, WorkflowAction, AutoAssignmentCriteria };