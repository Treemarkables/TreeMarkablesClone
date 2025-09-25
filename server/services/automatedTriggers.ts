import { notificationService } from './notificationService';
import { storage } from '../storage';
import { workflowAutomationService } from './workflowAutomation';
import type { Job, Customer, InsertJob } from '@shared/schema';

// Hook into job status changes to trigger automated notifications
export class AutomatedTriggers {
  
  // Called when a job status changes
  static async onJobStatusChange(jobId: string, oldStatus: string, newStatus: string): Promise<void> {
    try {
      const job = await storage.getJob(jobId);
      if (!job) {
        console.error(`Job ${jobId} not found for status change notification`);
        return;
      }

      console.log(`🔄 Job status changed: ${job.title} (${oldStatus} → ${newStatus})`);

      // Trigger notification for job status change
      await notificationService.processNotificationTrigger({
        event: 'job_status_change',
        data: {
          job,
          oldStatus,
          newStatus
        }
      });

      // Trigger workflow automation for job status changes
      await workflowAutomationService.processWorkflowTrigger('job_status_changed', {
        jobId,
        oldStatus,
        newStatus,
        job
      });

      // Additional specific triggers for important status changes
      if (newStatus === 'scheduled' && oldStatus !== 'scheduled') {
        await this.onJobScheduled(job);
      }

      if (newStatus === 'completed' && oldStatus !== 'completed') {
        await this.onJobCompleted(job);
      }
    } catch (error) {
      console.error('Error in job status change trigger:', error);
    }
  }

  // Called when a job is newly scheduled
  static async onJobScheduled(job: Job): Promise<void> {
    try {
      if (!job.scheduledDate) {
        console.warn(`Job ${job.id} marked as scheduled but no scheduledDate provided`);
        return;
      }

      await notificationService.processNotificationTrigger({
        event: 'job_scheduled',
        data: {
          job,
          scheduledDate: job.scheduledDate
        }
      });
    } catch (error) {
      console.error('Error in job scheduled trigger:', error);
    }
  }

  // Called when a job is completed
  static async onJobCompleted(job: Job): Promise<void> {
    try {
      await notificationService.processNotificationTrigger({
        event: 'job_completed',
        data: { job }
      });
    } catch (error) {
      console.error('Error in job completed trigger:', error);
    }
  }

  // Called when a quote is sent to a customer
  static async onQuoteSent(quoteId: string): Promise<void> {
    try {
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        console.error(`Quote ${quoteId} not found`);
        return;
      }

      const customer = await storage.getCustomer(quote.customerId);
      if (!customer) {
        console.error(`Customer ${quote.customerId} not found for quote ${quoteId}`);
        return;
      }

      await notificationService.processNotificationTrigger({
        event: 'quote_sent',
        data: { quote, customer }
      });
    } catch (error) {
      console.error('Error in quote sent trigger:', error);
    }
  }

  // Called when a customer accepts a quote
  static async onQuoteAccepted(quoteId: string): Promise<void> {
    try {
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        console.error(`Quote ${quoteId} not found`);
        return;
      }

      const customer = await storage.getCustomer(quote.customerId);
      if (!customer) {
        console.error(`Customer ${quote.customerId} not found for quote ${quoteId}`);
        return;
      }

      await notificationService.processNotificationTrigger({
        event: 'quote_accepted',
        data: { quote, customer }
      });

      // Trigger workflow automation for quote acceptance
      await workflowAutomationService.processWorkflowTrigger('quote_accepted', {
        quoteId,
        quote,
        customer
      });
    } catch (error) {
      console.error('Error in quote accepted trigger:', error);
    }
  }

  // Called when a new service request is created
  static async onServiceRequestCreated(serviceRequestId: string): Promise<void> {
    try {
      const serviceRequest = await storage.getServiceRequest(serviceRequestId);
      if (!serviceRequest) {
        console.error(`Service request ${serviceRequestId} not found`);
        return;
      }

      const customer = await storage.getCustomer(serviceRequest.customerId);
      if (!customer) {
        console.error(`Customer ${serviceRequest.customerId} not found for service request ${serviceRequestId}`);
        return;
      }

      await notificationService.processNotificationTrigger({
        event: 'service_request_created',
        data: { serviceRequest, customer }
      });
    } catch (error) {
      console.error('Error in service request created trigger:', error);
    }
  }

  // Called when any new job is created
  static async onJobCreated(job: Job): Promise<void> {
    try {
      console.log(`📝 New job created: ${job.title || job.description || job.jobNumber}`);
      
      // Trigger workflow automation for new job creation
      await workflowAutomationService.processWorkflowTrigger('job_created', {
        jobId: job.id,
        job
      });
      
      // If the job is created with a scheduled status, trigger scheduling notifications
      if (job.status === 'scheduled' && job.scheduledDate) {
        await this.onJobScheduled(job);
      }
    } catch (error) {
      console.error('Error in job created trigger:', error);
    }
  }

  // Scheduled reminders and follow-ups
  static async scheduleFollowUpReminders(): Promise<void> {
    try {
      console.log('🔔 Checking for scheduled follow-up reminders...');
      
      // Find jobs completed more than 24 hours ago without follow-up
      const completedJobs = await storage.getJobsByStatus('completed');
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (const job of completedJobs) {
        if (job.completedDate && job.completedDate < oneDayAgo) {
          // Check if we already sent a follow-up for this job
          // (This would require additional tracking in the database)
          console.log(`📞 Potential follow-up reminder for job: ${job.title}`);
          
          // Could trigger customer satisfaction survey or review request
          // For now, just log the opportunity
        }
      }
    } catch (error) {
      console.error('Error in scheduled follow-up reminders:', error);
    }
  }

  // Check for overdue jobs and send alerts
  static async checkOverdueJobs(): Promise<void> {
    try {
      console.log('⏰ Checking for overdue jobs...');
      
      const now = new Date();
      const scheduledJobs = await storage.getJobsByStatus('scheduled');
      
      for (const job of scheduledJobs) {
        if (job.scheduledDate && job.scheduledDate < now) {
          // Job is overdue
          console.log(`🚨 Overdue job detected: ${job.title}`);
          
          // Create internal notification for team
          await notificationService.processNotificationTrigger({
            event: 'job_status_change',
            data: {
              job,
              oldStatus: 'scheduled',
              newStatus: 'overdue'
            }
          });
        }
      }
    } catch (error) {
      console.error('Error checking overdue jobs:', error);
    }
  }

  // Initialize automated background tasks
  static startBackgroundTasks(): void {
    console.log('🤖 Starting automated communication background tasks...');
    
    // Check for overdue jobs every hour
    setInterval(() => {
      this.checkOverdueJobs();
    }, 60 * 60 * 1000); // 1 hour

    // Check for follow-up reminders every 4 hours
    setInterval(() => {
      this.scheduleFollowUpReminders();
    }, 4 * 60 * 60 * 1000); // 4 hours

    console.log('✅ Automated communication system initialized');
  }

  // Get communication system status
  static getSystemStatus() {
    return {
      ...notificationService.getServiceStatus(),
      backgroundTasks: {
        overdueJobChecks: 'Running (hourly)',
        followUpReminders: 'Running (every 4 hours)'
      },
      lastChecked: new Date().toISOString()
    };
  }
}

// Start background tasks when module is loaded
AutomatedTriggers.startBackgroundTasks();