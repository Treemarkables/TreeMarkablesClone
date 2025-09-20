import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { fileURLToPath } from 'url';
import { storage } from "./storage";
import { sendContactEmail } from "./email";
import { 
  leadSourceSchema, contactFormSchema, type InsertLeadSubmission, type LeadSource,
  insertCustomerSchema, insertLeadSchema, insertCallSchema, insertQuoteSchema,
  insertJobSchema, insertActivitySchema, insertReviewSchema, insertCampaignSchema,
  insertSocialPlanSchema, insertCompetitorSignalSchema, insertPriceRuleSchema,
  insertNotificationSchema, updateNotificationSchema,
  insertEmployeeSchema, updateEmployeeSchema,
  insertScheduleEventSchema, updateScheduleEventSchema,
  insertJobTemplateSchema, updateJobTemplateSchema,
  insertEquipmentSchema, updateEquipmentSchema,
  servicem8CustomerCsvSchema, servicem8JobCsvSchema, servicem8QuoteCsvSchema
} from "@shared/schema";
import multer from "multer";
import Papa from "papaparse";
import path from "path";
import fs from "fs";
import { format } from "date-fns";

// Configure multer for file uploads
// CSV file upload configuration
const csvUpload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Image upload configuration for job photos
const imageUpload = multer({
  dest: 'uploads/photos/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per image
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Get the directory path for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create photos directory if it doesn't exist
const photosDir = path.join(__dirname, '..', 'uploads', 'photos');
if (!fs.existsSync(photosDir)) {
  fs.mkdirSync(photosDir, { recursive: true });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // SEO routes - serve sitemap.xml and robots.txt
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    try {
      const sitemapPath = path.join(process.cwd(), 'sitemap.xml');
      
      if (fs.existsSync(sitemapPath)) {
        res.set('Content-Type', 'application/xml');
        res.sendFile(sitemapPath);
      } else {
        res.status(404).json({ 
          success: false, 
          message: 'Sitemap not found. Please generate sitemap using the included Python script.' 
        });
      }
    } catch (error) {
      console.error('Error serving sitemap:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error serving sitemap' 
      });
    }
  });

  app.get('/robots.txt', (req: Request, res: Response) => {
    try {
      const robotsPath = path.join(process.cwd(), 'robots.txt');
      
      if (fs.existsSync(robotsPath)) {
        res.set('Content-Type', 'text/plain');
        res.sendFile(robotsPath);
      } else {
        // Serve a basic robots.txt if file doesn't exist
        res.set('Content-Type', 'text/plain');
        res.send(`User-agent: *
Allow: /

Sitemap: https://www.treemarkables.co.nz/sitemap.xml`);
      }
    } catch (error) {
      console.error('Error serving robots.txt:', error);
      res.status(500).send('# Error serving robots.txt');
    }
  });
  // Facebook reviews endpoint
  app.get('/api/reviews/facebook', async (req: Request, res: Response) => {
    try {
      // Use long-lived Page Access Token instead of user token
      const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
      const pageId = process.env.FACEBOOK_PAGE_ID;
      
      if (!pageAccessToken) {
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Facebook Page Access Token not configured. Please set FACEBOOK_PAGE_ACCESS_TOKEN with a long-lived page token.' 
        });
      }

      if (!pageId) {
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Facebook Page ID not configured' 
        });
      }

      // Use ratings endpoint with page access token
      const url = `https://graph.facebook.com/v18.0/${pageId}/ratings?access_token=${pageAccessToken}&fields=reviewer{name},rating,review_text,created_time&limit=10`;
      
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        // Handle authentication errors gracefully instead of throwing 500
        if (data.error?.code === 190 || data.error?.type === 'OAuthException') {
          console.error('Facebook authentication error - token may be expired:', data.error?.message);
          return res.status(200).json({ 
            success: true, 
            reviews: [],
            message: 'Facebook token expired or invalid. Please refresh your long-lived Page Access Token.' 
          });
        }
        
        console.error('Facebook API error:', data);
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Unable to fetch Facebook reviews at this time' 
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

  // Google Places reviews endpoint (replaces Google Business Profile)
  app.get('/api/reviews/google', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MY_BUSINESS_API_KEY;
      const placeId = process.env.GOOGLE_PLACE_ID;
      
      if (!apiKey) {
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Google Places API key not configured. Please set GOOGLE_PLACES_API_KEY.' 
        });
      }

      if (!placeId) {
        return res.status(200).json({ 
          success: true, 
          reviews: [],
          message: 'Google Place ID not configured. Use /api/reviews/google/discover to find your Place ID.'
        });
      }

      let reviews: any[] = [];

      // Try new Google Places API v1 first
      try {
        const v1Url = `https://places.googleapis.com/v1/places/${placeId}`;
        
        const v1Response = await fetch(v1Url, {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews.text,reviews.rating,reviews.authorAttribution.displayName,reviews.publishTime'
          }
        });

        if (v1Response.ok) {
          const v1Data = await v1Response.json();
          
          if (v1Data.reviews && v1Data.reviews.length > 0) {
            reviews = v1Data.reviews.map((review: any, index: number) => ({
              id: `google-v1-${index}`,
              name: review.authorAttribution?.displayName || 'Google User',
              location: 'Google Reviews',
              rating: review.rating || 5,
              comment: review.text?.text || '',
              service: 'Tree Services',
              source: 'google',
              date: review.publishTime
            }));
          }
        }
      } catch (v1Error) {
        console.log('Google Places v1 API not available, trying legacy API');
      }

      // Fallback to legacy Google Places API if v1 failed or returned no reviews
      if (reviews.length === 0) {
        try {
          const legacyUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews&key=${apiKey}`;
          
          const legacyResponse = await fetch(legacyUrl);
          
          if (legacyResponse.ok) {
            const legacyData = await legacyResponse.json();
            
            if (legacyData.result?.reviews && legacyData.result.reviews.length > 0) {
              reviews = legacyData.result.reviews.map((review: any, index: number) => ({
                id: `google-legacy-${index}`,
                name: review.author_name || 'Google User',
                location: 'Google Reviews',
                rating: review.rating || 5,
                comment: review.text || '',
                service: 'Tree Services',
                source: 'google',
                date: new Date(review.time * 1000).toISOString()
              }));
            }
          }
        } catch (legacyError) {
          console.log('Google Places legacy API also failed');
        }
      }

      res.json({ 
        success: true, 
        reviews,
        message: reviews.length > 0 ? `Retrieved ${reviews.length} Google reviews` : 'No reviews found or API temporarily unavailable'
      });

    } catch (error) {
      console.error('Google Places reviews error:', error);
      res.status(200).json({ 
        success: true, 
        reviews: [],
        message: 'Unable to fetch Google reviews at this time' 
      });
    }
  });

  // Helper endpoint to discover Google Business Profile Account ID and Location ID
  app.get('/api/reviews/google/discover', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.GOOGLE_MY_BUSINESS_API_KEY;
      
      if (!apiKey) {
        return res.status(400).json({ 
          success: false, 
          message: 'Google My Business API key not configured' 
        });
      }

      const results: any = {
        success: false,
        attempts: [],
        recommendations: []
      };

      // Method 1: Try New Google Places API to find Treemarkables business
      try {
        // Try the new Places API (Text Search)
        const newPlacesUrl = `https://places.googleapis.com/v1/places:searchText`;
        
        const placesResponse = await fetch(newPlacesUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.reviews'
          },
          body: JSON.stringify({
            textQuery: 'Treemarkables tree removal Gisborne New Zealand',
            maxResultCount: 5
          })
        });

        const placesData = await placesResponse.json();
        
        results.attempts.push({
          method: 'New Google Places API Text Search',
          status: placesResponse.status,
          success: placesResponse.ok,
          data: placesData
        });

        if (placesData.places && placesData.places.length > 0) {
          const business = placesData.places[0];
          results.placesInfo = {
            placeId: business.id,
            name: business.displayName?.text || business.displayName,
            address: business.formattedAddress,
            rating: business.rating,
            userRatingsTotal: business.userRatingCount,
            reviews: business.reviews
          };
        }
      } catch (error) {
        results.attempts.push({
          method: 'New Google Places API',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Method 1b: Try Legacy Google Places API as fallback
      try {
        const legacyPlacesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=Treemarkables+Gisborne+tree+removal&key=${apiKey}`;
        
        const legacyResponse = await fetch(legacyPlacesUrl);
        const legacyData = await legacyResponse.json();
        
        results.attempts.push({
          method: 'Legacy Google Places Text Search',
          status: legacyResponse.status,
          success: legacyResponse.ok,
          data: legacyData
        });

        if (legacyData.results && legacyData.results.length > 0 && !results.placesInfo) {
          const business = legacyData.results[0];
          results.placesInfo = {
            placeId: business.place_id,
            name: business.name,
            address: business.formatted_address,
            rating: business.rating,
            userRatingsTotal: business.user_ratings_total
          };
          
          // Try to get detailed place info
          if (business.place_id) {
            const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${business.place_id}&fields=place_id,name,rating,reviews,formatted_address&key=${apiKey}`;
            const detailsResponse = await fetch(detailsUrl);
            const detailsData = await detailsResponse.json();
            
            results.attempts.push({
              method: 'Legacy Google Places Details',
              status: detailsResponse.status,
              success: detailsResponse.ok,
              data: detailsData
            });

            if (detailsData.result) {
              results.placeDetails = detailsData.result;
            }
          }
        }
      } catch (error) {
        results.attempts.push({
          method: 'Legacy Google Places API',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Method 2: Try Google Business Profile API with different approaches
      try {
        // Try the newer API endpoint
        const newApiUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/GoogleLocations:search?key=${apiKey}`;
        
        const newApiResponse = await fetch(newApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            location: {
              address: {
                locality: 'Gisborne',
                countryCode: 'NZ'
              }
            },
            query: 'Treemarkables'
          })
        });

        const newApiData = await newApiResponse.text();
        
        results.attempts.push({
          method: 'Google Business Profile Search',
          status: newApiResponse.status,
          success: newApiResponse.ok,
          data: newApiData
        });
      } catch (error) {
        results.attempts.push({
          method: 'Google Business Profile Search',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Method 3: Try to find through My Business API without auth (will fail but gives us info)
      try {
        const accountsUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/accounts?key=${apiKey}`;
        const accountsResponse = await fetch(accountsUrl);
        const accountsText = await accountsResponse.text();
        
        results.attempts.push({
          method: 'Direct Business Profile Accounts',
          status: accountsResponse.status,
          success: accountsResponse.ok,
          data: accountsText
        });
      } catch (error) {
        results.attempts.push({
          method: 'Direct Business Profile Accounts',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Generate recommendations based on what we found
      if (results.placesInfo) {
        results.success = true;
        results.recommendations.push(
          `Found your business on Google Places with ID: ${results.placesInfo.placeId}`
        );
        results.recommendations.push(
          `Business name: ${results.placesInfo.name}`
        );
        results.recommendations.push(
          `Address: ${results.placesInfo.address}`
        );
        if (results.placesInfo.userRatingsTotal > 0) {
          results.recommendations.push(
            `You have ${results.placesInfo.userRatingsTotal} Google reviews with average rating ${results.placesInfo.rating}`
          );
        }
      }

      results.recommendations.push(
        'Google Business Profile API requires OAuth2 authentication, not API keys'
      );
      results.recommendations.push(
        'To get Account ID and Location ID, you need to either:'
      );
      results.recommendations.push(
        '1. Set up OAuth2 flow (complex)'
      );
      results.recommendations.push(
        '2. Find IDs manually from business.google.com dashboard'
      );
      results.recommendations.push(
        '3. Use Google Places API for reviews (simpler, using Place ID)'
      );

      res.json(results);

    } catch (error) {
      console.error('Google Business Profile discovery error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error discovering Google Business Profile IDs',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });


  // Contact form submission endpoint
  app.post('/api/contact', async (req: Request, res: Response) => {
    try {
      const { name, email, phone, hearAbout, message, captchaToken, leadSource } = req.body;

      // Validate contact form data
      const contactValidation = contactFormSchema.safeParse({
        name, email, phone, hearAbout, message
      });

      if (!contactValidation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please provide valid contact information.' 
        });
      }

      // Validate lead source data if provided
      let validatedLeadSource: LeadSource | undefined = undefined;
      if (leadSource) {
        const leadSourceValidation = leadSourceSchema.safeParse(leadSource);
        if (leadSourceValidation.success) {
          validatedLeadSource = leadSourceValidation.data;
        } else {
          console.log('Invalid lead source data received:', leadSourceValidation.error);
        }
      }

      // Capture server-side data
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // CAPTCHA validation (always required now)
      const requireCaptcha = process.env.REQUIRE_CAPTCHA !== '0';
      
      if (requireCaptcha) {
        if (!captchaToken) {
          return res.status(400).json({ 
            success: false, 
            message: 'Please complete the CAPTCHA verification.' 
          });
        }

        // Verify CAPTCHA with Google
        const captchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify`;
        const captchaResponse = await fetch(captchaVerifyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${captchaToken}`
        });

        const captchaData = await captchaResponse.json();
        
        if (!captchaData.success) {
          console.log('CAPTCHA verification failed:', captchaData);
          return res.status(400).json({ 
            success: false, 
            message: 'CAPTCHA verification failed. Please try again.' 
          });
        }
        
        console.log('CAPTCHA verification successful for contact form submission');
      } else {
        console.log('CAPTCHA bypassed - manually disabled via REQUIRE_CAPTCHA=0');
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Please provide a valid email address.' 
        });
      }

      // Prepare lead submission data
      const leadSubmissionData: InsertLeadSubmission = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim().replace(/-/g, ''),
        hearAbout,
        message: message.trim(),
        leadSource: validatedLeadSource,
        ip: clientIp,
        userAgent
      };

      // Save lead information (even if email fails)
      try {
        await storage.saveLead(leadSubmissionData);
        console.log('Lead information saved successfully');
      } catch (error) {
        console.error('Error saving lead information:', error);
        // Continue with email sending even if lead saving fails
      }

      // Send webhook notification to Zapier (non-blocking) - TEMPORARILY DISABLED
      // try {
      //   const zapierWebhookUrl = process.env.ZAPIER_WEBHOOK_URL;
      //   if (zapierWebhookUrl) {
      //     fetch(zapierWebhookUrl, {
      //       method: 'POST',
      //       headers: {
      //         'Content-Type': 'application/json',
      //       },
      //       body: JSON.stringify({
      //         name: contactValidation.data.name,
      //         email: contactValidation.data.email,
      //         phone: contactValidation.data.phone,
      //         hearAbout: contactValidation.data.hearAbout,
      //         message: contactValidation.data.message,
      //         leadSource: validatedLeadSource,
      //         source: 'treemarkables-contact-form',
      //         timestamp: new Date().toISOString(),
      //         ip: clientIp,
      //         userAgent
      //       })
      //     }).catch(error => {
      //       console.error('[webhook] Failed to send to Zapier:', error);
      //     });
      //     console.log('[webhook] Contact form data sent to Zapier');
      //   }
      // } catch (error) {
      //   console.error('[webhook] Error sending to Zapier:', error);
      // }

      // Send email with lead source information
      const emailSent = await sendContactEmail(
        contactValidation.data,
        validatedLeadSource
      );

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

  // Lead reporting endpoints
  app.get('/api/leads/by-page', async (req: Request, res: Response) => {
    try {
      const leadsByPage = await storage.getLeadsByPagePath();
      res.json({
        success: true,
        data: leadsByPage,
        message: `Retrieved ${leadsByPage.length} page sources`
      });
    } catch (error) {
      console.error('Error retrieving leads by page:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving lead statistics'
      });
    }
  });

  app.get('/api/leads', async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      
      let fromDate: Date | undefined;
      let toDate: Date | undefined;
      
      if (from && typeof from === 'string') {
        fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid from date format'
          });
        }
      }
      
      if (to && typeof to === 'string') {
        toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid to date format'
          });
        }
      }
      
      const leads = await storage.getLeads(fromDate, toDate);
      
      // Return minimal fields for privacy
      const minimalLeads = leads.map(lead => ({
        id: lead.id,
        createdAt: lead.createdAt,
        name: lead.name,
        email: lead.email,
        pagePath: lead.leadSource?.pagePath,
        utmSource: lead.leadSource?.utmSource,
        utmMedium: lead.leadSource?.utmMedium,
        utmCampaign: lead.leadSource?.utmCampaign
      }));
      
      res.json({
        success: true,
        data: minimalLeads,
        count: minimalLeads.length,
        message: `Retrieved ${minimalLeads.length} leads`
      });
    } catch (error) {
      console.error('Error retrieving leads:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving leads'
      });
    }
  });

  // ========================================
  // CUSTOMER MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/customers', async (req: Request, res: Response) => {
    try {
      const validation = insertCustomerSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid customer data',
          errors: validation.error.errors 
        });
      }

      const customer = await storage.createCustomer(validation.data);
      res.json({ success: true, data: customer });
    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({ success: false, message: 'Error creating customer' });
    }
  });

  app.get('/api/customers', async (req: Request, res: Response) => {
    try {
      const { search } = req.query;
      let customers;
      
      if (search && typeof search === 'string') {
        customers = await storage.searchCustomers(search);
      } else {
        customers = await storage.getAllCustomers();
      }
      
      res.json({ success: true, data: customers });
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ success: false, message: 'Error fetching customers' });
    }
  });

  app.get('/api/customers/:id', async (req: Request, res: Response) => {
    try {
      const customer = await storage.getCustomer(req.params.id);
      if (!customer) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      res.json({ success: true, data: customer });
    } catch (error) {
      console.error('Error fetching customer:', error);
      res.status(500).json({ success: false, message: 'Error fetching customer' });
    }
  });

  app.put('/api/customers/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertCustomerSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const customer = await storage.updateCustomer(req.params.id, updates.data);
      res.json({ success: true, data: customer });
    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({ success: false, message: 'Error updating customer' });
    }
  });

  // ========================================
  // PIPELINE LEAD MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/pipeline-leads', async (req: Request, res: Response) => {
    try {
      const validation = insertLeadSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid lead data',
          errors: validation.error.errors 
        });
      }

      const lead = await storage.createPipelineLead(validation.data);
      res.json({ success: true, data: lead });
    } catch (error) {
      console.error('Error creating pipeline lead:', error);
      res.status(500).json({ success: false, message: 'Error creating lead' });
    }
  });

  app.get('/api/pipeline-leads', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let leads;
      
      if (status && typeof status === 'string') {
        leads = await storage.getPipelineLeadsByStatus(status);
      } else {
        leads = await storage.getAllPipelineLeads();
      }
      
      res.json({ success: true, data: leads });
    } catch (error) {
      console.error('Error fetching pipeline leads:', error);
      res.status(500).json({ success: false, message: 'Error fetching leads' });
    }
  });

  app.get('/api/pipeline-leads/:id', async (req: Request, res: Response) => {
    try {
      const lead = await storage.getPipelineLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ success: false, message: 'Lead not found' });
      }
      res.json({ success: true, data: lead });
    } catch (error) {
      console.error('Error fetching pipeline lead:', error);
      res.status(500).json({ success: false, message: 'Error fetching lead' });
    }
  });

  app.put('/api/pipeline-leads/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertLeadSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const lead = await storage.updatePipelineLead(req.params.id, updates.data);
      res.json({ success: true, data: lead });
    } catch (error) {
      console.error('Error updating pipeline lead:', error);
      res.status(500).json({ success: false, message: 'Error updating lead' });
    }
  });

  // ========================================
  // CALL MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/calls', async (req: Request, res: Response) => {
    try {
      const validation = insertCallSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid call data',
          errors: validation.error.errors 
        });
      }

      const call = await storage.createCall(validation.data);
      res.json({ success: true, data: call });
    } catch (error) {
      console.error('Error creating call:', error);
      res.status(500).json({ success: false, message: 'Error creating call' });
    }
  });

  app.get('/api/calls', async (req: Request, res: Response) => {
    try {
      const { customerId, leadId, limit } = req.query;
      let calls;
      
      if (customerId && typeof customerId === 'string') {
        calls = await storage.getCallsByCustomer(customerId);
      } else if (leadId && typeof leadId === 'string') {
        calls = await storage.getCallsByLead(leadId);
      } else {
        const limitNum = limit ? parseInt(limit as string) : undefined;
        calls = await storage.getAllCalls(limitNum);
      }
      
      res.json({ success: true, data: calls });
    } catch (error) {
      console.error('Error fetching calls:', error);
      res.status(500).json({ success: false, message: 'Error fetching calls' });
    }
  });

  app.get('/api/calls/:id', async (req: Request, res: Response) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ success: false, message: 'Call not found' });
      }
      res.json({ success: true, data: call });
    } catch (error) {
      console.error('Error fetching call:', error);
      res.status(500).json({ success: false, message: 'Error fetching call' });
    }
  });

  app.put('/api/calls/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertCallSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const call = await storage.updateCall(req.params.id, updates.data);
      res.json({ success: true, data: call });
    } catch (error) {
      console.error('Error updating call:', error);
      res.status(500).json({ success: false, message: 'Error updating call' });
    }
  });

  // ========================================
  // QUOTE MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/quotes', async (req: Request, res: Response) => {
    try {
      const validation = insertQuoteSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid quote data',
          errors: validation.error.errors 
        });
      }

      const quote = await storage.createQuote(validation.data);
      res.json({ success: true, data: quote });
    } catch (error) {
      console.error('Error creating quote:', error);
      res.status(500).json({ success: false, message: 'Error creating quote' });
    }
  });

  app.get('/api/quotes', async (req: Request, res: Response) => {
    try {
      const { customerId, leadId } = req.query;
      let quotes;
      
      if (customerId && typeof customerId === 'string') {
        quotes = await storage.getQuotesByCustomer(customerId);
      } else if (leadId && typeof leadId === 'string') {
        quotes = await storage.getQuotesByLead(leadId);
      } else {
        quotes = await storage.getAllQuotes();
      }
      
      res.json({ success: true, data: quotes });
    } catch (error) {
      console.error('Error fetching quotes:', error);
      res.status(500).json({ success: false, message: 'Error fetching quotes' });
    }
  });

  app.get('/api/quotes/:id', async (req: Request, res: Response) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote) {
        return res.status(404).json({ success: false, message: 'Quote not found' });
      }
      res.json({ success: true, data: quote });
    } catch (error) {
      console.error('Error fetching quote:', error);
      res.status(500).json({ success: false, message: 'Error fetching quote' });
    }
  });

  app.put('/api/quotes/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertQuoteSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const quote = await storage.updateQuote(req.params.id, updates.data);
      res.json({ success: true, data: quote });
    } catch (error) {
      console.error('Error updating quote:', error);
      res.status(500).json({ success: false, message: 'Error updating quote' });
    }
  });

  // ========================================
  // JOB MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/jobs', async (req: Request, res: Response) => {
    try {
      // Preprocess date fields - convert strings to Date objects
      const processedBody = { ...req.body };
      if (processedBody.scheduledDate && typeof processedBody.scheduledDate === 'string') {
        processedBody.scheduledDate = new Date(processedBody.scheduledDate);
      }
      if (processedBody.completedDate && typeof processedBody.completedDate === 'string') {
        processedBody.completedDate = new Date(processedBody.completedDate);
      }

      const validation = insertJobSchema.safeParse(processedBody);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid job data',
          errors: validation.error.errors 
        });
      }

      const job = await storage.createJob(validation.data);
      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({ success: false, message: 'Error creating job' });
    }
  });

  app.get('/api/jobs', async (req: Request, res: Response) => {
    try {
      const { customerId, status } = req.query;
      let jobs;
      
      if (customerId && typeof customerId === 'string') {
        jobs = await storage.getJobsByCustomer(customerId);
      } else if (status && typeof status === 'string') {
        jobs = await storage.getJobsByStatus(status);
      } else {
        jobs = await storage.getAllJobs();
      }
      
      res.json({ success: true, data: jobs });
    } catch (error) {
      console.error('Error fetching jobs:', error);
      res.status(500).json({ success: false, message: 'Error fetching jobs' });
    }
  });

  app.get('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
      const job = await storage.getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }
      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Error fetching job:', error);
      res.status(500).json({ success: false, message: 'Error fetching job' });
    }
  });

  app.put('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
      // Preprocess date fields - convert strings to Date objects
      const processedBody = { ...req.body };
      if (processedBody.scheduledDate && typeof processedBody.scheduledDate === 'string') {
        processedBody.scheduledDate = new Date(processedBody.scheduledDate);
      }
      if (processedBody.completedDate && typeof processedBody.completedDate === 'string') {
        processedBody.completedDate = new Date(processedBody.completedDate);
      }

      const validation = insertJobSchema.partial().safeParse(processedBody);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid job data',
          errors: validation.error.errors 
        });
      }

      const job = await storage.updateJob(req.params.id, validation.data);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }
      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Error updating job:', error);
      res.status(500).json({ success: false, message: 'Error updating job' });
    }
  });

  app.put('/api/jobs/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertJobSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const job = await storage.updateJob(req.params.id, updates.data);
      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Error updating job:', error);
      res.status(500).json({ success: false, message: 'Error updating job' });
    }
  });

  // ========================================
  // ACTIVITY TRACKING API ROUTES
  // ========================================

  app.post('/api/activities', async (req: Request, res: Response) => {
    try {
      const validation = insertActivitySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid activity data',
          errors: validation.error.errors 
        });
      }

      const activity = await storage.createActivity(validation.data);
      res.json({ success: true, data: activity });
    } catch (error) {
      console.error('Error creating activity:', error);
      res.status(500).json({ success: false, message: 'Error creating activity' });
    }
  });

  app.get('/api/activities', async (req: Request, res: Response) => {
    try {
      const { customerId, leadId, jobId, limit } = req.query;
      let activities;
      
      if (customerId && typeof customerId === 'string') {
        activities = await storage.getActivitiesByCustomer(customerId);
      } else if (leadId && typeof leadId === 'string') {
        activities = await storage.getActivitiesByLead(leadId);
      } else if (jobId && typeof jobId === 'string') {
        activities = await storage.getActivitiesByJob(jobId);
      } else {
        const limitNum = limit ? parseInt(limit as string) : undefined;
        activities = await storage.getAllActivities(limitNum);
      }
      
      res.json({ success: true, data: activities });
    } catch (error) {
      console.error('Error fetching activities:', error);
      res.status(500).json({ success: false, message: 'Error fetching activities' });
    }
  });

  // ========================================
  // REVIEW MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/reviews', async (req: Request, res: Response) => {
    try {
      const validation = insertReviewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid review data',
          errors: validation.error.errors 
        });
      }

      const review = await storage.createReview(validation.data);
      res.json({ success: true, data: review });
    } catch (error) {
      console.error('Error creating review:', error);
      res.status(500).json({ success: false, message: 'Error creating review' });
    }
  });

  app.get('/api/reviews', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.query;
      let reviews;
      
      if (customerId && typeof customerId === 'string') {
        reviews = await storage.getReviewsByCustomer(customerId);
      } else {
        reviews = await storage.getAllReviews();
      }
      
      res.json({ success: true, data: reviews });
    } catch (error) {
      console.error('Error fetching reviews:', error);
      res.status(500).json({ success: false, message: 'Error fetching reviews' });
    }
  });

  app.put('/api/reviews/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertReviewSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const review = await storage.updateReview(req.params.id, updates.data);
      res.json({ success: true, data: review });
    } catch (error) {
      console.error('Error updating review:', error);
      res.status(500).json({ success: false, message: 'Error updating review' });
    }
  });

  // ========================================
  // CAMPAIGN MANAGEMENT API ROUTES
  // ========================================

  app.post('/api/campaigns', async (req: Request, res: Response) => {
    try {
      const validation = insertCampaignSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid campaign data',
          errors: validation.error.errors 
        });
      }

      const campaign = await storage.createCampaign(validation.data);
      res.json({ success: true, data: campaign });
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ success: false, message: 'Error creating campaign' });
    }
  });

  app.get('/api/campaigns', async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getAllCampaigns();
      res.json({ success: true, data: campaigns });
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ success: false, message: 'Error fetching campaigns' });
    }
  });

  app.put('/api/campaigns/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertCampaignSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const campaign = await storage.updateCampaign(req.params.id, updates.data);
      res.json({ success: true, data: campaign });
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ success: false, message: 'Error updating campaign' });
    }
  });

  // ========================================
  // SOCIAL MEDIA PLANNING API ROUTES
  // ========================================

  app.post('/api/social-plans', async (req: Request, res: Response) => {
    try {
      const validation = insertSocialPlanSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid social plan data',
          errors: validation.error.errors 
        });
      }

      const plan = await storage.createSocialPlan(validation.data);
      res.json({ success: true, data: plan });
    } catch (error) {
      console.error('Error creating social plan:', error);
      res.status(500).json({ success: false, message: 'Error creating social plan' });
    }
  });

  app.get('/api/social-plans', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      let plans;
      
      if (status && typeof status === 'string') {
        plans = await storage.getSocialPlansByStatus(status);
      } else {
        plans = await storage.getAllSocialPlans();
      }
      
      res.json({ success: true, data: plans });
    } catch (error) {
      console.error('Error fetching social plans:', error);
      res.status(500).json({ success: false, message: 'Error fetching social plans' });
    }
  });

  app.put('/api/social-plans/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertSocialPlanSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const plan = await storage.updateSocialPlan(req.params.id, updates.data);
      res.json({ success: true, data: plan });
    } catch (error) {
      console.error('Error updating social plan:', error);
      res.status(500).json({ success: false, message: 'Error updating social plan' });
    }
  });

  // ========================================
  // COMPETITOR INTELLIGENCE API ROUTES
  // ========================================

  app.post('/api/competitor-signals', async (req: Request, res: Response) => {
    try {
      const validation = insertCompetitorSignalSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid competitor signal data',
          errors: validation.error.errors 
        });
      }

      const signal = await storage.createCompetitorSignal(validation.data);
      res.json({ success: true, data: signal });
    } catch (error) {
      console.error('Error creating competitor signal:', error);
      res.status(500).json({ success: false, message: 'Error creating competitor signal' });
    }
  });

  app.get('/api/competitor-signals', async (req: Request, res: Response) => {
    try {
      const { competitor } = req.query;
      let signals;
      
      if (competitor && typeof competitor === 'string') {
        signals = await storage.getCompetitorSignalsByCompetitor(competitor);
      } else {
        signals = await storage.getAllCompetitorSignals();
      }
      
      res.json({ success: true, data: signals });
    } catch (error) {
      console.error('Error fetching competitor signals:', error);
      res.status(500).json({ success: false, message: 'Error fetching competitor signals' });
    }
  });

  app.put('/api/competitor-signals/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertCompetitorSignalSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const signal = await storage.updateCompetitorSignal(req.params.id, updates.data);
      res.json({ success: true, data: signal });
    } catch (error) {
      console.error('Error updating competitor signal:', error);
      res.status(500).json({ success: false, message: 'Error updating competitor signal' });
    }
  });

  // ========================================
  // PRICING RULES API ROUTES
  // ========================================

  app.post('/api/price-rules', async (req: Request, res: Response) => {
    try {
      const validation = insertPriceRuleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid price rule data',
          errors: validation.error.errors 
        });
      }

      const rule = await storage.createPriceRule(validation.data);
      res.json({ success: true, data: rule });
    } catch (error) {
      console.error('Error creating price rule:', error);
      res.status(500).json({ success: false, message: 'Error creating price rule' });
    }
  });

  app.get('/api/price-rules', async (req: Request, res: Response) => {
    try {
      const { service } = req.query;
      let rules;
      
      if (service && typeof service === 'string') {
        rules = await storage.getPriceRulesByService(service);
      } else {
        rules = await storage.getAllPriceRules();
      }
      
      res.json({ success: true, data: rules });
    } catch (error) {
      console.error('Error fetching price rules:', error);
      res.status(500).json({ success: false, message: 'Error fetching price rules' });
    }
  });

  app.put('/api/price-rules/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertPriceRuleSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const rule = await storage.updatePriceRule(req.params.id, updates.data);
      res.json({ success: true, data: rule });
    } catch (error) {
      console.error('Error updating price rule:', error);
      res.status(500).json({ success: false, message: 'Error updating price rule' });
    }
  });

  // ========================================
  // BUSINESS INTELLIGENCE API ROUTES
  // ========================================

  app.get('/api/dashboard-stats', async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ success: false, message: 'Error fetching dashboard stats' });
    }
  });

  app.get('/api/revenue-stats', async (req: Request, res: Response) => {
    try {
      const { from, to } = req.query;
      
      let fromDate: Date | undefined;
      let toDate: Date | undefined;
      
      if (from && typeof from === 'string') {
        fromDate = new Date(from);
        if (isNaN(fromDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid from date format' });
        }
      }
      
      if (to && typeof to === 'string') {
        toDate = new Date(to);
        if (isNaN(toDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid to date format' });
        }
      }
      
      const stats = await storage.getRevenueStats(fromDate, toDate);
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error fetching revenue stats:', error);
      res.status(500).json({ success: false, message: 'Error fetching revenue stats' });
    }
  });

  app.get('/api/quote-analytics', async (req: Request, res: Response) => {
    try {
      const analytics = await storage.getQuoteAnalytics();
      res.json({ success: true, data: analytics });
    } catch (error) {
      console.error('Error fetching quote analytics:', error);
      res.status(500).json({ success: false, message: 'Error fetching quote analytics' });
    }
  });

  // ========================================
  // ENHANCED LEAD ANALYTICS ENDPOINTS
  // ========================================

  // Lead Scoring endpoint - provides scored and prioritized leads
  app.get('/api/lead-scoring', async (req: Request, res: Response) => {
    try {
      const scoredLeads = await storage.getLeadScoring();
      res.json({ success: true, data: scoredLeads });
    } catch (error) {
      console.error('Error fetching lead scoring:', error);
      res.status(500).json({ success: false, message: 'Error fetching lead scoring' });
    }
  });

  // Conversion Funnel endpoint - provides funnel analysis and conversion rates
  app.get('/api/conversion-funnel', async (req: Request, res: Response) => {
    try {
      const funnelData = await storage.getConversionFunnel();
      res.json({ success: true, data: funnelData });
    } catch (error) {
      console.error('Error fetching conversion funnel:', error);
      res.status(500).json({ success: false, message: 'Error fetching conversion funnel' });
    }
  });

  // Follow-up Queue endpoint - provides leads requiring follow-up action
  app.get('/api/follow-up-queue', async (req: Request, res: Response) => {
    try {
      const followUpQueue = await storage.getFollowUpQueue();
      res.json({ success: true, data: followUpQueue });
    } catch (error) {
      console.error('Error fetching follow-up queue:', error);
      res.status(500).json({ success: false, message: 'Error fetching follow-up queue' });
    }
  });

  // Lead Source Analysis endpoint - provides ROI and performance by source
  app.get('/api/lead-source-analysis', async (req: Request, res: Response) => {
    try {
      const sourceAnalysis = await storage.getLeadSourceAnalysis();
      res.json({ success: true, data: sourceAnalysis });
    } catch (error) {
      console.error('Error fetching lead source analysis:', error);
      res.status(500).json({ success: false, message: 'Error fetching lead source analysis' });
    }
  });

  // ========================================
  // CSV IMPORT ENDPOINTS FOR SERVICEM8 MIGRATION
  // ========================================

  // Import customers from ServiceM8 CSV export
  app.post('/api/import/customers', csvUpload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file provided' });
      }

      // Read and parse the CSV file
      const csvContent = fs.readFileSync(req.file.path, 'utf8');
      const parsedCsv = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsedCsv.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV parsing errors',
          errors: parsedCsv.errors,
        });
      }

      // Import the data
      const importResult = await storage.importCustomersFromCsv(parsedCsv.data);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully imported ${importResult.successfulImports} of ${importResult.totalRows} customers`,
        data: importResult,
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Error importing customers:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error importing customers',
      });
    }
  });

  // Import jobs from ServiceM8 CSV export
  app.post('/api/import/jobs', csvUpload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file provided' });
      }

      // Read and parse the CSV file
      const csvContent = fs.readFileSync(req.file.path, 'utf8');
      const parsedCsv = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsedCsv.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV parsing errors',
          errors: parsedCsv.errors,
        });
      }

      // Import the data
      const importResult = await storage.importJobsFromCsv(parsedCsv.data);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully imported ${importResult.successfulImports} of ${importResult.totalRows} jobs`,
        data: importResult,
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Error importing jobs:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error importing jobs',
      });
    }
  });

  // Import quotes from ServiceM8 CSV export
  app.post('/api/import/quotes', csvUpload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file provided' });
      }

      // Read and parse the CSV file
      const csvContent = fs.readFileSync(req.file.path, 'utf8');
      const parsedCsv = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      if (parsedCsv.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV parsing errors',
          errors: parsedCsv.errors,
        });
      }

      // Import the data
      const importResult = await storage.importQuotesFromCsv(parsedCsv.data);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        message: `Successfully imported ${importResult.successfulImports} of ${importResult.totalRows} quotes`,
        data: importResult,
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Error importing quotes:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error importing quotes',
      });
    }
  });

  // ========================================  
  // NOTIFICATION ENDPOINTS
  // ========================================

  // Get all notifications
  app.get('/api/notifications', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const notifications = await storage.getAllNotifications(userId, limit);
      
      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching notifications',
      });
    }
  });

  // Get unread notifications
  app.get('/api/notifications/unread', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const notifications = await storage.getUnreadNotifications(userId);
      
      res.json({
        success: true,
        data: notifications,
      });
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching unread notifications',
      });
    }
  });

  // Get notification summary
  app.get('/api/notifications/summary', async (req: Request, res: Response) => {
    try {
      const userId = req.query.userId as string;
      const summary = await storage.getNotificationSummary(userId);
      
      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      console.error('Error fetching notification summary:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching notification summary',
      });
    }
  });

  // Mark notification as read
  app.patch('/api/notifications/:id/read', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const notification = await storage.markNotificationAsRead(id);
      
      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error updating notification',
      });
    }
  });

  // Mark all notifications as read
  app.patch('/api/notifications/read-all', async (req: Request, res: Response) => {
    try {
      const userId = req.body.userId as string;
      await storage.markAllNotificationsAsRead(userId);
      
      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating notifications',
      });
    }
  });

  // Create a new notification (for testing purposes)
  app.post('/api/notifications', async (req: Request, res: Response) => {
    try {
      const validatedData = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(validatedData);
      
      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      console.error('Error creating notification:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error creating notification',
      });
    }
  });

  // Delete notification
  app.delete('/api/notifications/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteNotification(id);
      
      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting notification',
      });
    }
  });

  // ========================================  
  // CSV EXPORT ENDPOINTS
  // ========================================

  // Export leads to CSV
  app.get('/api/export/leads', async (req: Request, res: Response) => {
    try {
      const leads = await storage.getAllPipelineLeads();
      
      // Transform data for CSV export
      const csvData = leads.map(lead => ({
        ID: lead.id,
        Name: lead.name,
        Email: lead.email,
        Phone: lead.phone,
        Source: lead.source,
        Status: lead.status,
        Priority: lead.priority,
        'Service Requested': lead.serviceRequested,
        Notes: lead.notes,
        'Follow-up Date': lead.followUpDate ? format(new Date(lead.followUpDate), 'yyyy-MM-dd') : '',
        'Created Date': lead.createdAt ? format(new Date(lead.createdAt), 'yyyy-MM-dd') : '',
        'Updated Date': lead.updatedAt ? format(new Date(lead.updatedAt), 'yyyy-MM-dd') : ''
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);
      const filename = `leads_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      
      res.send(csv);
    } catch (error) {
      console.error('Error exporting leads:', error);
      res.status(500).json({ success: false, message: 'Error exporting leads' });
    }
  });

  // Export customers to CSV
  app.get('/api/export/customers', async (req: Request, res: Response) => {
    try {
      const customers = await storage.getAllCustomers();
      
      // Transform data for CSV export
      const csvData = customers.map(customer => ({
        ID: customer.id,
        Name: customer.name,
        Email: customer.email,
        Phone: customer.phone,
        Address: customer.address,
        'Lifetime Value': customer.lifetimeValue || '',
        Notes: customer.notes || '',
        'Created Date': customer.createdAt ? format(new Date(customer.createdAt), 'yyyy-MM-dd') : '',
        'Updated Date': customer.updatedAt ? format(new Date(customer.updatedAt), 'yyyy-MM-dd') : ''
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);
      const filename = `customers_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      
      res.send(csv);
    } catch (error) {
      console.error('Error exporting customers:', error);
      res.status(500).json({ success: false, message: 'Error exporting customers' });
    }
  });

  // Export jobs to CSV
  app.get('/api/export/jobs', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      
      // Transform data for CSV export
      const csvData = jobs.map(job => ({
        ID: job.id,
        'Customer ID': job.customerId,
        Title: job.title,
        Description: job.description,
        Status: job.status,
        Priority: job.priority,
        Price: job.price,
        'Scheduled Date': job.scheduledDate ? format(new Date(job.scheduledDate), 'yyyy-MM-dd') : '',
        Location: job.location || '',
        Notes: job.notes || '',
        'Before Photos': job.beforePhotos ? job.beforePhotos.length : 0,
        'After Photos': job.afterPhotos ? job.afterPhotos.length : 0,
        'Created Date': job.createdAt ? format(new Date(job.createdAt), 'yyyy-MM-dd') : '',
        'Updated Date': job.updatedAt ? format(new Date(job.updatedAt), 'yyyy-MM-dd') : ''
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);
      const filename = `jobs_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      
      res.send(csv);
    } catch (error) {
      console.error('Error exporting jobs:', error);
      res.status(500).json({ success: false, message: 'Error exporting jobs' });
    }
  });

  // Export quotes to CSV
  app.get('/api/export/quotes', async (req: Request, res: Response) => {
    try {
      const quotes = await storage.getAllQuotes();
      
      // Transform data for CSV export
      const csvData = quotes.map(quote => ({
        ID: quote.id,
        'Customer ID': quote.customerId,
        'Job Title': quote.jobTitle,
        Description: quote.description,
        'Total Amount': quote.totalAmount,
        Status: quote.status,
        'Valid Until': quote.validUntil ? format(new Date(quote.validUntil), 'yyyy-MM-dd') : '',
        Notes: quote.notes || '',
        'Created Date': quote.createdAt ? format(new Date(quote.createdAt), 'yyyy-MM-dd') : '',
        'Updated Date': quote.updatedAt ? format(new Date(quote.updatedAt), 'yyyy-MM-dd') : ''
      }));

      // Generate CSV
      const csv = Papa.unparse(csvData);
      const filename = `quotes_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      
      res.send(csv);
    } catch (error) {
      console.error('Error exporting quotes:', error);
      res.status(500).json({ success: false, message: 'Error exporting quotes' });
    }
  });

  // Export analytics data to CSV
  app.get('/api/export/analytics', async (req: Request, res: Response) => {
    try {
      const [dashboardStats, revenueStats, quoteAnalytics] = await Promise.all([
        storage.getDashboardStats(),
        storage.getRevenueStats(),
        storage.getQuoteAnalytics()
      ]);
      
      // Create analytics summary data
      const csvData = [{
        'Export Date': format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
        'Total Leads': dashboardStats.totalLeads,
        'Total Customers': dashboardStats.totalCustomers,
        'Total Jobs': dashboardStats.totalJobs,
        'Total Revenue': dashboardStats.totalRevenue,
        'Conversion Rate': `${dashboardStats.conversionRate}%`,
        'Average Quote Value': dashboardStats.averageQuoteValue,
        'Jobs Completed': revenueStats.jobsCompleted,
        'Average Job Value': revenueStats.averageJobValue,
        'Total Quotes': quoteAnalytics.totalQuotes,
        'Accepted Quotes': quoteAnalytics.acceptedQuotes,
        'Rejected Quotes': quoteAnalytics.rejectedQuotes,
        'Pending Quotes': quoteAnalytics.pendingQuotes,
        'Average Response Time (days)': quoteAnalytics.averageResponseTime,
      }];

      // Generate CSV
      const csv = Papa.unparse(csvData);
      const filename = `analytics_export_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;

      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      
      res.send(csv);
    } catch (error) {
      console.error('Error exporting analytics:', error);
      res.status(500).json({ success: false, message: 'Error exporting analytics' });
    }
  });

  // ========================================
  // PHOTO UPLOAD ENDPOINTS FOR JOB DOCUMENTATION
  // ========================================

  // Serve uploaded photos as static files
  app.use('/api/photos', (req, res, next) => {
    // Add basic security headers for image serving
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours cache
    next();
  }, express.static(path.join(__dirname, '..', 'uploads', 'photos')));

  // Upload photos for a job (before/after documentation)
  app.post('/api/jobs/:jobId/photos', imageUpload.array('photos', 10), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { type } = req.body; // 'before' or 'after'

      // Validate job ID format
      if (!jobId || typeof jobId !== 'string' || jobId.length < 1) {
        return res.status(400).json({ success: false, message: 'Invalid job ID' });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No photos provided' });
      }

      if (!type || (type !== 'before' && type !== 'after')) {
        return res.status(400).json({ 
          success: false, 
          message: 'Photo type must be either "before" or "after"' 
        });
      }

      // Check if job exists
      const job = await storage.getJob(jobId);
      if (!job) {
        // Clean up uploaded files if job doesn't exist
        req.files.forEach((file: any) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Generate photo URLs
      const photoUrls: string[] = [];
      const timestamp = Date.now();
      
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i] as Express.Multer.File;
        const fileExtension = path.extname(file.originalname);
        const newFileName = `${jobId}_${type}_${timestamp}_${i}${fileExtension}`;
        const newPath = path.join(photosDir, newFileName);
        
        // Move file to permanent location with descriptive name
        fs.renameSync(file.path, newPath);
        
        // Store relative URL for database
        photoUrls.push(`/api/photos/${newFileName}`);
      }

      // Update job with new photos
      const currentPhotos = type === 'before' ? job.beforePhotos || [] : job.afterPhotos || [];
      const updatedPhotos = [...currentPhotos, ...photoUrls];
      
      const updateData = type === 'before' 
        ? { beforePhotos: updatedPhotos }
        : { afterPhotos: updatedPhotos };

      await storage.updateJob(jobId, updateData);

      res.json({
        success: true,
        message: `Successfully uploaded ${photoUrls.length} ${type} photos`,
        photos: photoUrls,
        jobId
      });
    } catch (error) {
      // Clean up uploaded files on error
      if (req.files && Array.isArray(req.files)) {
        req.files.forEach((file: any) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }
      
      console.error('Error uploading job photos:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error uploading photos',
      });
    }
  });

  // Get photos for a job
  app.get('/api/jobs/:jobId/photos', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      res.json({
        success: true,
        jobId,
        beforePhotos: job.beforePhotos || [],
        afterPhotos: job.afterPhotos || []
      });
    } catch (error) {
      console.error('Error getting job photos:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving photos',
      });
    }
  });

  // Delete a specific photo from a job
  app.delete('/api/jobs/:jobId/photos', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { photoUrl, type } = req.body;

      // Validate job ID format
      if (!jobId || typeof jobId !== 'string' || jobId.length < 1) {
        return res.status(400).json({ success: false, message: 'Invalid job ID' });
      }

      if (!photoUrl || !type) {
        return res.status(400).json({ 
          success: false, 
          message: 'Photo URL and type are required' 
        });
      }

      if (type !== 'before' && type !== 'after') {
        return res.status(400).json({ 
          success: false, 
          message: 'Photo type must be either "before" or "after"' 
        });
      }

      // Security: Only allow deletion of files with expected naming pattern and extension
      const fileName = path.basename(photoUrl);
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      const fileExtension = path.extname(fileName).toLowerCase();
      
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid file type' 
        });
      }

      // Ensure the filename follows expected pattern: jobId_type_timestamp_index.ext
      const expectedPattern = new RegExp(`^${jobId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_${type}_\\d+_\\d+\\${fileExtension}$`);
      if (!expectedPattern.test(fileName)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid photo reference' 
        });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Remove photo URL from database
      const currentPhotos = type === 'before' ? job.beforePhotos || [] : job.afterPhotos || [];
      const updatedPhotos = currentPhotos.filter(url => url !== photoUrl);
      
      const updateData = type === 'before' 
        ? { beforePhotos: updatedPhotos }
        : { afterPhotos: updatedPhotos };

      await storage.updateJob(jobId, updateData);

      // Delete physical file
      try {
        const fileName = path.basename(photoUrl);
        const filePath = path.join(photosDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.warn('Could not delete physical file:', fileError);
        // Continue anyway - database is updated
      }

      res.json({
        success: true,
        message: 'Photo deleted successfully',
        jobId,
        deletedPhoto: photoUrl
      });
    } catch (error) {
      console.error('Error deleting job photo:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting photo',
      });
    }
  });

  // ========================================
  // EMPLOYEE MANAGEMENT ROUTES
  // ========================================

  // Get all employees
  app.get('/api/employees', async (req: Request, res: Response) => {
    try {
      const employees = await storage.getAllEmployees();
      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      console.error('Error fetching employees:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching employees'
      });
    }
  });

  // Get active employees only
  app.get('/api/employees/active', async (req: Request, res: Response) => {
    try {
      const employees = await storage.getActiveEmployees();
      res.json({
        success: true,
        data: employees
      });
    } catch (error) {
      console.error('Error fetching active employees:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching active employees'
      });
    }
  });

  // Get single employee
  app.get('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const employee = await storage.getEmployee(req.params.id);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }
      res.json({
        success: true,
        data: employee
      });
    } catch (error) {
      console.error('Error fetching employee:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching employee'
      });
    }
  });

  // Create new employee
  app.post('/api/employees', async (req: Request, res: Response) => {
    try {
      const validatedData = insertEmployeeSchema.parse(req.body);
      const employee = await storage.createEmployee(validatedData);
      res.json({
        success: true,
        data: employee,
        message: 'Employee created successfully'
      });
    } catch (error) {
      console.error('Error creating employee:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating employee'
      });
    }
  });

  // Update employee
  app.put('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateEmployeeSchema.parse(req.body);
      const employee = await storage.updateEmployee(req.params.id, validatedData);
      res.json({
        success: true,
        data: employee,
        message: 'Employee updated successfully'
      });
    } catch (error) {
      console.error('Error updating employee:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating employee'
      });
    }
  });

  // Delete employee
  app.delete('/api/employees/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteEmployee(req.params.id);
      res.json({
        success: true,
        message: 'Employee deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting employee:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting employee'
      });
    }
  });

  // ========================================
  // SCHEDULE EVENT MANAGEMENT ROUTES
  // ========================================

  // Get schedule events with optional date range
  app.get('/api/schedule-events', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, employeeId } = req.query;
      
      let events;
      if (employeeId) {
        events = await storage.getScheduleEventsByEmployee(
          employeeId as string,
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      } else {
        events = await storage.getAllScheduleEvents(
          startDate ? new Date(startDate as string) : undefined,
          endDate ? new Date(endDate as string) : undefined
        );
      }

      res.json({
        success: true,
        data: events
      });
    } catch (error) {
      console.error('Error fetching schedule events:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching schedule events'
      });
    }
  });

  // Get single schedule event
  app.get('/api/schedule-events/:id', async (req: Request, res: Response) => {
    try {
      const event = await storage.getScheduleEvent(req.params.id);
      if (!event) {
        return res.status(404).json({
          success: false,
          message: 'Schedule event not found'
        });
      }
      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error fetching schedule event:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching schedule event'
      });
    }
  });

  // Create new schedule event
  app.post('/api/schedule-events', async (req: Request, res: Response) => {
    try {
      const validatedData = insertScheduleEventSchema.parse(req.body);
      const event = await storage.createScheduleEvent(validatedData);
      res.json({
        success: true,
        data: event,
        message: 'Schedule event created successfully'
      });
    } catch (error) {
      console.error('Error creating schedule event:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating schedule event'
      });
    }
  });

  // Update schedule event
  app.put('/api/schedule-events/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateScheduleEventSchema.parse(req.body);
      const event = await storage.updateScheduleEvent(req.params.id, validatedData);
      res.json({
        success: true,
        data: event,
        message: 'Schedule event updated successfully'
      });
    } catch (error) {
      console.error('Error updating schedule event:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating schedule event'
      });
    }
  });

  // Delete schedule event
  app.delete('/api/schedule-events/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteScheduleEvent(req.params.id);
      res.json({
        success: true,
        message: 'Schedule event deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting schedule event:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting schedule event'
      });
    }
  });

  // ========================================
  // JOB TEMPLATE MANAGEMENT ROUTES
  // ========================================

  // Get all job templates
  app.get('/api/job-templates', async (req: Request, res: Response) => {
    try {
      const { category } = req.query;
      
      let templates;
      if (category) {
        templates = await storage.getJobTemplatesByCategory(category as string);
      } else {
        templates = await storage.getAllJobTemplates();
      }

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error fetching job templates:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching job templates'
      });
    }
  });

  // Get single job template
  app.get('/api/job-templates/:id', async (req: Request, res: Response) => {
    try {
      const template = await storage.getJobTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Job template not found'
        });
      }
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error fetching job template:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching job template'
      });
    }
  });

  // Create new job template
  app.post('/api/job-templates', async (req: Request, res: Response) => {
    try {
      const validatedData = insertJobTemplateSchema.parse(req.body);
      const template = await storage.createJobTemplate(validatedData);
      res.json({
        success: true,
        data: template,
        message: 'Job template created successfully'
      });
    } catch (error) {
      console.error('Error creating job template:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating job template'
      });
    }
  });

  // Update job template
  app.put('/api/job-templates/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateJobTemplateSchema.parse(req.body);
      const template = await storage.updateJobTemplate(req.params.id, validatedData);
      res.json({
        success: true,
        data: template,
        message: 'Job template updated successfully'
      });
    } catch (error) {
      console.error('Error updating job template:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating job template'
      });
    }
  });

  // Delete job template
  app.delete('/api/job-templates/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteJobTemplate(req.params.id);
      res.json({
        success: true,
        message: 'Job template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting job template:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting job template'
      });
    }
  });

  // ========================================
  // EQUIPMENT MANAGEMENT ROUTES
  // ========================================

  // Get all equipment
  app.get('/api/equipment', async (req: Request, res: Response) => {
    try {
      const { type, status, available } = req.query;
      
      let equipment;
      if (available === 'true') {
        equipment = await storage.getAvailableEquipment();
      } else if (type) {
        equipment = await storage.getEquipmentByType(type as string);
      } else if (status) {
        equipment = await storage.getEquipmentByStatus(status as string);
      } else {
        equipment = await storage.getAllEquipment();
      }

      res.json({
        success: true,
        data: equipment
      });
    } catch (error) {
      console.error('Error fetching equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching equipment'
      });
    }
  });

  // Get single equipment item
  app.get('/api/equipment/:id', async (req: Request, res: Response) => {
    try {
      const equipment = await storage.getEquipment(req.params.id);
      if (!equipment) {
        return res.status(404).json({
          success: false,
          message: 'Equipment not found'
        });
      }
      res.json({
        success: true,
        data: equipment
      });
    } catch (error) {
      console.error('Error fetching equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching equipment'
      });
    }
  });

  // Create new equipment
  app.post('/api/equipment', async (req: Request, res: Response) => {
    try {
      const validatedData = insertEquipmentSchema.parse(req.body);
      const equipment = await storage.createEquipment(validatedData);
      res.json({
        success: true,
        data: equipment,
        message: 'Equipment created successfully'
      });
    } catch (error) {
      console.error('Error creating equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating equipment'
      });
    }
  });

  // Update equipment
  app.put('/api/equipment/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateEquipmentSchema.parse(req.body);
      const equipment = await storage.updateEquipment(req.params.id, validatedData);
      res.json({
        success: true,
        data: equipment,
        message: 'Equipment updated successfully'
      });
    } catch (error) {
      console.error('Error updating equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating equipment'
      });
    }
  });

  // Delete equipment
  app.delete('/api/equipment/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteEquipment(req.params.id);
      res.json({
        success: true,
        message: 'Equipment deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting equipment'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
