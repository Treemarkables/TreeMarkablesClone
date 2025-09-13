import { MailService } from '@sendgrid/mail';

interface ContactFormData {
  name: string;
  email: string;
  phone?: string;
  hearAbout?: string;
  message: string;
}

export async function sendContactEmail(formData: ContactFormData): Promise<boolean> {
  try {
    // Debug environment variables
    console.log('Environment check:');
    console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? '***SET***' : 'NOT SET');
    
    // If SendGrid API key is not set, log the form submission for now
    if (!process.env.SENDGRID_API_KEY) {
      console.log('\n=== CONTACT FORM SUBMISSION ===');
      console.log('Customer Information:');
      console.log('Name:', formData.name);
      console.log('Email:', formData.email);
      if (formData.phone) console.log('Phone:', formData.phone);
      if (formData.hearAbout) console.log('How they heard about us:', formData.hearAbout);
      console.log('Message:', formData.message);
      console.log('Time:', new Date().toLocaleString());
      console.log('================================\n');
      
      // Return true so the form shows success message
      return true;
    }
    
    // Initialize SendGrid
    const mailService = new MailService();
    mailService.setApiKey(process.env.SENDGRID_API_KEY);

    // Format the email content
    const htmlContent = `
      <h2>New Quote Request from Treemarkables Website</h2>
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; font-family: Arial, sans-serif;">
        <h3 style="color: #e97516; margin-bottom: 15px;">Customer Information</h3>
        <p><strong>Name:</strong> ${formData.name}</p>
        <p><strong>Email:</strong> ${formData.email}</p>
        ${formData.phone ? `<p><strong>Phone:</strong> ${formData.phone}</p>` : ''}
        ${formData.hearAbout ? `<p><strong>How they heard about us:</strong> ${formData.hearAbout}</p>` : ''}
        
        <h3 style="color: #e97516; margin-top: 25px; margin-bottom: 15px;">Message</h3>
        <div style="background-color: white; padding: 15px; border-radius: 4px; border-left: 4px solid #e97516;">
          ${formData.message.replace(/\n/g, '<br>')}
        </div>
        
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

    // Send email using SendGrid
    await mailService.send({
      to: 'quotes@treemarkables.nz',
      from: 'quotes@treemarkables.nz', // Must be verified in SendGrid
      subject: `New Quote Request from ${formData.name}`,
      text: textContent,
      html: htmlContent,
      replyTo: formData.email, // Allow direct reply to customer
    });

    console.log('Contact form email sent successfully via SendGrid');
    return true;

  } catch (error) {
    console.error('Failed to send contact form email:', error);
    return false;
  }
}