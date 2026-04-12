import { db } from './db';
import { emailTemplates, smsTemplates, documentTemplates } from '../shared/schema';
import { DEFAULT_INVOICE_BLOCKS } from '../shared/schema';
import { eq, isNull } from 'drizzle-orm';

const starterEmailTemplates = [
  {
    name: 'Quote Follow-up',
    category: 'quote',
    subject: 'Following up on your quote #{jobNumber}',
    htmlContent: `Hi {firstName},

I hope this email finds you well. I wanted to follow up on the quote we provided for the work at {address}.

Do you have any questions about the quote? We're happy to discuss any details or make adjustments if needed.

Looking forward to hearing from you!

Best regards,
Treemarkables`,
    textContent: '',
    variables: ['firstName', 'customerName', 'jobNumber', 'address'],
    description: 'Follow up with customers about pending quotes',
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Job Confirmation',
    category: 'job_status',
    subject: 'Job Confirmed - {address}',
    htmlContent: `Hi {firstName},

This is to confirm that we have scheduled your tree service for {address}.

Job Number: {jobNumber}

We'll be in touch closer to the date with specific timing details.

If you have any questions, please don't hesitate to reach out!

Best regards,
Treemarkables Team`,
    textContent: '',
    variables: ['firstName', 'customerName', 'jobNumber', 'address'],
    description: 'Confirm job booking with customer',
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Invoice',
    category: 'invoice',
    subject: 'Invoice {invoiceNumber} - ${invoiceAmount}',
    htmlContent: `Hi {firstName},

Please find attached invoice {invoiceNumber} for the tree service work we completed at {address}.

Invoice Amount: {invoiceAmount}
Due Date: {dueDate}

You can view and pay your invoice here: {invoiceLink}

If you have any questions about this invoice, please don't hesitate to contact us.

Thank you for your business!

Best regards,
Treemarkables`,
    textContent: '',
    variables: ['firstName', 'customerName', 'invoiceNumber', 'invoiceAmount', 'dueDate', 'invoiceLink', 'address', 'jobNumber'],
    description: 'Send invoice to customer',
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Invoice Reminder',
    category: 'invoice',
    subject: 'Payment Reminder - Invoice for {address}',
    htmlContent: `Hi {firstName},

This is a friendly reminder about the outstanding invoice for the tree service work we completed at {address}.

Job Number: {jobNumber}

If you've already sent payment, please disregard this message. If you have any questions about the invoice, please let us know.

Thank you for your business!

Best regards,
Treemarkables`,
    textContent: '',
    variables: ['firstName', 'customerName', 'jobNumber', 'address'],
    description: 'Gentle reminder for unpaid invoices',
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Thank You',
    category: 'custom_message',
    subject: 'Thank you for choosing Treemarkables',
    htmlContent: `Hi {firstName},

Thank you for choosing Treemarkables for your tree service needs at {address}!

We truly appreciate your business and hope you're happy with the work we completed.

If you have any feedback or future tree service needs, please don't hesitate to reach out.

Best regards,
Treemarkables Team`,
    textContent: '',
    variables: ['firstName', 'customerName', 'address'],
    description: 'Thank you message after job completion',
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
];

const starterSmsTemplates = [
  {
    name: 'Job Confirmation SMS',
    category: 'confirmation',
    message: 'Hi {firstName}, your tree service is confirmed for {address}. We\'ll contact you with timing details soon. - Treemarkables',
    variables: ['firstName', 'customerName', 'address'],
    description: 'Quick SMS confirmation for scheduled jobs',
    maxLength: 160,
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'On Our Way',
    category: 'job_status',
    message: 'Hi {firstName}, we\'re on our way to {address} now. See you soon! - Treemarkables',
    variables: ['firstName', 'customerName', 'address'],
    description: 'Let customer know crew is en route',
    maxLength: 160,
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Quote Ready',
    category: 'quote',
    message: 'Hi {firstName}, your quote for job #{jobNumber} is ready. Check your email for details. - Treemarkables',
    variables: ['firstName', 'customerName', 'jobNumber'],
    description: 'Notify customer quote is ready',
    maxLength: 160,
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Job Complete',
    category: 'job_status',
    message: 'Job complete at {address}! Thanks for choosing Treemarkables. Invoice will be emailed shortly.',
    variables: ['address'],
    description: 'Notify customer job is finished',
    maxLength: 160,
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
  {
    name: 'Payment Received',
    category: 'invoice',
    message: 'Payment received for job #{jobNumber}. Thank you {firstName}! - Treemarkables',
    variables: ['firstName', 'customerName', 'jobNumber'],
    description: 'Confirm payment receipt',
    maxLength: 160,
    isActive: true,
    isDefault: false,
    createdBy: 'system',
  },
];

export async function seedTemplates() {
  try {
    console.log('🌱 Seeding communication templates...');

    // Check if templates already exist
    const existingEmailTemplates = await db.select().from(emailTemplates).limit(1);
    const existingSmsTemplates = await db.select().from(smsTemplates).limit(1);

    if (existingEmailTemplates.length > 0 || existingSmsTemplates.length > 0) {
      console.log('✅ Templates already exist, skipping seed');
      return;
    }

    // Insert email templates
    for (const template of starterEmailTemplates) {
      await db.insert(emailTemplates).values(template);
    }
    console.log(`✅ Seeded ${starterEmailTemplates.length} email templates`);

    // Insert SMS templates
    for (const template of starterSmsTemplates) {
      await db.insert(smsTemplates).values(template);
    }
    console.log(`✅ Seeded ${starterSmsTemplates.length} SMS templates`);

    console.log('🎉 Template seeding complete!');
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  }
}

export async function seedDefaultBlockConfig(): Promise<void> {
  try {
    const templates = await db.select().from(documentTemplates).where(eq(documentTemplates.type, 'invoice'));
    for (const tpl of templates) {
      if (!tpl.blockConfig || (Array.isArray(tpl.blockConfig) && (tpl.blockConfig as unknown[]).length === 0)) {
        await db.update(documentTemplates)
          .set({ blockConfig: DEFAULT_INVOICE_BLOCKS as unknown[] })
          .where(eq(documentTemplates.id, tpl.id));
        console.log(`✅ Seeded default block_config for template: ${tpl.name}`);
      }
    }
  } catch (error) {
    console.error('❌ Error seeding default block_config:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedTemplates()
    .then(() => seedDefaultBlockConfig())
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
