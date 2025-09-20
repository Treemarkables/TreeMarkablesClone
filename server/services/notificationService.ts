import { emailService } from './emailService';
import { smsService } from './smsService';
import { storage } from '../storage';
import { insertNotificationSchema, type Customer, type Job } from '@shared/schema';

interface NotificationTrigger {
  event: 'job_status_change' | 'quote_sent' | 'quote_accepted' | 'service_request_created' | 'job_scheduled' | 'job_completed';
  data: any;
}

interface CustomerContactInfo {
  email?: string | null;
  phone?: string | null;
  name: string;
  communicationPreferences?: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    marketingOptIn: boolean;
  };
}

class NotificationService {
  async processNotificationTrigger(trigger: NotificationTrigger): Promise<void> {
    try {
      console.log(`🔔 Processing notification trigger: ${trigger.event}`);

      switch (trigger.event) {
        case 'job_status_change':
          await this.handleJobStatusChange(trigger.data);
          break;
        case 'quote_sent':
          await this.handleQuoteSent(trigger.data);
          break;
        case 'quote_accepted':
          await this.handleQuoteAccepted(trigger.data);
          break;
        case 'service_request_created':
          await this.handleServiceRequestCreated(trigger.data);
          break;
        case 'job_scheduled':
          await this.handleJobScheduled(trigger.data);
          break;
        case 'job_completed':
          await this.handleJobCompleted(trigger.data);
          break;
        default:
          console.warn(`Unknown notification trigger: ${trigger.event}`);
      }
    } catch (error) {
      console.error('Error processing notification trigger:', error);
    }
  }

  private async handleJobStatusChange(data: { job: Job; oldStatus: string; newStatus: string }): Promise<void> {
    const { job, oldStatus, newStatus } = data;
    
    // Skip if status didn't actually change
    if (oldStatus === newStatus) return;

    // Get customer information
    const customer = await this.getCustomerContactInfo(job.customerId);
    if (!customer) {
      console.error(`Customer not found for job ${job.id}`);
      return;
    }

    // Create internal notification
    await this.createInternalNotification({
      title: `Job Status Updated: ${job.title}`,
      message: `Job "${job.title}" status changed from ${oldStatus} to ${newStatus}`,
      type: 'job_status_change',
      priority: 'medium',
      jobId: job.id,
      customerId: job.customerId,
      actionUrl: `/job-dashboard?job=${job.id}`
    });

    // Send customer notifications based on preferences
    await this.sendCustomerNotifications(customer, {
      type: 'job_status_update',
      jobTitle: job.title,
      status: newStatus,
      jobData: job
    });

    console.log(`✅ Job status change notifications sent for job ${job.id}: ${oldStatus} → ${newStatus}`);
  }

  private async handleQuoteAccepted(data: { quote: any; customer: Customer }): Promise<void> {
    const { quote, customer } = data;

    // Create internal notification  
    await this.createInternalNotification({
      title: `Quote Accepted: #${quote.quoteNumber}`,
      message: `Quote #${quote.quoteNumber} accepted by ${customer.name} - $${quote.totalAmount} NZD`,
      type: 'quote_accepted',
      priority: 'high',
      customerId: customer.id,
      quoteId: quote.id,
      actionUrl: `/quotes?quote=${quote.id}`
    });

    console.log(`✅ Quote acceptance notifications processed for quote ${quote.quoteNumber}`);
  }

  private async handleQuoteSent(data: { quote: any; customer: Customer }): Promise<void> {
    const { quote, customer } = data;

    // Create internal notification  
    await this.createInternalNotification({
      title: `Quote Sent: #${quote.quoteNumber}`,
      message: `Quote #${quote.quoteNumber} sent to ${customer.name} - $${quote.totalAmount} NZD`,
      type: 'quote_sent',
      priority: 'medium',
      customerId: customer.id,
      quoteId: quote.id,
      actionUrl: `/quotes?quote=${quote.id}`
    });

    // Send quote to customer
    const customerInfo = await this.getCustomerContactInfo(customer.id);
    if (customerInfo) {
      if (customerInfo.email && customerInfo.communicationPreferences?.emailEnabled !== false) {
        await emailService.sendQuoteEmail(
          customerInfo.email,
          customerInfo.name,
          quote.quoteNumber,
          quote.totalAmount,
          quote
        );
      }

      if (customerInfo.phone && customerInfo.communicationPreferences?.smsEnabled !== false) {
        await smsService.sendQuoteSMS(
          customerInfo.phone,
          customerInfo.name,
          quote.quoteNumber,
          quote.totalAmount
        );
      }
    }

    console.log(`✅ Quote sent notifications processed for quote ${quote.quoteNumber}`);
  }

  private async handleServiceRequestCreated(data: { serviceRequest: any; customer: Customer }): Promise<void> {
    const { serviceRequest, customer } = data;

    // Create internal notification for the team
    await this.createInternalNotification({
      title: `New Service Request: ${serviceRequest.serviceType}`,
      message: `New ${serviceRequest.urgency} priority service request from ${customer.name}`,
      type: 'new_lead',
      priority: serviceRequest.urgency === 'urgent' ? 'urgent' : serviceRequest.urgency === 'high' ? 'high' : 'medium',
      customerId: customer.id,
      actionUrl: `/customer-portal`
    });

    // Send confirmation to customer
    const customerInfo = await this.getCustomerContactInfo(customer.id);
    if (customerInfo?.email) {
      await emailService.sendEmail({
        to: customerInfo.email,
        from: 'noreply@treemarkables.co.nz',
        subject: 'Service Request Received - Treemarkables',
        html: this.getServiceRequestConfirmationEmail(customerInfo.name, serviceRequest)
      });
    }

    if (customerInfo?.phone && customerInfo.communicationPreferences?.smsEnabled !== false) {
      await smsService.sendSMS({
        to: customerInfo.phone,
        message: `Hi ${customerInfo.name}, we received your ${serviceRequest.serviceType} request. We'll contact you within 24 hours. - Treemarkables`
      });
    }

    console.log(`✅ Service request notifications sent for request ${serviceRequest.id}`);
  }

  private async handleJobScheduled(data: { job: Job; scheduledDate: Date }): Promise<void> {
    const { job, scheduledDate } = data;
    
    const customer = await this.getCustomerInfo(job.customerId);
    if (!customer) return;

    // Send scheduling confirmation
    await this.sendCustomerNotifications(customer, {
      type: 'job_scheduled',
      jobTitle: job.title,
      scheduledDate,
      jobData: job
    });

    console.log(`✅ Job scheduled notifications sent for job ${job.id}`);
  }

  private async handleJobCompleted(data: { job: Job }): Promise<void> {
    const { job } = data;
    
    const customer = await this.getCustomerInfo(job.customerId);
    if (!customer) return;

    // Send completion notification
    await this.sendCustomerNotifications(customer, {
      type: 'job_completed',
      jobTitle: job.title,
      jobData: job
    });

    // Create follow-up notification for team (request review/feedback)
    await this.createInternalNotification({
      title: `Job Completed: ${job.title}`,
      message: `Job completed for ${customer.name}. Consider following up for feedback.`,
      type: 'job_completed',
      priority: 'low',
      jobId: job.id,
      customerId: job.customerId,
      actionUrl: `/job-dashboard?job=${job.id}`
    });

    console.log(`✅ Job completion notifications sent for job ${job.id}`);
  }

  private async sendCustomerNotifications(customer: CustomerContactInfo, notification: any): Promise<void> {
    const { type, jobTitle, status, scheduledDate, jobData } = notification;

    // Send email notification
    if (customer.email && customer.communicationPreferences?.emailEnabled !== false) {
      if (type === 'job_status_update') {
        await emailService.sendJobStatusEmail(
          customer.email,
          customer.name,
          jobTitle,
          status,
          { scheduledDate: scheduledDate || jobData?.scheduledDate }
        );
      }
    }

    // Send SMS notification
    if (customer.phone && customer.communicationPreferences?.smsEnabled !== false) {
      if (type === 'job_status_update') {
        await smsService.sendJobStatusSMS(
          customer.phone,
          customer.name,
          jobTitle,
          status
        );
      } else if (type === 'job_scheduled' && scheduledDate) {
        await smsService.sendSMS({
          to: customer.phone,
          message: `Hi ${customer.name}, your job "${jobTitle}" is scheduled for ${new Date(scheduledDate).toLocaleDateString('en-NZ')}. - Treemarkables`
        });
      }
    }
  }

  private async createInternalNotification(notificationData: any): Promise<void> {
    try {
      const validatedData = insertNotificationSchema.parse(notificationData);
      await storage.createNotification(validatedData);
    } catch (error) {
      console.error('Error creating internal notification:', error);
    }
  }

  private async getCustomerInfo(customerId: string): Promise<Customer | null> {
    try {
      const customer = await storage.getCustomer(customerId);
      return customer || null;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  }

  private async getCustomerContactInfo(customerId: string): Promise<CustomerContactInfo | null> {
    try {
      const customer = await storage.getCustomer(customerId);
      if (!customer) return null;

      // TODO: Fetch communication preferences from customer settings
      // For now, default to enabled
      return {
        email: customer.email || undefined,
        phone: customer.phone || undefined,
        name: customer.name,
        communicationPreferences: {
          emailEnabled: true,
          smsEnabled: true,
          marketingOptIn: false
        }
      };
    } catch (error) {
      console.error('Error fetching customer contact info:', error);
      return null;
    }
  }

  private getServiceRequestConfirmationEmail(customerName: string, serviceRequest: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Service Request Confirmation - Treemarkables</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #059669 0%, #10B981 100%); padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🌳 Treemarkables</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Professional Tree Services</p>
        </div>
        
        <div style="background: #f0fdf4; padding: 25px; border-radius: 8px; border-left: 4px solid #10B981; margin-bottom: 25px;">
          <h2 style="color: #059669; margin: 0 0 15px 0; font-size: 22px;">✅ Service Request Received</h2>
          <p style="margin: 0 0 10px 0; font-size: 16px;">Hi ${customerName},</p>
          <p style="margin: 0; font-size: 16px;">Thank you for your service request. We've received your request for <strong>${serviceRequest.serviceType}</strong> and will contact you within 24 hours.</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 25px;">
          <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 18px;">📋 Request Details</h3>
          <p style="margin: 0 0 5px 0; color: #6b7280;"><strong>Service:</strong> ${serviceRequest.serviceType}</p>
          <p style="margin: 0 0 5px 0; color: #6b7280;"><strong>Priority:</strong> ${serviceRequest.urgency}</p>
          <p style="margin: 0 0 5px 0; color: #6b7280;"><strong>Address:</strong> ${serviceRequest.address}</p>
          ${serviceRequest.preferredDate ? `<p style="margin: 0 0 5px 0; color: #6b7280;"><strong>Preferred Date:</strong> ${new Date(serviceRequest.preferredDate).toLocaleDateString('en-NZ')}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 30px 0;">
          <a href="http://localhost:5000/customer-portal" style="background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">View Request Status</a>
        </div>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="text-align: center; color: #6b7280; font-size: 14px;">
          <p style="margin: 0;">Questions? Contact us at <a href="tel:021-555-0123" style="color: #059669;">021 555 0123</a></p>
          <p style="margin: 10px 0 0 0;">© 2024 Treemarkables - Professional Tree Services in New Zealand</p>
        </div>
      </body>
      </html>
    `;
  }

  // Status check methods
  getServiceStatus() {
    return {
      email: {
        configured: emailService.isReady(),
        service: 'SendGrid'
      },
      sms: {
        configured: smsService.isReady(),
        service: 'Twilio'
      },
      notifications: {
        enabled: true,
        mockMode: !emailService.isReady() || !smsService.isReady()
      }
    };
  }
}

export const notificationService = new NotificationService();