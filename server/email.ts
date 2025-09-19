import nodemailer from 'nodemailer';
import { type LeadSource } from "@shared/schema";

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  hearAbout?: string;
  message: string;
}

// HTML escape function for security
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (match) => map[match]);
}

export async function sendContactEmail(formData: ContactFormData, leadSource?: LeadSource): Promise<boolean> {
  try {
    // Debug environment variables
    console.log('Environment check:');
    console.log('GMAIL_USER:', process.env.GMAIL_USER ? '***SET***' : 'NOT SET');
    console.log('GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '***SET***' : 'NOT SET');
    
    // If Gmail credentials are not set, log the form submission for now
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.log('\n=== CONTACT FORM SUBMISSION ===');
      console.log('Customer Information:');
      console.log('Name:', formData.name);
      console.log('Email:', formData.email);
      if (formData.phone) console.log('Phone:', formData.phone);
      if (formData.hearAbout) console.log('How they heard about us:', formData.hearAbout);
      console.log('Message:', formData.message);
      
      if (leadSource) {
        console.log('\nLead Source Information:');
        if (leadSource.pagePath) console.log('Page:', leadSource.pagePath);
        if (leadSource.pageUrl) console.log('Full URL:', leadSource.pageUrl);
        if (leadSource.referrer) console.log('Referrer:', leadSource.referrer);
        if (leadSource.utmSource) console.log('UTM Source:', leadSource.utmSource);
        if (leadSource.utmMedium) console.log('UTM Medium:', leadSource.utmMedium);
        if (leadSource.utmCampaign) console.log('UTM Campaign:', leadSource.utmCampaign);
        if (leadSource.firstTouchPagePath && leadSource.firstTouchPagePath !== leadSource.pagePath) {
          console.log('First Visit Page:', leadSource.firstTouchPagePath);
        }
      }
      
      console.log('Time:', new Date().toLocaleString());
      console.log('================================\n');
      
      // Return true so the form shows success message
      return true;
    }
    
    // Create Gmail SMTP transporter with explicit settings
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER?.trim(),
        pass: process.env.GMAIL_APP_PASSWORD?.trim(),
      },
    });

    // Verify transporter configuration
    try {
      await transporter.verify();
      console.log('Gmail SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('Gmail SMTP verification failed:', verifyError);
      throw verifyError;
    }

    // Format the email content with proper HTML escaping for security
    const htmlContent = `
      <h2>New Quote Request from Treemarkables Website</h2>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; font-family: Arial, sans-serif;">
        <h3 style="color: #e97516; margin-bottom: 15px;">Customer Information</h3>
        <p><strong>Name:</strong> ${escapeHtml(formData.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(formData.email)}</p>
        ${formData.phone ? `<p><strong>Phone:</strong> ${escapeHtml(formData.phone)}</p>` : ''}
        ${formData.hearAbout ? `<p><strong>How they heard about us:</strong> ${escapeHtml(formData.hearAbout)}</p>` : ''}
        
        <h3 style="color: #e97516; margin-top: 25px; margin-bottom: 15px;">Message</h3>
        <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #e97516;">
          ${escapeHtml(formData.message).replace(/\n/g, '<br>')}
        </div>
        
        ${leadSource ? `
        <h3 style="color: #e97516; margin-top: 25px; margin-bottom: 15px;">Lead Source</h3>
        <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #0066cc;">
          ${leadSource.pagePath ? `<p><strong>Page:</strong> ${escapeHtml(leadSource.pagePath)}</p>` : ''}
          ${leadSource.pageUrl ? `<p><strong>Full URL:</strong> ${escapeHtml(leadSource.pageUrl)}</p>` : ''}
          ${leadSource.referrer ? `<p><strong>Referrer:</strong> ${escapeHtml(leadSource.referrer)}</p>` : ''}
          ${leadSource.utmSource ? `<p><strong>UTM Source:</strong> ${escapeHtml(leadSource.utmSource)}</p>` : ''}
          ${leadSource.utmMedium ? `<p><strong>UTM Medium:</strong> ${escapeHtml(leadSource.utmMedium)}</p>` : ''}
          ${leadSource.utmCampaign ? `<p><strong>UTM Campaign:</strong> ${escapeHtml(leadSource.utmCampaign)}</p>` : ''}
          ${leadSource.utmTerm ? `<p><strong>UTM Term:</strong> ${escapeHtml(leadSource.utmTerm)}</p>` : ''}
          ${leadSource.utmContent ? `<p><strong>UTM Content:</strong> ${escapeHtml(leadSource.utmContent)}</p>` : ''}
          ${leadSource.gclid ? `<p><strong>Google Click ID:</strong> ${escapeHtml(leadSource.gclid)}</p>` : ''}
          ${leadSource.firstTouchPagePath && leadSource.firstTouchPagePath !== leadSource.pagePath ? `<p><strong>First Visit Page:</strong> ${escapeHtml(leadSource.firstTouchPagePath)}</p>` : ''}
        </div>
        ` : ''}
        
        <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;">
        <p style="color: #666; font-size: 12px;">
          This email was sent from the Treemarkables website contact form.
        </p>
      </div>
    `;

    const textContent = `
New Quote Request from Treemarkables Website

Customer Information:
Name: ${formData.name}
Email: ${formData.email}
${formData.phone ? `Phone: ${formData.phone}` : ''}
${formData.hearAbout ? `How they heard about us: ${formData.hearAbout}` : ''}

Message:
${formData.message}

---
This email was sent from the Treemarkables website contact form.
    `;

    // Create ServiceM8 formatted content for job creation
    const leadSourceText = `Website${leadSource?.pagePath ? ` ${leadSource.pagePath}` : ''}`;
    const servicem8Content = `New Tree Removal Quote Request

Contact: ${formData.name}
Phone: ${formData.phone || 'Not provided'}
Mobile: ${formData.phone || 'Not provided'}
Email: ${formData.email}
PO Number: ${leadSourceText}
Service Required: ${formData.hearAbout || 'Tree Service'}

Job Details:
${formData.message}

Submitted: ${new Date().toLocaleString()}

---
Automatic lead from treemarkables.nz contact form`;

    // Send to Gmail (detailed format)
    const gmailOptions = {
      from: `"Treemarkables Website" <${process.env.GMAIL_USER}>`,
      to: 'quotes@treemarkables.nz',
      subject: `New Quote Request from ${formData.name}`,
      text: textContent,
      html: htmlContent,
      replyTo: formData.email,
    };

    // Send to ServiceM8 (clean format for job creation)
    const servicem8Options = {
      from: `"${formData.name}" <${process.env.GMAIL_USER}>`,
      to: '762a68@inbox.servicem8.com',
      subject: formData.message.substring(0, 100) + (formData.message.length > 100 ? '...' : ''),
      text: servicem8Content,
      replyTo: formData.email,
    };

    // Send both emails with error tolerance
    const emailResults = await Promise.allSettled([
      transporter.sendMail(gmailOptions),
      transporter.sendMail(servicem8Options)
    ]);
    
    const gmailSuccess = emailResults[0].status === 'fulfilled';
    const servicem8Success = emailResults[1].status === 'fulfilled';
    
    if (gmailSuccess && servicem8Success) {
      console.log('Contact form emails sent successfully to both Gmail and ServiceM8');
    } else if (gmailSuccess) {
      console.log('Contact form email sent to Gmail successfully. ServiceM8 delivery failed:', 
                  emailResults[1].status === 'rejected' ? emailResults[1].reason : 'Unknown error');
    } else if (servicem8Success) {
      console.log('Contact form email sent to ServiceM8 successfully. Gmail delivery failed:', 
                  emailResults[0].status === 'rejected' ? emailResults[0].reason : 'Unknown error');
    } else {
      console.error('Both email deliveries failed:', 
                    emailResults[0].status === 'rejected' ? emailResults[0].reason : 'Unknown Gmail error',
                    emailResults[1].status === 'rejected' ? emailResults[1].reason : 'Unknown ServiceM8 error');
      return false;
    }
    
    return true;

  } catch (error) {
    console.error('Failed to send contact form email:', error);
    return false;
  }
}