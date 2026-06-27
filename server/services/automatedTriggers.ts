import { notificationService } from './notificationService';
import { storage } from '../storage';
import { workflowAutomationService } from './workflowAutomation';
import { runAllReminderChecks } from './reminderChecker';
import { runLaneAutomationChecks, runLaneStatusChangeAutomations, runLaneEntryForEvent, runLaneExitForEvent, onLaneJobEvent } from './laneAutomationService';
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

      // ('scheduled' status retired 2026-05 — scheduling is now date-driven,
      // not status-driven. Customer scheduling notifications fire via the
      // sendClientNotification checkbox in the UI when a date is set.)
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

      if (newStatus === 'completed' && oldStatus !== 'completed') {
        await this.onJobCompleted(job);
      }

      // Lanes: run status_changed automations for the job's current lane, then evaluate
      // status-driven auto-exit and auto-entry (a lane can pin a target status).
      await runLaneStatusChangeAutomations(job);
      await runLaneExitForEvent(job, 'status_changed');
      await runLaneEntryForEvent(job, 'status_changed');
    } catch (error) {
      console.error('Error in job status change trigger:', error);
    }
  }

  // Called when a customer replies (from the SMS / email reply pollers).
  static async onCustomerReplyReceived(jobId: string): Promise<void> {
    try {
      await onLaneJobEvent(jobId, 'customer_replied');
    } catch (error) {
      console.error('Error in customer-reply lane trigger:', error);
    }
  }

  // Called when a job is newly scheduled
  static async onJobScheduled(job: Job): Promise<void> {
    try {
      if (!job.scheduledDate) {
        console.warn(`Job ${job.id} marked as scheduled but no scheduledDate provided`);
        return;
      }

      // DISABLED: Customer scheduling notifications are now controlled explicitly
      // via the sendClientNotification checkbox in the UI (see routes.ts line 7908)
      // This prevents automatic notifications from being sent when user hasn't opted in
      
      // await notificationService.processNotificationTrigger({
      //   event: 'job_scheduled',
      //   data: {
      //     job,
      //     scheduledDate: job.scheduledDate
      //   }
      // });
      
      console.log(`📋 Job scheduled: ${job.title} - notifications controlled by user checkbox`);
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

      // Lanes: auto-enter a lane configured for new jobs.
      await runLaneEntryForEvent(job, 'job_created');
      
      // If the job is created already on the calendar, trigger scheduling
      // notifications. ('scheduled' status retired 2026-05 — the signal is
      // now scheduledDate, not status.)
      if (job.status === 'work_order' && job.scheduledDate) {
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
      // 'scheduled' status retired 2026-05 — overdue = work_order with a
      // scheduledDate in the past.
      const workOrderJobs = await storage.getJobsByStatus('work_order');

      for (const job of workOrderJobs) {
        if (job.scheduledDate && job.scheduledDate < now) {
          console.log(`🚨 Overdue job detected: ${job.title}`);

          await notificationService.processNotificationTrigger({
            event: 'job_status_change',
            data: {
              job,
              oldStatus: 'work_order',
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

    // Run proactive business reminder checks every hour
    setInterval(() => {
      runAllReminderChecks().catch(err => console.error('[AutomatedTriggers] Reminder check error:', err));
    }, 60 * 60 * 1000); // 1 hour

    // Run lane "days in lane" automation checks every hour
    setInterval(() => {
      runLaneAutomationChecks().catch(err => console.error('[AutomatedTriggers] Lane automation check error:', err));
    }, 60 * 60 * 1000); // 1 hour

    // Run once shortly after startup (90 second delay to let DB connect)
    setTimeout(() => {
      runAllReminderChecks().catch(err => console.error('[AutomatedTriggers] Initial reminder check error:', err));
      runLaneAutomationChecks().catch(err => console.error('[AutomatedTriggers] Initial lane automation check error:', err));
    }, 90 * 1000);

    console.log('✅ Automated communication system initialized');
  }

  // Get communication system status
  static getSystemStatus() {
    return {
      ...notificationService.getServiceStatus(),
      backgroundTasks: {
        overdueJobChecks: 'Running (hourly)',
        followUpReminders: 'Running (every 4 hours)',
        proactiveReminders: 'Running (hourly)'
      },
      lastChecked: new Date().toISOString()
    };
  }
}

// Start background tasks when module is loaded — gated by RUN_CRONS so the
// standby instance during a multi-stack deployment (Replit↔DO soak) doesn't
// fire duplicate SMS/email/notification work. Matches the gate in
// server/index.ts:646.
if (process.env.RUN_CRONS === 'false') {
  console.log('⏸️  [AutomatedTriggers] RUN_CRONS=false — automated communication background tasks suppressed on this instance');
} else {
  AutomatedTriggers.startBackgroundTasks();
}