import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { fileURLToPath } from 'url';
import { storage } from "./storage";
import { sendContactEmail } from "./email";
import { 
  leadSourceSchema, contactFormSchema, type InsertLeadSubmission, type LeadSource,
  insertCustomerSchema, insertLeadSchema, insertCallSchema, insertQuoteSchema,
  insertJobSchema, insertJobDiaryEntrySchema, insertActivitySchema, insertReviewSchema, insertCampaignSchema,
  insertSocialPlanSchema, insertCompetitorSignalSchema, insertPriceRuleSchema,
  insertNotificationSchema, updateNotificationSchema,
  insertEmployeeSchema, updateEmployeeSchema,
  insertScheduleEventSchema, updateScheduleEventSchema,
  insertJobTemplateSchema, updateJobTemplateSchema,
  insertEquipmentSchema, updateEquipmentSchema,
  insertInventorySchema, insertEquipmentCheckoutSchema, insertEquipmentMaintenanceSchema,
  insertBusinessSettingsSchema, updateBusinessSettingsSchema,
  insertCommunicationSchema, updateCommunicationSchema,
  insertPhotoSchema, updatePhotoSchema, photoUploadSchema, photoSearchSchema, gpsLocationSchema,
  insertInvoiceSchema, insertServiceRequestSchema, insertCustomerAuthSchema,
  insertCommunicationPreferencesSchema,
  servicem8CustomerCsvSchema, servicem8JobCsvSchema, servicem8QuoteCsvSchema,
  safetyIncidentInsertSchema, type InsertSafetyIncident,
  riskAssessmentInsertSchema, type InsertRiskAssessment,
  complianceRequirementInsertSchema, type InsertComplianceRequirement,
  complianceRecordInsertSchema, type InsertComplianceRecord,
  // Proposal Management
  insertProposalSchema, updateProposalSchema,
  insertProposalSectionSchema, updateProposalSectionSchema,
  insertProposalLineItemSchema, updateProposalLineItemSchema,
  insertProposalLineItemChoiceSchema, updateProposalLineItemChoiceSchema
} from "@shared/schema";
import multer from "multer";
import Papa from "papaparse";
import path from "path";
import fs from "fs";
import { format } from "date-fns";
import { AutomatedTriggers } from "./services/automatedTriggers";
import { workflowAutomationService } from "./services/workflowAutomation";
import { businessIntelligenceService } from "./services/businessIntelligence";
import { weatherService } from "./services/weatherService";

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

// Safe file extensions for images
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Image upload configuration for job photos
const imageUpload = multer({
  dest: 'uploads/photos/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per image
    files: 10 // Maximum 10 files at once
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(new Error(`File type ${file.mimetype} not allowed. Only JPEG, PNG, and WebP images are permitted.`));
      return;
    }
    
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      cb(new Error(`File extension ${ext} not allowed. Only .jpg, .jpeg, .png, and .webp files are permitted.`));
      return;
    }
    
    cb(null, true);
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
  // COMMUNICATION PREFERENCES API ROUTES
  // ========================================

  app.get('/api/customers/:customerId/communication-preferences', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      console.log(`[COMM_PREFS] GET request for customer: ${customerId}`);
      const preferences = await storage.getCommunicationPreferences(customerId);
      console.log(`[COMM_PREFS] Retrieved preferences:`, preferences);
      
      if (!preferences) {
        // Return default preferences if none exist
        const defaultPreferences = {
          customerId,
          emailEnabled: true,
          smsEnabled: true,
          marketingOptIn: false,
          jobNotifications: true,
          quoteNotifications: true,
          reminderNotifications: true,
          emergencyNotifications: true,
          preferredNotificationTime: 'morning',
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
          timezone: 'Pacific/Auckland',
          language: 'en',
        };
        console.log(`[COMM_PREFS] Returning default preferences for customer: ${customerId}`);
        return res.json({ success: true, data: defaultPreferences });
      }
      
      console.log(`[COMM_PREFS] Returning saved preferences for customer: ${customerId}`);
      res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('Error fetching communication preferences:', error);
      res.status(500).json({ success: false, message: 'Error fetching communication preferences' });
    }
  });

  app.put('/api/customers/:customerId/communication-preferences', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      
      // SECURITY WARNING: This endpoint lacks authentication/authorization!
      // In production, verify the requesting user can only access their own preferences
      console.log(`[COMM_PREFS] PUT request for customer: ${customerId}`);
      console.log(`[COMM_PREFS] Request body:`, req.body);
      
      const validation = insertCommunicationPreferencesSchema.partial().safeParse({
        ...req.body,
        customerId
      });
      
      if (!validation.success) {
        console.log(`[COMM_PREFS] Validation failed:`, validation.error.errors);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid communication preferences data',
          errors: validation.error.errors 
        });
      }

      console.log(`[COMM_PREFS] Validated data:`, validation.data);
      // Use UPSERT logic: creates new record if none exists, updates if exists
      const preferences = await storage.updateCommunicationPreferences(customerId, validation.data);
      console.log(`[COMM_PREFS] Updated preferences:`, preferences);
      res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('Error updating communication preferences:', error);
      res.status(500).json({ success: false, message: 'Error updating communication preferences' });
    }
  });

  app.post('/api/customers/:customerId/communication-preferences', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const validation = insertCommunicationPreferencesSchema.safeParse({
        ...req.body,
        customerId
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid communication preferences data',
          errors: validation.error.errors 
        });
      }

      const preferences = await storage.createCommunicationPreferences(validation.data);
      res.json({ success: true, data: preferences });
    } catch (error) {
      console.error('Error creating communication preferences:', error);
      res.status(500).json({ success: false, message: 'Error creating communication preferences' });
    }
  });

  app.delete('/api/customers/:customerId/communication-preferences', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const deleted = await storage.deleteCommunicationPreferences(customerId);
      
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Communication preferences not found' });
      }
      
      res.json({ success: true, message: 'Communication preferences deleted successfully' });
    } catch (error) {
      console.error('Error deleting communication preferences:', error);
      res.status(500).json({ success: false, message: 'Error deleting communication preferences' });
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
      
      // Trigger automated notifications for new job
      AutomatedTriggers.onJobCreated(job)
        .catch(error => console.error('Error triggering new job notification:', error));

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

      // Get the old job for status comparison
      const oldJob = await storage.getJob(req.params.id);
      const oldStatus = oldJob?.status || '';

      const job = await storage.updateJob(req.params.id, validation.data);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Trigger automated notifications if status changed
      if (validation.data.status && validation.data.status !== oldStatus) {
        console.log(`🔔 Job status change detected: ${job.title} (${oldStatus} → ${validation.data.status})`);
        AutomatedTriggers.onJobStatusChange(job.id, oldStatus, validation.data.status)
          .catch(error => console.error('Error triggering job status change notification:', error));
      }

      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Error updating job:', error);
      res.status(500).json({ success: false, message: 'Error updating job' });
    }
  });

  // ========================================
  // JOB DIARY ROUTES
  // ========================================

  // Create job diary entry
  app.post('/api/jobs/:jobId/diary', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const entryData = {
        ...req.body,
        jobId
      };
      
      const validation = insertJobDiaryEntrySchema.safeParse(entryData);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid diary entry data',
          errors: validation.error.errors 
        });
      }

      const entry = await storage.createJobDiaryEntry(validation.data);
      res.json({ success: true, data: entry });
    } catch (error) {
      console.error('Error creating job diary entry:', error);
      res.status(500).json({ success: false, message: 'Error creating diary entry' });
    }
  });

  // Get job diary entries
  app.get('/api/jobs/:jobId/diary', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { entryType } = req.query;
      
      let entries;
      if (entryType && typeof entryType === 'string') {
        entries = await storage.getJobDiaryEntriesByType(jobId, entryType);
      } else {
        entries = await storage.getJobDiaryEntriesByJob(jobId);
      }
      
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('Error fetching job diary entries:', error);
      res.status(500).json({ success: false, message: 'Error fetching diary entries' });
    }
  });

  // Get single diary entry
  app.get('/api/diary/:id', async (req: Request, res: Response) => {
    try {
      const entry = await storage.getJobDiaryEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ success: false, message: 'Diary entry not found' });
      }
      res.json({ success: true, data: entry });
    } catch (error) {
      console.error('Error fetching diary entry:', error);
      res.status(500).json({ success: false, message: 'Error fetching diary entry' });
    }
  });

  // Update diary entry
  app.put('/api/diary/:id', async (req: Request, res: Response) => {
    try {
      const validation = insertJobDiaryEntrySchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid diary entry data',
          errors: validation.error.errors 
        });
      }

      const entry = await storage.updateJobDiaryEntry(req.params.id, validation.data);
      res.json({ success: true, data: entry });
    } catch (error) {
      console.error('Error updating diary entry:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Diary entry not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error updating diary entry' });
      }
    }
  });

  // Delete diary entry
  app.delete('/api/diary/:id', async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteJobDiaryEntry(req.params.id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Diary entry not found' });
      }
      res.json({ success: true, message: 'Diary entry deleted successfully' });
    } catch (error) {
      console.error('Error deleting diary entry:', error);
      res.status(500).json({ success: false, message: 'Error deleting diary entry' });
    }
  });

  // Get all diary entries (for admin view)
  app.get('/api/diary', async (req: Request, res: Response) => {
    try {
      const entries = await storage.getAllJobDiaryEntries();
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('Error fetching all diary entries:', error);
      res.status(500).json({ success: false, message: 'Error fetching diary entries' });
    }
  });

  // ========================================
  // GROSS MARGIN ROUTES
  // ========================================

  // Update job gross margin data
  app.put('/api/jobs/:id/gross-margin', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const grossMarginData = req.body;
      
      // Validate the input data
      const validFields = ['laborCosts', 'materialsCosts', 'otherCosts', 'laborHours', 'hourlyRate'];
      const filteredData: any = {};
      
      for (const [key, value] of Object.entries(grossMarginData)) {
        if (validFields.includes(key) && value !== undefined && value !== null && value !== '') {
          filteredData[key] = typeof value === 'string' ? parseFloat(value) : value;
        }
      }

      // Check if job has staff time entries and ignore labor cost fields if so
      let warningMessage = null;
      try {
        const staffTimeEntries = await storage.getJobStaffTimeEntries(id);
        if (staffTimeEntries.length > 0) {
          // Remove labor-related fields - they're calculated from staff time
          if (filteredData.laborCosts || filteredData.laborHours || filteredData.hourlyRate) {
            warningMessage = 'Labor cost fields ignored - calculated automatically from staff time entries';
          }
          delete filteredData.laborCosts;
          delete filteredData.laborHours;
          delete filteredData.hourlyRate;
        }
      } catch (error) {
        // If we can't check staff time, proceed normally
        console.warn('Could not check staff time entries for job', id, error);
      }

      const updatedJob = await storage.updateJobGrossMargin(id, filteredData);
      const response: any = { success: true, data: updatedJob };
      if (warningMessage) {
        response.warning = warningMessage;
      }
      res.json(response);
    } catch (error) {
      console.error('Error updating job gross margin:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error updating gross margin' });
      }
    }
  });

  // Calculate and update gross margin for a job
  app.post('/api/jobs/:id/calculate-margin', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updatedJob = await storage.calculateAndUpdateGrossMargin(id);
      res.json({ success: true, data: updatedJob });
    } catch (error) {
      console.error('Error calculating gross margin:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error calculating gross margin' });
      }
    }
  });

  // Validate if gross margin calculation is complete
  app.get('/api/jobs/:id/gross-margin/validate', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const isComplete = await storage.validateGrossMarginComplete(id);
      res.json({ success: true, data: { isComplete } });
    } catch (error) {
      console.error('Error validating gross margin:', error);
      res.status(500).json({ success: false, message: 'Error validating gross margin' });
    }
  });

  // ========================================
  // ENHANCED EXPENSE TRACKING API ROUTES
  // ========================================

  // Update job expenses
  app.put('/api/jobs/:id/expenses', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const expenseData = req.body;
      
      // Validate and convert expense data
      const validFields = ['actualLaborCosts', 'actualMaterialsCosts', 'equipmentCosts', 
                          'subcontractorCosts', 'permitCosts', 'travelCosts', 
                          'disposalCosts', 'miscExpenses'];
      const filteredData: any = {};
      
      for (const [key, value] of Object.entries(expenseData)) {
        if (validFields.includes(key) && value !== undefined && value !== null && value !== '') {
          filteredData[key] = typeof value === 'string' ? parseFloat(value) : value;
        }
      }

      const updatedJob = await storage.updateJobExpenses(id, filteredData);
      res.json({ success: true, data: updatedJob });
    } catch (error) {
      console.error('Error updating job expenses:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error updating job expenses' });
      }
    }
  });

  // Update expense completion status
  app.put('/api/jobs/:id/expense-completion', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const completionData = req.body;
      
      // Validate completion data
      const validFields = ['laborCostsComplete', 'materialsCostsComplete', 
                          'equipmentCostsComplete', 'subcontractorCostsComplete', 
                          'otherExpensesComplete'];
      const filteredData: any = {};
      
      for (const [key, value] of Object.entries(completionData)) {
        if (validFields.includes(key) && typeof value === 'boolean') {
          filteredData[key] = value;
        }
      }

      const updatedJob = await storage.updateExpenseCompletionStatus(id, filteredData);
      res.json({ success: true, data: updatedJob });
    } catch (error) {
      console.error('Error updating expense completion status:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error updating expense completion status' });
      }
    }
  });

  // Check invoice eligibility
  app.get('/api/jobs/:id/invoice-eligibility', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updatedJob = await storage.updateInvoiceEligibility(id);
      res.json({ 
        success: true, 
        data: { 
          invoiceEligible: updatedJob.invoiceEligible,
          invoiceBlocked: updatedJob.invoiceBlocked,
          allExpensesComplete: updatedJob.allExpensesComplete,
          marginMeetsThreshold: updatedJob.marginMeetsThreshold,
          grossMargin: updatedJob.grossMargin
        } 
      });
    } catch (error) {
      console.error('Error checking invoice eligibility:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error checking invoice eligibility' });
      }
    }
  });

  // ========================================
  // STAFF TIME TRACKING API ROUTES
  // ========================================

  // Get staff time entries for a job
  app.get('/api/jobs/:id/staff-time', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const staffTimeEntries = await storage.getJobStaffTimeEntries(id);
      res.json({ success: true, data: staffTimeEntries });
    } catch (error) {
      console.error('Error getting job staff time entries:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error getting staff time entries' });
      }
    }
  });

  // Add or update staff time entry for a job
  app.post('/api/jobs/:id/staff-time', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const entryData = req.body;
      
      // Validate required fields
      if (!entryData.employeeId || !entryData.hours || !entryData.rate) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required fields: employeeId, hours, and rate are required' 
        });
      }

      // Convert strings to numbers
      const entry = {
        employeeId: entryData.employeeId,
        hours: typeof entryData.hours === 'string' ? parseFloat(entryData.hours) : entryData.hours,
        rate: typeof entryData.rate === 'string' ? parseFloat(entryData.rate) : entryData.rate,
        date: entryData.date
      };

      // Validate numeric values
      if (isNaN(entry.hours) || isNaN(entry.rate) || entry.hours < 0 || entry.rate < 0) {
        return res.status(400).json({ 
          success: false, 
          message: 'Hours and rate must be valid positive numbers' 
        });
      }

      const updatedJob = await storage.addStaffTimeEntry(id, entry);
      
      // Automatically update job labor costs from staff time totals
      const staffEntries = await storage.getJobStaffTimeEntries(id);
      const totalLaborCost = staffEntries.reduce((sum, e) => sum + (e.hours * e.rate), 0);
      const totalHours = staffEntries.reduce((sum, e) => sum + e.hours, 0);
      
      // Update job with computed labor costs
      await storage.updateJobExpenses(id, { actualLaborCosts: totalLaborCost });
      
      // Recalculate gross margin
      const finalJob = await storage.calculateAndUpdateGrossMargin(id);
      res.json({ success: true, data: finalJob });
    } catch (error) {
      console.error('Error adding staff time entry:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error adding staff time entry' });
      }
    }
  });

  // Update multiple staff time entries for a job
  app.put('/api/jobs/:id/staff-time', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { staffTimeEntries } = req.body;
      
      if (!Array.isArray(staffTimeEntries)) {
        return res.status(400).json({ 
          success: false, 
          message: 'staffTimeEntries must be an array' 
        });
      }

      // Validate and convert entries
      const validatedEntries = staffTimeEntries.map((entry, index) => {
        if (!entry.employeeId || entry.hours === undefined || entry.rate === undefined) {
          throw new Error(`Entry ${index}: Missing required fields (employeeId, hours, rate)`);
        }

        const hours = typeof entry.hours === 'string' ? parseFloat(entry.hours) : entry.hours;
        const rate = typeof entry.rate === 'string' ? parseFloat(entry.rate) : entry.rate;

        if (isNaN(hours) || isNaN(rate) || hours < 0 || rate < 0) {
          throw new Error(`Entry ${index}: Hours and rate must be valid positive numbers`);
        }

        return {
          employeeId: entry.employeeId,
          hours,
          rate,
          date: entry.date
        };
      });

      const updatedJob = await storage.updateJobStaffTime(id, validatedEntries);
      
      // Automatically update job labor costs from staff time totals
      const totalLaborCost = validatedEntries.reduce((sum, e) => sum + (e.hours * e.rate), 0);
      const totalHours = validatedEntries.reduce((sum, e) => sum + e.hours, 0);
      
      // Update job with computed labor costs
      await storage.updateJobExpenses(id, { actualLaborCosts: totalLaborCost });
      
      // Recalculate gross margin
      const finalJob = await storage.calculateAndUpdateGrossMargin(id);
      res.json({ success: true, data: finalJob });
    } catch (error) {
      console.error('Error updating staff time entries:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: error.message || 'Error updating staff time entries' });
      }
    }
  });

  // Remove staff time entry for a job
  app.delete('/api/jobs/:id/staff-time/:employeeId', async (req: Request, res: Response) => {
    try {
      const { id, employeeId } = req.params;
      const { date } = req.query;
      
      const updatedJob = await storage.removeStaffTimeEntry(id, employeeId, date as string);
      
      // Automatically update job labor costs from remaining staff time totals
      const staffEntries = await storage.getJobStaffTimeEntries(id);
      const totalLaborCost = staffEntries.reduce((sum, e) => sum + (e.hours * e.rate), 0);
      const totalHours = staffEntries.reduce((sum, e) => sum + e.hours, 0);
      
      // Update job with computed labor costs
      await storage.updateJobExpenses(id, { actualLaborCosts: totalLaborCost });
      
      // Recalculate gross margin
      const finalJob = await storage.calculateAndUpdateGrossMargin(id);
      res.json({ success: true, data: finalJob });
    } catch (error) {
      console.error('Error removing staff time entry:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error removing staff time entry' });
      }
    }
  });

  // Calculate labor cost from staff time
  app.get('/api/jobs/:id/staff-time/labor-cost', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const laborCost = await storage.calculateLaborCostFromStaffTime(id);
      res.json({ success: true, data: { laborCost } });
    } catch (error) {
      console.error('Error calculating labor cost from staff time:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ success: false, message: 'Job not found' });
      } else {
        res.status(500).json({ success: false, message: 'Error calculating labor cost' });
      }
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
  // WORKFLOW AUTOMATION ENDPOINTS
  // ========================================

  // Get all workflow rules
  app.get('/api/workflows', async (req: Request, res: Response) => {
    try {
      const workflows = workflowAutomationService.getWorkflows();
      res.json({ success: true, data: workflows });
    } catch (error) {
      console.error('Error fetching workflows:', error);
      res.status(500).json({ success: false, message: 'Error fetching workflows' });
    }
  });

  // Get specific workflow by ID
  app.get('/api/workflows/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const workflow = workflowAutomationService.getWorkflow(id);
      
      if (!workflow) {
        return res.status(404).json({ success: false, message: 'Workflow not found' });
      }
      
      res.json({ success: true, data: workflow });
    } catch (error) {
      console.error('Error fetching workflow:', error);
      res.status(500).json({ success: false, message: 'Error fetching workflow' });
    }
  });

  // Toggle workflow enabled/disabled
  app.patch('/api/workflows/:id/toggle', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ success: false, message: 'enabled field must be a boolean' });
      }
      
      const success = workflowAutomationService.toggleWorkflow(id, enabled);
      
      if (!success) {
        return res.status(404).json({ success: false, message: 'Workflow not found' });
      }
      
      res.json({ success: true, message: `Workflow ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
      console.error('Error toggling workflow:', error);
      res.status(500).json({ success: false, message: 'Error toggling workflow' });
    }
  });

  // Trigger a workflow manually for testing
  app.post('/api/workflows/trigger', async (req: Request, res: Response) => {
    try {
      const { triggerType, data, context } = req.body;
      
      if (!triggerType) {
        return res.status(400).json({ success: false, message: 'triggerType is required' });
      }
      
      await workflowAutomationService.processWorkflowTrigger(triggerType, data || {}, context);
      
      res.json({ success: true, message: 'Workflow trigger processed successfully' });
    } catch (error) {
      console.error('Error processing workflow trigger:', error);
      res.status(500).json({ success: false, message: 'Error processing workflow trigger' });
    }
  });

  // Add new workflow rule
  app.post('/api/workflows', async (req: Request, res: Response) => {
    try {
      const workflowRule = req.body;
      
      // Enhanced validation
      if (!workflowRule.id || !workflowRule.name || !workflowRule.trigger) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow must have id, name, and trigger' 
        });
      }
      
      if (!workflowRule.conditions || !Array.isArray(workflowRule.conditions)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow must have conditions array' 
        });
      }
      
      if (!workflowRule.actions || !Array.isArray(workflowRule.actions)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow must have actions array' 
        });
      }
      
      workflowAutomationService.addWorkflowRule(workflowRule);
      
      res.json({ success: true, message: 'Workflow rule added successfully' });
    } catch (error) {
      console.error('Error adding workflow rule:', error);
      res.status(500).json({ success: false, message: 'Error adding workflow rule' });
    }
  });

  // Update workflow rule
  app.put('/api/workflows/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const workflowRule = req.body;
      
      // Enhanced validation
      if (!workflowRule.name || !workflowRule.trigger) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow must have name and trigger' 
        });
      }
      
      if (!workflowRule.conditions || !Array.isArray(workflowRule.conditions)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow must have conditions array' 
        });
      }
      
      if (!workflowRule.actions || !Array.isArray(workflowRule.actions)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Workflow must have actions array' 
        });
      }
      
      const success = workflowAutomationService.updateWorkflow(id, workflowRule);
      
      if (!success) {
        return res.status(404).json({ success: false, message: 'Workflow not found' });
      }
      
      res.json({ success: true, message: 'Workflow updated successfully' });
    } catch (error) {
      console.error('Error updating workflow:', error);
      res.status(500).json({ success: false, message: 'Error updating workflow' });
    }
  });

  // Delete workflow rule
  app.delete('/api/workflows/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const success = workflowAutomationService.deleteWorkflow(id);
      
      if (!success) {
        return res.status(404).json({ success: false, message: 'Workflow not found' });
      }
      
      res.json({ success: true, message: 'Workflow deleted successfully' });
    } catch (error) {
      console.error('Error deleting workflow:', error);
      res.status(500).json({ success: false, message: 'Error deleting workflow' });
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

  // Serve uploaded photos as static files with security headers
  app.use('/photos', (req, res, next) => {
    // Add security headers for image serving
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours cache
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    next();
  }, express.static(path.join(__dirname, '..', 'uploads', 'photos')));

  // Legacy API route compatibility
  app.use('/api/photos', (req, res, next) => {
    // Skip if this is an API endpoint (contains alphanumeric photoId)
    if (/^\/[a-zA-Z0-9-]+$/.test(req.path)) {
      return next();
    }
    // Redirect to new photos route for file serving
    res.redirect(`/photos${req.path}`);
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
        photoUrls.push(`/photos/${newFileName}`);
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
  // ENHANCED PHOTO MANAGEMENT API ENDPOINTS
  // ========================================

  // Enhanced photo upload with metadata and GPS
  app.post('/api/photos/upload', imageUpload.array('photos', 10), async (req: Request, res: Response) => {
    try {
      const uploadData = photoUploadSchema.parse(req.body);
      
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ success: false, message: 'No photos provided' });
      }

      const uploadedPhotos = [];
      const timestamp = Date.now();

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i] as Express.Multer.File;
        const fileExtension = path.extname(file.originalname);
        const newFileName = `${uploadData.jobId || uploadData.customerId || 'general'}_${uploadData.type}_${timestamp}_${i}${fileExtension}`;
        const newPath = path.join(photosDir, newFileName);
        
        // Move file to permanent location
        fs.renameSync(file.path, newPath);
        
        // Create photo record in database
        const photoData = {
          ...uploadData,
          url: `/photos/${newFileName}`,
          filename: newFileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
          capturedAt: new Date(),
          sequenceOrder: i,
          isPublic: true,  // Make photos public by default so they appear in listings
          isFeatured: false,  // Can be updated later
        };

        // Add GPS data if provided
        if (req.body.gpsLatitude && req.body.gpsLongitude) {
          photoData.gpsLatitude = parseFloat(req.body.gpsLatitude);
          photoData.gpsLongitude = parseFloat(req.body.gpsLongitude);
          photoData.gpsAccuracy = req.body.gpsAccuracy ? parseFloat(req.body.gpsAccuracy) : null;
          photoData.gpsAddress = req.body.gpsAddress || null;
        }

        const photo = await storage.createPhoto(photoData);
        uploadedPhotos.push(photo);
        console.log(`Created photo with ID: ${photo.id}, isPublic: ${photo.isPublic}, jobId: ${photo.jobId}`);
      }

      res.json({
        success: true,
        message: `Successfully uploaded ${uploadedPhotos.length} photos`,
        photos: uploadedPhotos
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
      
      console.error('Error uploading photos:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error uploading photos',
      });
    }
  });

  // Get public/featured photos (MUST come before :photoId route)
  app.get('/api/photos/public', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      
      const photos = await storage.getPublicPhotos(limit, offset);
      console.log(`Retrieved ${photos.length} public photos`);
      res.json({ success: true, photos });
    } catch (error) {
      console.error('Error retrieving public photos:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving public photos',
      });
    }
  });

  // Get featured photos
  app.get('/api/photos/featured', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const photos = await storage.getFeaturedPhotos(limit);
      console.log(`Retrieved ${photos.length} featured photos`);
      res.json({ success: true, photos });
    } catch (error) {
      console.error('Error retrieving featured photos:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving featured photos',
      });
    }
  });

  // Get photo by ID (MUST come after specific routes)
  app.get('/api/photos/:photoId', async (req: Request, res: Response) => {
    try {
      const { photoId } = req.params;
      const photo = await storage.getPhoto(photoId);
      
      if (!photo) {
        return res.status(404).json({ success: false, message: 'Photo not found' });
      }

      res.json({ success: true, photo });
    } catch (error) {
      console.error('Error retrieving photo:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving photo',
      });
    }
  });

  // Update photo metadata
  app.patch('/api/photos/:photoId', async (req: Request, res: Response) => {
    try {
      const { photoId } = req.params;
      const updates = updatePhotoSchema.parse(req.body);
      
      const photo = await storage.updatePhoto(photoId, updates);
      res.json({ success: true, photo });
    } catch (error) {
      console.error('Error updating photo:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error updating photo',
      });
    }
  });

  // Delete photo
  app.delete('/api/photos/:photoId', async (req: Request, res: Response) => {
    try {
      const { photoId } = req.params;
      const photo = await storage.getPhoto(photoId);
      
      if (!photo) {
        return res.status(404).json({ success: false, message: 'Photo not found' });
      }

      // Delete physical file
      try {
        const fileName = path.basename(photo.url);
        const filePath = path.join(photosDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileError) {
        console.warn('Could not delete physical file:', fileError);
      }

      await storage.deletePhoto(photoId);
      res.json({ success: true, message: 'Photo deleted successfully' });
    } catch (error) {
      console.error('Error deleting photo:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting photo',
      });
    }
  });

  // Get photos by job with filters
  app.get('/api/jobs/:jobId/photos/enhanced', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const { type, category } = req.query as { type?: string; category?: string };
      
      const photos = await storage.getPhotosByJob(jobId, { type, category });
      res.json({ success: true, photos });
    } catch (error) {
      console.error('Error retrieving job photos:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving job photos',
      });
    }
  });

  // Get customer photos
  app.get('/api/customers/:customerId/photos', async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const photos = await storage.getPhotosByCustomer(customerId);
      res.json({ success: true, photos });
    } catch (error) {
      console.error('Error retrieving customer photos:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving customer photos',
      });
    }
  });

  // Get before/after photo pairs
  app.get('/api/jobs/:jobId/before-after-pairs', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const pairs = await storage.getBeforeAfterPairs(jobId);
      res.json({ success: true, pairs });
    } catch (error) {
      console.error('Error retrieving before/after pairs:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving before/after pairs',
      });
    }
  });


  // Search photos with advanced filters
  app.post('/api/photos/search', async (req: Request, res: Response) => {
    try {
      const filters = photoSearchSchema.parse(req.body);
      const photos = await storage.searchPhotos(filters);
      res.json({ success: true, photos, filters });
    } catch (error) {
      console.error('Error searching photos:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error searching photos',
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

  // ========================================
  // EQUIPMENT CHECKOUT ROUTES (Must come before /api/equipment/:id)
  // ========================================

  // Get all equipment checkouts
  app.get('/api/equipment/checkouts', async (req: Request, res: Response) => {
    try {
      const { status, equipmentId } = req.query;
      
      let checkouts;
      if (status === 'overdue') {
        checkouts = await storage.getOverdueCheckouts();
      } else if (status === 'active') {
        checkouts = await storage.getActiveCheckouts();
      } else if (equipmentId) {
        checkouts = await storage.getCheckoutHistory(equipmentId as string);
      } else {
        checkouts = await storage.getCheckoutHistory();
      }

      res.json({
        success: true,
        data: checkouts
      });
    } catch (error) {
      console.error('Error fetching equipment checkouts:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching equipment checkouts'
      });
    }
  });

  // Check out equipment
  app.post('/api/equipment/checkout', async (req: Request, res: Response) => {
    try {
      const validatedData = insertEquipmentCheckoutSchema.parse(req.body);
      const checkout = await storage.checkoutEquipment(validatedData);
      res.json({
        success: true,
        data: checkout,
        message: 'Equipment checked out successfully'
      });
    } catch (error) {
      console.error('Error checking out equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking out equipment'
      });
    }
  });

  // Check in equipment
  app.put('/api/equipment/checkin/:checkoutId', async (req: Request, res: Response) => {
    try {
      const checkout = await storage.checkinEquipment(req.params.checkoutId, req.body);
      res.json({
        success: true,
        data: checkout,
        message: 'Equipment checked in successfully'
      });
    } catch (error) {
      console.error('Error checking in equipment:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking in equipment'
      });
    }
  });

  // Get maintenance records
  app.get('/api/equipment/:equipmentId/maintenance', async (req: Request, res: Response) => {
    try {
      const maintenance = await storage.getMaintenanceByEquipment(req.params.equipmentId);
      res.json({
        success: true,
        data: maintenance
      });
    } catch (error) {
      console.error('Error fetching maintenance records:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching maintenance records'
      });
    }
  });

  // Get all maintenance records  
  app.get('/api/equipment/maintenance', async (req: Request, res: Response) => {
    try {
      const maintenance = await storage.getAllMaintenanceRecords();
      res.json({
        success: true,
        data: maintenance
      });
    } catch (error) {
      console.error('Error fetching all maintenance records:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching maintenance records'
      });
    }
  });

  // Create maintenance record
  app.post('/api/equipment/maintenance', async (req: Request, res: Response) => {
    try {
      const validatedData = insertEquipmentMaintenanceSchema.parse(req.body);
      const maintenance = await storage.createEquipmentMaintenance(validatedData);
      res.json({
        success: true,
        data: maintenance,
        message: 'Maintenance record created successfully'
      });
    } catch (error) {
      console.error('Error creating maintenance record:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating maintenance record'
      });
    }
  });

  // Get single equipment item (Must come after specific routes)
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

  // ========================================
  // INVENTORY MANAGEMENT ROUTES
  // ========================================

  // Get all inventory items
  app.get('/api/inventory', async (req: Request, res: Response) => {
    try {
      const { category, lowStock } = req.query;
      
      let inventory;
      if (lowStock === 'true') {
        inventory = await storage.getLowStockItems();
      } else if (category) {
        inventory = await storage.getInventoryByCategory(category as string);
      } else {
        inventory = await storage.getAllInventory();
      }

      res.json({
        success: true,
        data: inventory
      });
    } catch (error) {
      console.error('Error fetching inventory:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching inventory'
      });
    }
  });

  // Create new inventory item
  app.post('/api/inventory', async (req: Request, res: Response) => {
    try {
      const validatedData = insertInventorySchema.parse(req.body);
      const item = await storage.createInventoryItem(validatedData);
      res.json({
        success: true,
        data: item,
        message: 'Inventory item created successfully'
      });
    } catch (error) {
      console.error('Error creating inventory item:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating inventory item'
      });
    }
  });

  // Update inventory item
  app.put('/api/inventory/:id', async (req: Request, res: Response) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      res.json({
        success: true,
        data: item,
        message: 'Inventory item updated successfully'
      });
    } catch (error) {
      console.error('Error updating inventory item:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating inventory item'
      });
    }
  });


  // ========================================
  // BUSINESS SETTINGS ROUTES
  // ========================================

  // Get business settings (with sensitive fields masked)
  app.get('/api/business-settings', async (req: Request, res: Response) => {
    try {
      const settings = await storage.getBusinessSettings();
      
      // Remove sensitive fields and add boolean indicators
      const { servicem8ApiKey, ...publicSettings } = settings;
      const safeSettings = {
        ...publicSettings,
        hasServicem8ApiKey: Boolean(servicem8ApiKey),
      };
      
      res.json({
        success: true,
        data: safeSettings
      });
    } catch (error) {
      console.error('Error fetching business settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching business settings'
      });
    }
  });

  // Update business settings
  app.put('/api/business-settings', async (req: Request, res: Response) => {
    try {
      const validatedData = updateBusinessSettingsSchema.parse(req.body);
      
      // Filter out sensitive fields that should not be updated with masked values
      const cleanData = { ...validatedData };
      if (cleanData.servicem8ApiKey === '••••••••' || cleanData.servicem8ApiKey === '') {
        delete cleanData.servicem8ApiKey; // Don't update with mask or empty
      }
      
      const settings = await storage.updateBusinessSettings(cleanData);
      
      // Remove sensitive fields and add boolean indicators
      const { servicem8ApiKey, ...publicSettings } = settings;
      const safeSettings = {
        ...publicSettings,
        hasServicem8ApiKey: Boolean(servicem8ApiKey),
      };
      
      res.json({
        success: true,
        data: safeSettings,
        message: 'Settings updated successfully'
      });
    } catch (error) {
      // Handle validation errors properly
      if (error instanceof Error && 'issues' in error) { // ZodError check
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: (error as any).issues
        });
        return;
      }
      
      console.error('Error updating business settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating business settings'
      });
    }
  });

  // Reset business settings to defaults
  app.post('/api/business-settings/reset', async (req: Request, res: Response) => {
    try {
      const settings = await storage.resetBusinessSettings();
      
      // Remove sensitive fields and add boolean indicators
      const { servicem8ApiKey, ...publicSettings } = settings;
      const safeSettings = {
        ...publicSettings,
        hasServicem8ApiKey: Boolean(servicem8ApiKey),
      };
      
      res.json({
        success: true,
        data: safeSettings,
        message: 'Settings reset to defaults successfully'
      });
    } catch (error) {
      console.error('Error resetting business settings:', error);
      res.status(500).json({
        success: false,
        message: 'Error resetting business settings'
      });
    }
  });

  // ========================================
  // COMMUNICATIONS API ENDPOINTS
  // ========================================

  // Get all communications with filtering
  app.get('/api/communications', async (req: Request, res: Response) => {
    try {
      const { platform, priority, isRead, isArchived, search, limit, offset } = req.query;
      
      const filters: any = {};
      if (platform) filters.platform = platform as string;
      if (priority) filters.priority = priority as string;
      if (isRead !== undefined) filters.isRead = isRead === 'true';
      if (isArchived !== undefined) filters.isArchived = isArchived === 'true';
      if (search) filters.search = search as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const communications = await storage.getAllCommunications(filters);
      res.json({ success: true, data: communications });
    } catch (error) {
      console.error('Error fetching communications:', error);
      res.status(500).json({ success: false, message: 'Error fetching communications' });
    }
  });

  // Get communication stats
  app.get('/api/communications/stats', async (req: Request, res: Response) => {
    try {
      const stats = await storage.getCommunicationStats();
      res.json({ success: true, data: stats });
    } catch (error) {
      console.error('Error fetching communication stats:', error);
      res.status(500).json({ success: false, message: 'Error fetching stats' });
    }
  });

  // Get specific communication
  app.get('/api/communications/:id', async (req: Request, res: Response) => {
    try {
      const communication = await storage.getCommunication(req.params.id);
      if (!communication) {
        return res.status(404).json({ success: false, message: 'Communication not found' });
      }
      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('Error fetching communication:', error);
      res.status(500).json({ success: false, message: 'Error fetching communication' });
    }
  });

  // Create new communication
  app.post('/api/communications', async (req: Request, res: Response) => {
    try {
      const validation = insertCommunicationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid communication data',
          errors: validation.error.errors 
        });
      }

      const communication = await storage.createCommunication(validation.data);
      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('Error creating communication:', error);
      res.status(500).json({ success: false, message: 'Error creating communication' });
    }
  });

  // Update communication
  app.patch('/api/communications/:id', async (req: Request, res: Response) => {
    try {
      const updates = updateCommunicationSchema.safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const communication = await storage.updateCommunication(req.params.id, updates.data);
      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('Error updating communication:', error);
      res.status(500).json({ success: false, message: 'Error updating communication' });
    }
  });

  // Mark communication as read
  app.patch('/api/communications/:id/read', async (req: Request, res: Response) => {
    try {
      const communication = await storage.markCommunicationAsRead(req.params.id);
      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('Error marking communication as read:', error);
      res.status(500).json({ success: false, message: 'Error updating communication' });
    }
  });

  // Star/unstar communication
  app.patch('/api/communications/:id/star', async (req: Request, res: Response) => {
    try {
      const { starred } = req.body;
      const communication = await storage.starCommunication(req.params.id, starred === true);
      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('Error starring communication:', error);
      res.status(500).json({ success: false, message: 'Error updating communication' });
    }
  });

  // Archive communication
  app.patch('/api/communications/:id/archive', async (req: Request, res: Response) => {
    try {
      const communication = await storage.archiveCommunication(req.params.id);
      res.json({ success: true, data: communication });
    } catch (error) {
      console.error('Error archiving communication:', error);
      res.status(500).json({ success: false, message: 'Error archiving communication' });
    }
  });

  // ========================================
  // CONVERSATION MANAGEMENT API ROUTES
  // ========================================

  // Get all conversations with filtering
  app.get('/api/conversations', async (req: Request, res: Response) => {
    try {
      const { status, priority, assignedTo, source, serviceType, search, limit, offset } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (priority) filters.priority = priority as string;
      if (assignedTo) filters.assignedTo = assignedTo as string;
      if (source) filters.source = source as string;
      if (serviceType) filters.serviceType = serviceType as string;
      if (search) filters.search = search as string;
      if (limit) filters.limit = parseInt(limit as string);
      if (offset) filters.offset = parseInt(offset as string);

      const conversations = await storage.getAllConversations(filters);
      res.json({ success: true, data: conversations });
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
  });

  // Get specific conversation
  app.get('/api/conversations/:id', async (req: Request, res: Response) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
      res.json({ success: true, data: conversation });
    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({ success: false, message: 'Error fetching conversation' });
    }
  });

  // Create new conversation
  app.post('/api/conversations', async (req: Request, res: Response) => {
    try {
      const validation = insertConversationSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid conversation data',
          errors: validation.error.errors 
        });
      }

      const conversation = await storage.createConversation(validation.data);
      res.json({ success: true, data: conversation });
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ success: false, message: 'Error creating conversation' });
    }
  });

  // Update conversation
  app.patch('/api/conversations/:id', async (req: Request, res: Response) => {
    try {
      const updates = updateConversationSchema.safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const conversation = await storage.updateConversation(req.params.id, updates.data);
      res.json({ success: true, data: conversation });
    } catch (error) {
      console.error('Error updating conversation:', error);
      res.status(500).json({ success: false, message: 'Error updating conversation' });
    }
  });

  // Delete conversation
  app.delete('/api/conversations/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteConversation(req.params.id);
      res.json({ success: true, message: 'Conversation deleted successfully' });
    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({ success: false, message: 'Error deleting conversation' });
    }
  });

  // Convert conversation to quote
  app.patch('/api/conversations/:id/convert', async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.body;
      if (!quoteId) {
        return res.status(400).json({ 
          success: false, 
          message: 'Quote ID is required for conversion' 
        });
      }

      const conversation = await storage.convertConversationToQuote(req.params.id, quoteId);
      res.json({ success: true, data: conversation });
    } catch (error) {
      console.error('Error converting conversation to quote:', error);
      res.status(500).json({ success: false, message: 'Error converting conversation' });
    }
  });

  // Get conversations by lead
  app.get('/api/conversations/lead/:leadId', async (req: Request, res: Response) => {
    try {
      const conversations = await storage.getConversationsByLead(req.params.leadId);
      res.json({ success: true, data: conversations });
    } catch (error) {
      console.error('Error fetching conversations by lead:', error);
      res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
  });

  // Get conversations by customer
  app.get('/api/conversations/customer/:customerId', async (req: Request, res: Response) => {
    try {
      const conversations = await storage.getConversationsByCustomer(req.params.customerId);
      res.json({ success: true, data: conversations });
    } catch (error) {
      console.error('Error fetching conversations by customer:', error);
      res.status(500).json({ success: false, message: 'Error fetching conversations' });
    }
  });

  // ========================================
  // CONVERSATION MESSAGE API ROUTES
  // ========================================

  // Get messages for a conversation
  app.get('/api/conversations/:conversationId/messages', async (req: Request, res: Response) => {
    try {
      const messages = await storage.getConversationMessages(req.params.conversationId);
      res.json({ success: true, data: messages });
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      res.status(500).json({ success: false, message: 'Error fetching messages' });
    }
  });

  // Create new message in conversation
  app.post('/api/conversations/:conversationId/messages', async (req: Request, res: Response) => {
    try {
      const messageData = { ...req.body, conversationId: req.params.conversationId };
      const validation = insertConversationMessageSchema.safeParse(messageData);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid message data',
          errors: validation.error.errors 
        });
      }

      const message = await storage.createConversationMessage(validation.data);
      res.json({ success: true, data: message });
    } catch (error) {
      console.error('Error creating conversation message:', error);
      res.status(500).json({ success: false, message: 'Error creating message' });
    }
  });

  // Get specific message
  app.get('/api/messages/:id', async (req: Request, res: Response) => {
    try {
      const message = await storage.getConversationMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }
      res.json({ success: true, data: message });
    } catch (error) {
      console.error('Error fetching message:', error);
      res.status(500).json({ success: false, message: 'Error fetching message' });
    }
  });

  // Update message
  app.patch('/api/messages/:id', async (req: Request, res: Response) => {
    try {
      const updates = updateConversationMessageSchema.safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const message = await storage.updateConversationMessage(req.params.id, updates.data);
      res.json({ success: true, data: message });
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json({ success: false, message: 'Error updating message' });
    }
  });

  // Delete message
  app.delete('/api/messages/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteConversationMessage(req.params.id);
      res.json({ success: true, message: 'Message deleted successfully' });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ success: false, message: 'Error deleting message' });
    }
  });

  // Mark conversation messages as read
  app.patch('/api/conversations/:conversationId/messages/read', async (req: Request, res: Response) => {
    try {
      const { beforeTimestamp } = req.body;
      const timestamp = beforeTimestamp ? new Date(beforeTimestamp) : undefined;
      await storage.markConversationMessagesAsRead(req.params.conversationId, timestamp);
      res.json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
      console.error('Error marking messages as read:', error);
      res.status(500).json({ success: false, message: 'Error marking messages as read' });
    }
  });

  // Get unread conversation count
  app.get('/api/conversations/unread-count', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.query;
      const count = await storage.getUnreadConversationCount(conversationId as string || undefined);
      res.json({ success: true, data: { unreadCount: count } });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ success: false, message: 'Error getting unread count' });
    }
  });

  // ========================================
  // CUSTOMER PORTAL API ROUTES  
  // ========================================

  // Customer authentication
  app.post('/api/customer-auth', async (req: Request, res: Response) => {
    try {
      console.log('Customer auth request received:', req.body);
      const { email, phone } = req.body;
      
      if (!email) {
        console.log('Authentication failed: Email is required');
        res.status(400).json({ success: false, message: 'Email is required' });
        return;
      }

      console.log(`Attempting authentication for email: ${email}, phone: ${phone}`);

      // Try to authenticate existing customer
      let customerAuth = await storage.authenticateCustomer(email, phone);
      console.log('Customer auth result:', customerAuth);
      
      if (!customerAuth) {
        console.log('No existing customer auth found, searching for customer by email');
        // Create new customer auth if doesn't exist
        // Find customer by email
        const customers = await storage.getAllCustomers();
        console.log('All customers:', customers.map(c => ({ id: c.id, email: c.email, phone: c.phone })));
        const customer = customers.find(c => c.email === email);
        console.log('Found customer:', customer);
        
        if (customer) {
          console.log('Creating new customer auth for existing customer');
          customerAuth = await storage.createCustomerAuth({
            customerId: customer.id,
            email: email,
            phone: phone || customer.phone || undefined
          });
        } else {
          console.log('Customer not found in database');
          res.status(404).json({ success: false, message: 'Customer not found' });
          return;
        }
      }

      // Get customer details
      const customer = await storage.getCustomer(customerAuth.customerId);
      console.log('Authentication successful for customer:', customer?.name);
      
      res.json({
        success: true,
        data: {
          customerAuth,
          customer
        }
      });
    } catch (error) {
      console.error('Error authenticating customer:', error);
      res.status(500).json({ success: false, message: 'Authentication failed' });
    }
  });

  // Get customer jobs
  app.get('/api/customer/:id/jobs', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getCustomerJobs(req.params.id);
      
      // Get photos for each job
      const jobsWithPhotos = await Promise.all(jobs.map(async (job) => {
        const photos = await storage.getCustomerPhotos(req.params.id, job.id);
        return { ...job, photos: photos.map(p => p.filename) };
      }));
      
      res.json({ success: true, data: jobsWithPhotos });
    } catch (error) {
      console.error('Error fetching customer jobs:', error);
      res.status(500).json({ success: false, message: 'Error fetching jobs' });
    }
  });

  // Get customer invoices  
  app.get('/api/customer/:id/invoices', async (req: Request, res: Response) => {
    try {
      const invoices = await storage.getCustomerInvoices(req.params.id);
      res.json({ success: true, data: invoices });
    } catch (error) {
      console.error('Error fetching customer invoices:', error);
      res.status(500).json({ success: false, message: 'Error fetching invoices' });
    }
  });

  // Get customer photos
  app.get('/api/customer/:id/photos', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.query;
      const photos = await storage.getCustomerPhotos(req.params.id, jobId as string);
      res.json({ success: true, data: photos });
    } catch (error) {
      console.error('Error fetching customer photos:', error);
      res.status(500).json({ success: false, message: 'Error fetching photos' });
    }
  });

  // Create service request
  app.post('/api/customer/:id/service-requests', async (req: Request, res: Response) => {
    try {
      console.log(`Creating service request for customer ${req.params.id}:`, req.body);
      
      const validationResult = insertServiceRequestSchema.safeParse({
        ...req.body,
        customerId: req.params.id
      });
      
      if (!validationResult.success) {
        console.log('Service request validation failed:', validationResult.error.issues);
        res.status(400).json({
          success: false,
          message: 'Invalid service request data',
          errors: validationResult.error.issues
        });
        return;
      }

      console.log('Creating service request with data:', validationResult.data);
      const serviceRequest = await storage.createServiceRequest(validationResult.data);
      console.log('Service request created successfully:', serviceRequest.id);

      // Trigger automated notifications for new service request
      AutomatedTriggers.onServiceRequestCreated(serviceRequest.id)
        .catch(error => console.error('Error triggering service request notification:', error));

      res.json({ success: true, data: serviceRequest });
    } catch (error) {
      console.error('Error creating service request:', error);
      res.status(500).json({ success: false, message: 'Error creating service request' });
    }
  });

  // Get customer service requests
  app.get('/api/customer/:id/service-requests', async (req: Request, res: Response) => {
    try {
      console.log(`Getting service requests for customer ${req.params.id}`);
      const serviceRequests = await storage.getServiceRequestsByCustomer(req.params.id);
      console.log(`Found ${serviceRequests.length} service requests for customer ${req.params.id}`);
      res.json({ success: true, data: serviceRequests });
    } catch (error) {
      console.error('Error fetching service requests:', error);
      res.status(500).json({ success: false, message: 'Error fetching service requests' });
    }
  });

  // ========================================
  // BUSINESS INTELLIGENCE & ANALYTICS API ROUTES
  // ========================================

  // Get executive dashboard statistics
  app.get('/api/analytics/dashboard', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      const customers = await storage.getAllCustomers();
      const quotes = await storage.getAllQuotes();
      const equipment = await storage.getAllEquipment();
      
      const dashboardStats = await businessIntelligenceService.calculateDashboardStats(
        jobs, customers, quotes, equipment
      );
      
      res.json({ success: true, data: dashboardStats });
    } catch (error) {
      console.error('Error generating dashboard analytics:', error);
      res.status(500).json({ success: false, message: 'Error generating dashboard analytics' });
    }
  });

  // Get comprehensive revenue analytics
  app.get('/api/analytics/revenue', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      const customers = await storage.getAllCustomers();
      
      const revenueAnalytics = await businessIntelligenceService.calculateRevenueAnalytics(jobs, customers);
      
      res.json({ success: true, data: revenueAnalytics });
    } catch (error) {
      console.error('Error generating revenue analytics:', error);
      res.status(500).json({ success: false, message: 'Error generating revenue analytics' });
    }
  });

  // Get operational analytics
  app.get('/api/analytics/operational', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      const equipment = await storage.getAllEquipment();
      const teams = await storage.getAllTeams();
      
      const operationalAnalytics = await businessIntelligenceService.calculateOperationalAnalytics(
        jobs, equipment, teams
      );
      
      res.json({ success: true, data: operationalAnalytics });
    } catch (error) {
      console.error('Error generating operational analytics:', error);
      res.status(500).json({ success: false, message: 'Error generating operational analytics' });
    }
  });

  // Get customer analytics
  app.get('/api/analytics/customers', async (req: Request, res: Response) => {
    try {
      const customers = await storage.getAllCustomers();
      const jobs = await storage.getAllJobs();
      const communications = await storage.getAllCommunications();
      
      const customerAnalytics = await businessIntelligenceService.calculateCustomerAnalytics(
        customers, jobs, communications
      );
      
      res.json({ success: true, data: customerAnalytics });
    } catch (error) {
      console.error('Error generating customer analytics:', error);
      res.status(500).json({ success: false, message: 'Error generating customer analytics' });
    }
  });

  // Get executive report (comprehensive business intelligence)
  app.get('/api/analytics/executive-report', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      const customers = await storage.getAllCustomers();
      const quotes = await storage.getAllQuotes();
      const equipment = await storage.getAllEquipment();
      
      const executiveReport = await businessIntelligenceService.generateExecutiveReport(
        jobs, customers, quotes, equipment
      );
      
      res.json({ success: true, data: executiveReport });
    } catch (error) {
      console.error('Error generating executive report:', error);
      res.status(500).json({ success: false, message: 'Error generating executive report' });
    }
  });

  // Generate custom analytics report
  app.post('/api/analytics/custom-report', async (req: Request, res: Response) => {
    try {
      const { reportType, configuration } = req.body;
      
      if (!reportType || !configuration) {
        return res.status(400).json({ 
          success: false, 
          message: 'Report type and configuration are required' 
        });
      }

      // Get all necessary data
      const jobs = await storage.getAllJobs();
      const customers = await storage.getAllCustomers();
      const quotes = await storage.getAllQuotes();
      const equipment = await storage.getAllEquipment();
      const communications = await storage.getAllCommunications();
      const teams = await storage.getAllTeams();

      const data = {
        jobs,
        customers, 
        quotes,
        equipment,
        communications,
        teams
      };

      const report = await businessIntelligenceService.generateReport(reportType, configuration, data);
      
      res.json({ success: true, data: report });
    } catch (error) {
      console.error('Error generating custom report:', error);
      res.status(500).json({ success: false, message: 'Error generating custom report' });
    }
  });

  // Get KPI metrics and performance indicators
  app.get('/api/analytics/kpis', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      const customers = await storage.getAllCustomers();
      const quotes = await storage.getAllQuotes();
      const equipment = await storage.getAllEquipment();
      
      const executiveData = await businessIntelligenceService.generateExecutiveReport(
        jobs, customers, quotes, equipment
      );

      // Transform executive data into KPI format
      const kpis = [
        {
          id: 'total-revenue',
          name: 'Total Revenue',
          value: executiveData.totalRevenue,
          unit: 'currency',
          trend: executiveData.revenueGrowth > 0 ? 'up' : 'down',
          trendValue: Math.abs(executiveData.revenueGrowth),
          category: 'financial'
        },
        {
          id: 'customer-acquisition-cost',
          name: 'Customer Acquisition Cost',
          value: executiveData.customerAcquisitionCost,
          unit: 'currency', 
          trend: 'neutral',
          trendValue: 0,
          category: 'customer'
        },
        {
          id: 'conversion-rate',
          name: 'Quote Conversion Rate',
          value: executiveData.quotesToJobConversionRate,
          unit: 'percentage',
          trend: 'up',
          trendValue: 2.3,
          category: 'operational'
        },
        {
          id: 'equipment-utilization',
          name: 'Equipment Utilization',
          value: executiveData.equipmentUtilizationRate,
          unit: 'percentage',
          trend: 'up',
          trendValue: 5.2,
          category: 'operational'
        },
        {
          id: 'customer-satisfaction',
          name: 'Customer Satisfaction',
          value: executiveData.customerSatisfactionScore,
          unit: 'rating',
          trend: 'up',
          trendValue: 0.2,
          category: 'customer'
        },
        {
          id: 'profit-margin',
          name: 'Profit Margin',
          value: executiveData.profitMargin,
          unit: 'percentage',
          trend: 'up',
          trendValue: 1.5,
          category: 'financial'
        }
      ];
      
      res.json({ success: true, data: kpis });
    } catch (error) {
      console.error('Error generating KPI metrics:', error);
      res.status(500).json({ success: false, message: 'Error generating KPI metrics' });
    }
  });

  // Export analytics data as CSV
  app.get('/api/analytics/export/:type', async (req: Request, res: Response) => {
    try {
      const { type } = req.params;
      const { format = 'csv' } = req.query;

      let data: any;
      let filename: string;

      switch (type) {
        case 'dashboard':
          const jobs = await storage.getAllJobs();
          const customers = await storage.getAllCustomers();
          const quotes = await storage.getAllQuotes();
          const equipment = await storage.getAllEquipment();
          data = await businessIntelligenceService.calculateDashboardStats(jobs, customers, quotes, equipment);
          filename = `dashboard_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
          
        case 'revenue':
          const revenueJobs = await storage.getAllJobs();
          const revenueCustomers = await storage.getAllCustomers();
          data = await businessIntelligenceService.calculateRevenueAnalytics(revenueJobs, revenueCustomers);
          filename = `revenue_export_${new Date().toISOString().split('T')[0]}.csv`;
          break;
          
        default:
          return res.status(400).json({ success: false, message: 'Invalid export type' });
      }

      if (format === 'csv') {
        // Convert data to CSV format
        const csv = Object.entries(data)
          .map(([key, value]) => `${key},${value}`)
          .join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(`Metric,Value\n${csv}`);
      } else {
        res.json({ success: true, data, filename });
      }
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      res.status(500).json({ success: false, message: 'Error exporting analytics data' });
    }
  });

  // ========================================
  // WEATHER INTEGRATION API ENDPOINTS
  // ========================================

  // Get current weather conditions
  app.get('/api/weather/current', async (req: Request, res: Response) => {
    try {
      const { location } = req.query;
      const weather = await weatherService.getCurrentWeather(location as string);
      res.json({ success: true, data: weather });
    } catch (error) {
      console.error('Error fetching current weather:', error);
      res.status(500).json({ success: false, message: 'Error fetching current weather' });
    }
  });

  // Get weather-based work safety recommendations
  app.get('/api/weather/safety-recommendation', async (req: Request, res: Response) => {
    try {
      const { location } = req.query;
      const weather = await weatherService.getCurrentWeather(location as string);
      const recommendation = weatherService.getWorkSafetyRecommendation(weather);
      
      res.json({ 
        success: true, 
        data: {
          weather,
          recommendation
        }
      });
    } catch (error) {
      console.error('Error generating weather safety recommendation:', error);
      res.status(500).json({ success: false, message: 'Error generating weather safety recommendation' });
    }
  });

  // Get weather forecast for job planning
  app.get('/api/weather/forecast', async (req: Request, res: Response) => {
    try {
      const { location, days = 7 } = req.query;
      const weather = await weatherService.getCurrentWeather(location as string);
      
      // Extract forecast for requested number of days
      const forecast = weather.forecast.slice(0, Number(days));
      
      res.json({ 
        success: true, 
        data: {
          location: weather.location,
          forecast,
          lastUpdated: weather.lastUpdated
        }
      });
    } catch (error) {
      console.error('Error fetching weather forecast:', error);
      res.status(500).json({ success: false, message: 'Error fetching weather forecast' });
    }
  });

  // ========================================
  // SAFETY INCIDENT MANAGEMENT ROUTES
  // ========================================

  // Get all safety incidents
  app.get('/api/safety-incidents', async (req: Request, res: Response) => {
    try {
      const incidents = await storage.getSafetyIncidents();
      res.json({
        success: true,
        data: incidents,
        count: incidents.length,
        message: 'Safety incidents retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting safety incidents:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving safety incidents'
      });
    }
  });

  // Create a new safety incident
  app.post('/api/safety-incidents', async (req: Request, res: Response) => {
    try {
      const validatedData = safetyIncidentInsertSchema.parse(req.body);
      
      // Generate incident number
      const incidents = await storage.getSafetyIncidents();
      const incidentNumber = `INC-${new Date().getFullYear()}-${String(incidents.length + 1).padStart(3, '0')}`;
      
      const incidentData = {
        ...validatedData,
        incidentNumber,
      };

      const incident = await storage.createSafetyIncident(incidentData);
      res.status(201).json({
        success: true,
        data: incident,
        message: 'Safety incident created successfully'
      });
    } catch (error: any) {
      console.error('Error creating safety incident:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid incident data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating safety incident'
      });
    }
  });

  // Update safety incident
  app.put('/api/safety-incidents/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingIncident = await storage.getSafetyIncident(id);
      if (!existingIncident) {
        return res.status(404).json({
          success: false,
          message: 'Safety incident not found'
        });
      }

      const updatedIncident = await storage.updateSafetyIncident(id, updateData);
      res.json({
        success: true,
        data: updatedIncident,
        message: 'Safety incident updated successfully'
      });
    } catch (error) {
      console.error('Error updating safety incident:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating safety incident'
      });
    }
  });

  // Get safety analytics
  app.get('/api/safety-analytics', async (req: Request, res: Response) => {
    try {
      const incidents = await storage.getSafetyIncidents();
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const analytics = {
        totalIncidents: incidents.length,
        openIncidents: incidents.filter(i => i.status === 'reported' || i.status === 'investigating').length,
        highSeverityIncidents: incidents.filter(i => i.severity === 'high' || i.severity === 'critical').length,
        recentIncidents: incidents.filter(i => new Date(i.reportedAt) >= thirtyDaysAgo).length,
        incidentsByType: incidents.reduce((acc: any, incident) => {
          acc[incident.type] = (acc[incident.type] || 0) + 1;
          return acc;
        }, {}),
        incidentsBySeverity: incidents.reduce((acc: any, incident) => {
          acc[incident.severity] = (acc[incident.severity] || 0) + 1;
          return acc;
        }, {}),
        costImpact: incidents.reduce((total, incident) => total + (parseFloat(incident.cost || '0')), 0),
      };

      res.json({
        success: true,
        data: analytics,
        message: 'Safety analytics retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting safety analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving safety analytics'
      });
    }
  });

  // ========================================
  // RISK ASSESSMENT MANAGEMENT ROUTES  
  // ========================================

  // Get all risk assessments
  app.get('/api/risk-assessments', async (req: Request, res: Response) => {
    try {
      const assessments = await storage.getAllRiskAssessments();
      res.json({
        success: true,
        data: assessments,
        count: assessments.length,
        message: 'Risk assessments retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting risk assessments:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving risk assessments'
      });
    }
  });

  // Get risk assessments by job
  app.get('/api/risk-assessments/job/:jobId', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      const assessments = await storage.getRiskAssessmentsByJob(jobId);
      res.json({
        success: true,
        data: assessments,
        count: assessments.length,
        message: 'Job risk assessments retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting job risk assessments:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving job risk assessments'
      });
    }
  });

  // Create a new risk assessment
  app.post('/api/risk-assessments', async (req: Request, res: Response) => {
    try {
      const validatedData = riskAssessmentInsertSchema.parse(req.body);
      
      const assessment = await storage.createRiskAssessment(validatedData);
      res.status(201).json({
        success: true,
        data: assessment,
        message: 'Risk assessment created successfully'
      });
    } catch (error: any) {
      console.error('Error creating risk assessment:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid assessment data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating risk assessment'
      });
    }
  });

  // Update risk assessment
  app.put('/api/risk-assessments/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const existingAssessment = await storage.getRiskAssessment(id);
      if (!existingAssessment) {
        return res.status(404).json({
          success: false,
          message: 'Risk assessment not found'
        });
      }

      const updatedAssessment = await storage.updateRiskAssessment(id, updateData);
      res.json({
        success: true,
        data: updatedAssessment,
        message: 'Risk assessment updated successfully'
      });
    } catch (error) {
      console.error('Error updating risk assessment:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating risk assessment'
      });
    }
  });

  // ========================================
  // COMPLIANCE MONITORING ROUTES  
  // ========================================

  // Get all compliance requirements
  app.get('/api/compliance/requirements', async (req: Request, res: Response) => {
    try {
      const requirements = await storage.getAllComplianceRequirements();
      res.json({
        success: true,
        data: requirements,
        count: requirements.length,
        message: 'Compliance requirements retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting compliance requirements:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving compliance requirements'
      });
    }
  });

  // Create compliance requirement
  app.post('/api/compliance/requirements', async (req: Request, res: Response) => {
    try {
      // Convert date strings to Date objects before validation
      const processedBody = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        nextDue: req.body.nextDue ? new Date(req.body.nextDue) : undefined,
      };
      
      const validatedData = complianceRequirementInsertSchema.parse(processedBody);
      
      const requirement = await storage.createComplianceRequirement(validatedData);
      res.status(201).json({
        success: true,
        data: requirement,
        message: 'Compliance requirement created successfully'
      });
    } catch (error: any) {
      console.error('Error creating compliance requirement:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid requirement data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating compliance requirement'
      });
    }
  });

  // Update compliance requirement
  app.put('/api/compliance/requirements/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Convert date strings to Date objects and validate
      const processedBody = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        nextDue: req.body.nextDue ? new Date(req.body.nextDue) : undefined,
      };
      
      const validatedData = complianceRequirementInsertSchema.partial().parse(processedBody);

      const requirement = await storage.updateComplianceRequirement(id, validatedData);
      res.json({
        success: true,
        data: requirement,
        message: 'Compliance requirement updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating compliance requirement:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid requirement data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating compliance requirement'
      });
    }
  });

  // Get compliance analytics
  app.get('/api/compliance/analytics', async (req: Request, res: Response) => {
    try {
      const analytics = await storage.getComplianceAnalytics();
      res.json({
        success: true,
        data: analytics,
        message: 'Compliance analytics retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting compliance analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving compliance analytics'
      });
    }
  });

  // Get compliance records
  app.get('/api/compliance/records', async (req: Request, res: Response) => {
    try {
      const records = await storage.getAllComplianceRecords();
      res.json({
        success: true,
        data: records,
        count: records.length,
        message: 'Compliance records retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting compliance records:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving compliance records'
      });
    }
  });

  // Create compliance record
  app.post('/api/compliance/records', async (req: Request, res: Response) => {
    try {
      const validatedData = complianceRecordInsertSchema.parse(req.body);
      
      const record = await storage.createComplianceRecord(validatedData);
      res.status(201).json({
        success: true,
        data: record,
        message: 'Compliance record created successfully'
      });
    } catch (error: any) {
      console.error('Error creating compliance record:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid record data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating compliance record'
      });
    }
  });

  // Get compliance dashboard analytics
  app.get('/api/compliance/analytics', async (req: Request, res: Response) => {
    try {
      const requirements = await storage.getAllComplianceRequirements();
      const records = await storage.getAllComplianceRecords();

      const now = new Date();
      const overdueRequirements = requirements.filter(r => new Date(r.nextDue) < now && r.status !== 'completed');
      const upcomingRequirements = requirements.filter(r => {
        const dueDate = new Date(r.nextDue);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysUntilDue <= 30 && daysUntilDue > 0 && r.status !== 'completed';
      });

      const analytics = {
        totalRequirements: requirements.length,
        pendingRequirements: requirements.filter(r => r.status === 'pending').length,
        overdueRequirements: overdueRequirements.length,
        upcomingRequirements: upcomingRequirements.length,
        completedThisMonth: records.filter(r => {
          const completedDate = new Date(r.completedAt);
          return completedDate.getMonth() === now.getMonth() && 
                 completedDate.getFullYear() === now.getFullYear();
        }).length,
        averageComplianceScore: requirements.filter(r => r.complianceScore).length > 0 
          ? Math.round(requirements.filter(r => r.complianceScore).reduce((sum, r) => sum + (r.complianceScore || 0), 0) / requirements.filter(r => r.complianceScore).length)
          : 0,
        requirementsByCategory: requirements.reduce((acc: any, req) => {
          acc[req.category] = (acc[req.category] || 0) + 1;
          return acc;
        }, {}),
        requirementsByStatus: requirements.reduce((acc: any, req) => {
          acc[req.status] = (acc[req.status] || 0) + 1;
          return acc;
        }, {}),
      };

      res.json({
        success: true,
        data: analytics,
        message: 'Compliance analytics retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting compliance analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving compliance analytics'
      });
    }
  });

  // ========================================
  // PROPOSAL MANAGEMENT ROUTES
  // ========================================

  // Get all proposals
  app.get('/api/proposals', async (req: Request, res: Response) => {
    try {
      const { customerId, quoteId } = req.query;
      
      let proposals;
      if (customerId) {
        proposals = await storage.getProposalsByCustomer(customerId as string);
      } else if (quoteId) {
        proposals = await storage.getProposalsByQuote(quoteId as string);
      } else {
        proposals = await storage.getAllProposals();
      }

      res.json({
        success: true,
        data: proposals,
        count: proposals.length,
        message: 'Proposals retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching proposals:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching proposals'
      });
    }
  });

  // Get single proposal
  app.get('/api/proposals/:id', async (req: Request, res: Response) => {
    try {
      const proposal = await storage.getProposal(req.params.id);
      if (!proposal) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found'
        });
      }
      
      // Also get proposal sections
      const sections = await storage.getProposalSectionsByProposal(proposal.id);
      
      res.json({
        success: true,
        data: { ...proposal, sections }
      });
    } catch (error) {
      console.error('Error fetching proposal:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching proposal'
      });
    }
  });

  // Create new proposal
  app.post('/api/proposals', async (req: Request, res: Response) => {
    try {
      // Auto-generate proposalNumber if not provided
      const proposalData = {
        ...req.body,
        proposalNumber: req.body.proposalNumber || `PROP-${Date.now()}`,
      };
      
      const validatedData = insertProposalSchema.parse(proposalData);
      const proposal = await storage.createProposal(validatedData);
      
      res.status(201).json({
        success: true,
        data: proposal,
        message: 'Proposal created successfully'
      });
    } catch (error: any) {
      console.error('Error creating proposal:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating proposal'
      });
    }
  });

  // Update proposal
  app.put('/api/proposals/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateProposalSchema.parse(req.body);
      const proposal = await storage.updateProposal(req.params.id, validatedData);
      
      res.json({
        success: true,
        data: proposal,
        message: 'Proposal updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating proposal:', error);
      
      if (error.message === 'Proposal not found') {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found'
        });
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid proposal data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating proposal'
      });
    }
  });

  // Delete proposal
  app.delete('/api/proposals/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteProposal(req.params.id);
      res.json({
        success: true,
        message: 'Proposal deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting proposal:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting proposal'
      });
    }
  });

  // Get proposal sections
  app.get('/api/proposals/:proposalId/sections', async (req: Request, res: Response) => {
    try {
      const sections = await storage.getProposalSectionsByProposal(req.params.proposalId);
      res.json({
        success: true,
        data: sections,
        count: sections.length
      });
    } catch (error) {
      console.error('Error fetching proposal sections:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching proposal sections'
      });
    }
  });

  // Create proposal section
  app.post('/api/proposals/:proposalId/sections', async (req: Request, res: Response) => {
    try {
      const sectionData = {
        ...req.body,
        proposalId: req.params.proposalId
      };
      
      const validatedData = insertProposalSectionSchema.parse(sectionData);
      const section = await storage.createProposalSection(validatedData);
      
      res.status(201).json({
        success: true,
        data: section,
        message: 'Proposal section created successfully'
      });
    } catch (error: any) {
      console.error('Error creating proposal section:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid section data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating proposal section'
      });
    }
  });

  // Update proposal section
  app.put('/api/proposals/sections/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateProposalSectionSchema.parse(req.body);
      const section = await storage.updateProposalSection(req.params.id, validatedData);
      
      res.json({
        success: true,
        data: section,
        message: 'Proposal section updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating proposal section:', error);
      
      if (error.message === 'Proposal section not found') {
        return res.status(404).json({
          success: false,
          message: 'Proposal section not found'
        });
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid section data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating proposal section'
      });
    }
  });

  // Delete proposal section
  app.delete('/api/proposals/sections/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteProposalSection(req.params.id);
      res.json({
        success: true,
        message: 'Proposal section deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting proposal section:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting proposal section'
      });
    }
  });

  // Reorder proposal sections
  app.put('/api/proposals/:proposalId/sections/reorder', async (req: Request, res: Response) => {
    try {
      const { sectionIds } = req.body;
      
      if (!Array.isArray(sectionIds)) {
        return res.status(400).json({
          success: false,
          message: 'sectionIds must be an array'
        });
      }
      
      const sections = await storage.reorderProposalSections(req.params.proposalId, sectionIds);
      
      res.json({
        success: true,
        data: sections,
        message: 'Proposal sections reordered successfully'
      });
    } catch (error) {
      console.error('Error reordering proposal sections:', error);
      res.status(500).json({
        success: false,
        message: 'Error reordering proposal sections'
      });
    }
  });

  // ========================================
  // PROPOSAL LINE ITEM MANAGEMENT ROUTES
  // ========================================

  // Get proposal line items
  app.get('/api/proposals/:proposalId/lineitems', async (req: Request, res: Response) => {
    try {
      const lineItems = await storage.getProposalLineItemsByProposal(req.params.proposalId);
      res.json({
        success: true,
        data: lineItems,
        count: lineItems.length
      });
    } catch (error) {
      console.error('Error fetching proposal line items:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching proposal line items'
      });
    }
  });

  // Create proposal line item
  app.post('/api/proposals/:proposalId/lineitems', async (req: Request, res: Response) => {
    try {
      const itemData = {
        ...req.body,
        proposalId: req.params.proposalId
      };
      
      // Ensure totalPrice is computed server-side
      const quantity = parseFloat(itemData.quantity || '1');
      const unitPrice = parseFloat(itemData.unitPrice || '0');
      itemData.totalPrice = (quantity * unitPrice).toString();
      
      const validatedData = insertProposalLineItemSchema.parse(itemData);
      const lineItem = await storage.createProposalLineItem(validatedData);
      
      res.status(201).json({
        success: true,
        data: lineItem,
        message: 'Proposal line item created successfully'
      });
    } catch (error: any) {
      console.error('Error creating proposal line item:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid line item data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating proposal line item'
      });
    }
  });

  // Update proposal line item
  app.put('/api/proposals/lineitems/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateProposalLineItemSchema.parse(req.body);
      const lineItem = await storage.updateProposalLineItem(req.params.id, validatedData);
      
      res.json({
        success: true,
        data: lineItem,
        message: 'Proposal line item updated successfully'
      });
    } catch (error: any) {
      console.error('Error updating proposal line item:', error);
      
      if (error.message === 'Proposal line item not found') {
        return res.status(404).json({
          success: false,
          message: 'Proposal line item not found'
        });
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid line item data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating proposal line item'
      });
    }
  });

  // Delete proposal line item
  app.delete('/api/proposals/lineitems/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteProposalLineItem(req.params.id);
      res.json({
        success: true,
        message: 'Proposal line item deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting proposal line item:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting proposal line item'
      });
    }
  });

  // Reorder proposal line items
  app.put('/api/proposals/:proposalId/lineitems/reorder', async (req: Request, res: Response) => {
    try {
      const { itemIds } = req.body;
      
      if (!Array.isArray(itemIds)) {
        return res.status(400).json({
          success: false,
          message: 'itemIds must be an array'
        });
      }
      
      const lineItems = await storage.reorderProposalLineItems(req.params.proposalId, itemIds);
      
      res.json({
        success: true,
        data: lineItems,
        message: 'Proposal line items reordered successfully'
      });
    } catch (error) {
      console.error('Error reordering proposal line items:', error);
      res.status(500).json({
        success: false,
        message: 'Error reordering proposal line items'
      });
    }
  });

  // ========================================
  // PROPOSAL LINE ITEM CHOICE MANAGEMENT ROUTES
  // ========================================

  // Get choices for a line item
  app.get('/api/proposals/lineitems/:lineItemId/choices', async (req: Request, res: Response) => {
    try {
      const choices = await storage.getProposalLineItemChoicesByLineItem(req.params.lineItemId);
      res.json({
        success: true,
        data: choices,
        count: choices.length,
        message: 'Line item choices retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching line item choices:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching line item choices'
      });
    }
  });

  // Create choice for a line item
  app.post('/api/proposals/lineitems/:lineItemId/choices', async (req: Request, res: Response) => {
    try {
      const choiceData = {
        ...req.body,
        lineItemId: req.params.lineItemId
      };

      const validatedData = insertProposalLineItemChoiceSchema.parse(choiceData);
      const choice = await storage.createProposalLineItemChoice(validatedData);

      res.status(201).json({
        success: true,
        data: choice,
        message: 'Line item choice created successfully'
      });
    } catch (error) {
      console.error('Error creating line item choice:', error);
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid choice data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error creating line item choice'
      });
    }
  });

  // Update line item choice
  app.put('/api/proposals/lineitems/choices/:choiceId', async (req: Request, res: Response) => {
    try {
      const validatedData = updateProposalLineItemChoiceSchema.parse(req.body);
      const choice = await storage.updateProposalLineItemChoice(req.params.choiceId, validatedData);

      res.json({
        success: true,
        data: choice,
        message: 'Line item choice updated successfully'
      });
    } catch (error) {
      console.error('Error updating line item choice:', error);
      
      if (error.message === 'Proposal line item choice not found') {
        return res.status(404).json({
          success: false,
          message: 'Line item choice not found'
        });
      }
      
      if (error.name === 'ZodError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid choice data',
          errors: error.errors
        });
      }
      
      res.status(500).json({
        success: false,
        message: 'Error updating line item choice'
      });
    }
  });

  // Delete line item choice
  app.delete('/api/proposals/lineitems/choices/:choiceId', async (req: Request, res: Response) => {
    try {
      await storage.deleteProposalLineItemChoice(req.params.choiceId);
      res.json({
        success: true,
        message: 'Line item choice deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting line item choice:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting line item choice'
      });
    }
  });

  // Delete all choices for a line item
  app.delete('/api/proposals/lineitems/:lineItemId/choices', async (req: Request, res: Response) => {
    try {
      await storage.deleteProposalLineItemChoicesByLineItem(req.params.lineItemId);
      res.json({
        success: true,
        message: 'All line item choices deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting line item choices:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting line item choices'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
