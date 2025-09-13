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
        // Return error response when Page ID is not configured
        return res.status(500).json({ 
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

  // Google Business Profile reviews endpoint
  app.get('/api/reviews/google', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GOOGLE_MY_BUSINESS_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          success: false, 
          message: 'Google Business Profile API key not configured' 
        });
      }

      // You'll need to replace these with your actual account and location IDs
      // For now, we'll return a success response with empty reviews to avoid errors
      // To get your account and location IDs, you'll need to use the Google Business Profile API
      const accountId = process.env.GOOGLE_BUSINESS_ACCOUNT_ID;
      const locationId = process.env.GOOGLE_BUSINESS_LOCATION_ID;
      
      if (!accountId || !locationId) {
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Google Business Profile account/location IDs not configured'
        });
      }

      // Fetch reviews from Google Business Profile API
      const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews?key=${apiKey}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error('Google Business Profile API error:', response.status, response.statusText);
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Unable to fetch Google reviews at this time'
        });
      }

      const data = await response.json();

      // Transform Google data to match our review interface
      const reviews = data.reviews?.map((review: any, index: number) => ({
        id: `google-${index}`,
        name: review.reviewer?.displayName || 'Google User',
        location: 'Google Reviews',
        rating: review.starRating || 5,
        comment: review.comment || '',
        service: 'Tree Services',
        source: 'google',
        date: review.createTime
      })) || [];

      res.json({ success: true, reviews });

    } catch (error) {
      console.error('Google Business Profile reviews error:', error);
      res.status(200).json({ 
        success: true, 
        reviews: [],
        message: 'Unable to fetch Google reviews at this time' 
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
