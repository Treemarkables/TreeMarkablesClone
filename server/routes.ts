import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendContactEmail } from "./email";

export async function registerRoutes(app: Express): Promise<Server> {
  // Facebook reviews endpoint
  app.get('/api/reviews/facebook', async (req: Request, res: Response) => {
    try {
      const accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
      
      if (!accessToken) {
        return res.status(500).json({ 
          success: false, 
          message: 'Facebook access token not configured' 
        });
      }

      // Fetch reviews from Facebook API
      // Note: You'll need your Facebook Page ID
      const pageId = process.env.FACEBOOK_PAGE_ID || 'YOUR_FACEBOOK_PAGE_ID'; // Replace with your actual page ID
      
      if (pageId === 'YOUR_FACEBOOK_PAGE_ID') {
        // Return fallback response when Page ID is not configured
        return res.json({ 
          success: false, 
          message: 'Facebook Page ID not configured',
          reviews: []
        });
      }

      const url = `https://graph.facebook.com/v18.0/${pageId}/ratings?access_token=${accessToken}&fields=reviewer{name},rating,review_text,created_time&limit=10`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.error('Facebook API error:', data);
        return res.status(500).json({ 
          success: false, 
          message: 'Failed to fetch Facebook reviews' 
        });
      }

      // Transform Facebook data to match our review interface
      const reviews = data.data?.map((review: any, index: number) => ({
        id: `fb-${index}`,
        name: review.reviewer?.name || 'Facebook User',
        location: 'Facebook',
        rating: review.rating || 5,
        comment: review.review_text || '',
        service: 'Tree Services',
        source: 'facebook',
        date: review.created_time
      })) || [];

      res.json({ success: true, reviews });

    } catch (error) {
      console.error('Facebook reviews error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error fetching Facebook reviews' 
      });
    }
  });

  // Contact form submission endpoint
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const { name, email, phone, hearAbout, message } = req.body;

      // Basic validation
      if (!name || !email || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Name, email, and message are required.' 
        });
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please provide a valid email address.' 
        });
      }

      // Send email
      const emailSent = await sendContactEmail({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim(),
        hearAbout,
        message: message.trim()
      });

      if (emailSent) {
        res.json({ 
          success: true, 
          message: 'Thank you! We will contact you within 24 hours for your free quote.' 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Sorry, there was an error sending your message. Please try again or call us directly.' 
        });
      }

    } catch (error) {
      console.error('Contact form error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Sorry, there was an error processing your request. Please try again.' 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
