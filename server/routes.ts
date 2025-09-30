import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { fileURLToPath } from 'url';
import { z } from "zod";

// Extend Express Session to include employeeId
declare module 'express-session' {
  interface SessionData {
    employeeId?: string;
  }
}
import { storage } from "./storage";
import { sendContactEmail } from "./email";
import * as schema from "@shared/schema";
import { 
  leadSourceSchema, contactFormSchema, type InsertLeadSubmission, type LeadSource,
  insertCustomerSchema, insertLeadSchema, insertCallSchema, insertQuoteSchema,
  insertJobSchema, insertJobDiaryEntrySchema, insertActivitySchema, insertReviewSchema, insertCampaignSchema,
  insertSocialPlanSchema, insertCompetitorSignalSchema, insertPriceRuleSchema,
  insertNotificationSchema, updateNotificationSchema,
  insertEmployeeSchema, updateEmployeeSchema,
  insertScheduleEventSchema, updateScheduleEventSchema,
  insertJobTemplateSchema, updateJobTemplateSchema,
  insertEmailTemplateSchema, updateEmailTemplateSchema,
  insertSmsTemplateSchema, updateSmsTemplateSchema,
  insertEquipmentSchema, updateEquipmentSchema,
  insertInventorySchema, insertEquipmentCheckoutSchema, insertEquipmentMaintenanceSchema,
  insertBusinessSettingsSchema, updateBusinessSettingsSchema,
  insertCommunicationSchema, updateCommunicationSchema,
  insertPhotoSchema, updatePhotoSchema, photoUploadSchema, photoSearchSchema, gpsLocationSchema,
  insertInvoiceSchema, insertServiceRequestSchema, insertCustomerAuthSchema,
  insertCommunicationPreferencesSchema,
  safetyIncidentInsertSchema, type InsertSafetyIncident,
  riskAssessmentInsertSchema, type InsertRiskAssessment,
  complianceRequirementInsertSchema, type InsertComplianceRequirement,
  complianceRecordInsertSchema, type InsertComplianceRecord,
  // Proposal Management
  insertProposalSchema, updateProposalSchema,
  insertProposalSectionSchema, updateProposalSectionSchema,
  insertProposalLineItemSchema, updateProposalLineItemSchema,
  insertProposalLineItemChoiceSchema, updateProposalLineItemChoiceSchema,
  // Document Template Management
  insertDocumentTemplateSchema
} from "@shared/schema";
import multer from "multer";
import Papa from "papaparse";
import path from "path";
import bcrypt from "bcrypt";

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
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
import fs from "fs";
import { format } from "date-fns";
import { AutomatedTriggers } from "./services/automatedTriggers";
import { workflowAutomationService } from "./services/workflowAutomation";
import { businessIntelligenceService } from "./services/businessIntelligence";
import { weatherService } from "./services/weatherService";
import { smsService } from "./services/smsService";
import { emailService } from "./services/emailService";

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

// ========================================
// BUSINESS HOURS NOTIFICATION HELPERS
// ========================================

// Check if current time is within business hours (7am-4pm Mon-Fri, NZ time)
function isWithinBusinessHours(): boolean {
  const now = new Date();
  const nzTime = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));
  
  const day = nzTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const hour = nzTime.getHours();
  
  // Check if it's Monday-Friday (1-5) and between 7am-4pm
  return day >= 1 && day <= 5 && hour >= 7 && hour < 16;
}

// Queue or send schedule notification based on business hours
async function queueScheduleNotification(employee: any, job: any, assignment: any): Promise<void> {
  const now = new Date();
  
  // Check if we're within business hours
  if (isWithinBusinessHours()) {
    // Send immediately
    await sendScheduleNotification(employee, job, assignment);
  } else {
    // Calculate next business day 7am
    const nextSendTime = getNextBusinessHourTime();
    
    // Log that notification is queued
    console.log(`[Notification Queue] Schedule notification for ${employee.firstName} ${employee.lastName} queued until ${nextSendTime.toISOString()}`);
    
    // In a production system, you would store this in a queue or database
    // For now, we'll just log it and send immediately in development
    // In production, you'd use a job queue like Bull or Redis
    await sendScheduleNotification(employee, job, assignment);
  }
}

// Get next business hour time (next weekday at 7am)
function getNextBusinessHourTime(): Date {
  const now = new Date();
  const nzTime = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' }));
  
  let nextTime = new Date(nzTime);
  nextTime.setHours(7, 0, 0, 0);
  
  // If it's already past 7am today, move to tomorrow
  if (nzTime.getHours() >= 7) {
    nextTime.setDate(nextTime.getDate() + 1);
  }
  
  // Skip weekends
  while (nextTime.getDay() === 0 || nextTime.getDay() === 6) {
    nextTime.setDate(nextTime.getDate() + 1);
  }
  
  return nextTime;
}

// Send schedule notification via email/SMS
async function sendScheduleNotification(employee: any, job: any, assignment: any): Promise<void> {
  try {
    const startTime = new Date(assignment.startTime).toLocaleString('en-NZ', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: 'Pacific/Auckland'
    });
    
    const endTime = new Date(assignment.endTime).toLocaleTimeString('en-NZ', {
      timeStyle: 'short',
      timeZone: 'Pacific/Auckland'
    });

    // Send email notification
    if (employee.email) {
      await emailService.sendEmail({
        to: employee.email,
        subject: `Job Scheduled: ${job?.title || 'Tree Service'}`,
        html: `
          <h2>You've been scheduled for a job</h2>
          <p>Hi ${employee.firstName},</p>
          <p>You've been assigned to the following job:</p>
          <ul>
            <li><strong>Job:</strong> ${job?.title || 'Tree Service'}</li>
            <li><strong>Location:</strong> ${job?.address || 'Address TBD'}</li>
            <li><strong>Date & Time:</strong> ${startTime} - ${endTime}</li>
            ${assignment.role ? `<li><strong>Role:</strong> ${assignment.role}</li>` : ''}
            ${assignment.notes ? `<li><strong>Notes:</strong> ${assignment.notes}</li>` : ''}
          </ul>
          <p>Please confirm your availability as soon as possible.</p>
          <p>Thanks,<br>Treemarkables Team</p>
        `,
        text: `Hi ${employee.firstName},\n\nYou've been assigned to: ${job?.title || 'Tree Service'}\nLocation: ${job?.address || 'Address TBD'}\nDate & Time: ${startTime} - ${endTime}\n\nPlease confirm your availability.`
      });
    }

    // Send SMS notification if phone number exists
    if (employee.phone) {
      const smsMessage = `Treemarkables: You're scheduled for ${job?.title || 'a job'} on ${startTime} at ${job?.address || 'TBD'}. Reply to confirm.`;
      await smsService.sendSMS(employee.phone, smsMessage);
    }

    console.log(`[Notification] Schedule notification sent to ${employee.firstName} ${employee.lastName}`);
  } catch (error) {
    console.error('Error sending schedule notification:', error);
  }
}

// ========================================
// AUTHORIZATION MIDDLEWARE
// ========================================

// Middleware to require admin role for protected endpoints
async function requireAdmin(req: Request, res: Response, next: express.NextFunction): Promise<void> {
  try {
    const employeeId = req.session.employeeId;
    
    if (!employeeId) {
      res.status(403).json({ 
        success: false, 
        message: 'Admin access required. Please log in.' 
      });
      return;
    }
    
    const employee = await storage.getEmployee(employeeId);
    
    if (!employee || employee.role !== 'admin') {
      res.status(403).json({ 
        success: false, 
        message: 'Admin access required' 
      });
      return;
    }
    
    next();
  } catch (error) {
    console.error('Error in requireAdmin middleware:', error);
    res.status(403).json({ 
      success: false, 
      message: 'Admin access required' 
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ========================================
  // AUTHENTICATION ENDPOINTS
  // ========================================

  // POST /api/auth/login - Create server-side session with employee ID or email+password
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { employeeId, email, password } = req.body;
      let employee;

      // Email+password authentication
      if (email && password) {
        // Find employee by email
        employee = await storage.getEmployeeByEmail(email);

        if (!employee) {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }

        // Verify password if it exists
        if (!employee.password) {
          return res.status(401).json({
            success: false,
            message: 'Password authentication not configured for this account'
          });
        }

        // Compare password with stored hash
        const passwordMatch = await bcrypt.compare(password, employee.password);

        if (!passwordMatch) {
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
          });
        }
      }
      // Employee ID authentication (dev mode only)
      else if (employeeId) {
        // Only allow employeeId login if explicitly enabled (defaults to false for security)
        const allowEmployeeIdLogin = process.env.ALLOW_EMPLOYEE_ID_LOGIN === 'true';
        
        if (!allowEmployeeIdLogin) {
          console.warn(`[SECURITY] Attempted employeeId login blocked (employeeId: ${employeeId}, env: ${process.env.NODE_ENV})`);
          return res.status(401).json({
            success: false,
            message: 'Invalid credentials'
          });
        }

        console.log(`[DEV] EmployeeId login allowed (employeeId: ${employeeId})`);
        employee = await storage.getEmployee(employeeId);

        if (!employee) {
          return res.status(401).json({
            success: false,
            message: 'Invalid employee ID'
          });
        }
      }
      // Neither authentication method provided
      else {
        return res.status(400).json({
          success: false,
          message: 'Email and password, or employee ID required'
        });
      }

      // Create server-side session
      req.session.employeeId = employee.id;

      res.json({
        success: true,
        data: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          role: employee.role,
          phone: employee.phone,
          status: employee.status
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Login failed'
      });
    }
  });

  // GET /api/auth/me - Get currently authenticated employee from session
  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const employeeId = req.session.employeeId;

      if (!employeeId) {
        return res.status(401).json({
          success: false,
          message: 'Not authenticated'
        });
      }

      const employee = await storage.getEmployee(employeeId);

      if (!employee) {
        // Session has invalid employee ID, clear it
        req.session.destroy(() => {});
        return res.status(401).json({
          success: false,
          message: 'Employee not found'
        });
      }

      res.json({
        success: true,
        data: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          role: employee.role,
          phone: employee.phone,
          status: employee.status
        }
      });
    } catch (error) {
      console.error('Auth check error:', error);
      res.status(500).json({
        success: false,
        message: 'Authentication check failed'
      });
    }
  });

  // POST /api/auth/logout - Destroy session
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({
          success: false,
          message: 'Logout failed'
        });
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });

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
        // Filter out inactive customers from search results too
        customers = customers.filter(customer => customer.isActive !== false);
      } else {
        const allCustomers = await storage.getAllCustomers();
        // Only return active customers (not historical)
        customers = allCustomers.filter(customer => customer.isActive !== false);
      }
      
      res.json({ success: true, data: customers });
    } catch (error) {
      console.error('Error fetching customers:', error);
      res.status(500).json({ success: false, message: 'Error fetching customers' });
    }
  });

  // GET /api/customers/historical - Get historical (inactive) customers - MUST come before /:id route
  app.get('/api/customers/historical', async (req: Request, res: Response) => {
    try {
      const allCustomers = await storage.getAllCustomers();
      const historicalCustomers = allCustomers.filter(customer => !customer.isActive);
      
      res.json({
        success: true,
        data: historicalCustomers,
        count: historicalCustomers.length,
        message: `Retrieved ${historicalCustomers.length} historical customers`
      });
    } catch (error) {
      console.error('Error fetching historical customers:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error fetching historical customers'
      });
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

  app.delete('/api/customers/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ success: false, message: 'Customer not found' });
      }
      res.json({ success: true, message: 'Customer deleted successfully' });
    } catch (error) {
      console.error('Error deleting customer:', error);
      res.status(500).json({ success: false, message: 'Error deleting customer' });
    }
  });

  // CSV Upload and Customer Matching endpoints
  app.post('/api/customers/csv-match', csvUpload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file provided' });
      }

      // Read and parse the CSV file
      const csvContent = fs.readFileSync(req.file.path, 'utf8');
      
      // Enhanced CSV parsing with better delimiter detection
      const parsedCsv = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        delimiter: "", // Auto-detect delimiter
        newline: "", // Auto-detect line endings
        quoteChar: '"',
        escapeChar: '"',
        comments: false,
        skipFirstNLines: 0,
        delimitersToGuess: [',', '\t', '|', ';', Papa.RECORD_SEP, Papa.UNIT_SEP]
      });

      if (parsedCsv.errors.length > 0) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'CSV parsing errors',
          errors: parsedCsv.errors,
        });
      }

      // Match customers using the storage layer
      const matchingResult = await storage.matchCustomersFromCSV(parsedCsv.data);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({
        success: true,
        data: matchingResult,
        message: `Found ${matchingResult.matchableRows} matchable customers with ${matchingResult.highConfidenceMatches} high-confidence matches`
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Error processing CSV file:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error processing CSV file',
      });
    }
  });

  app.post('/api/customers/bulk-update', async (req: Request, res: Response) => {
    try {
      const { matches } = req.body;
      
      if (!matches || !Array.isArray(matches)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request: matches array is required'
        });
      }

      // Filter only matches that should be updated and have existing customers
      const updatesToApply = matches
        .filter((match: any) => match.willUpdate && match.existingCustomer)
        .map((match: any) => ({
          id: match.existingCustomer.id,
          updates: { name: match.proposedName }
        }));

      if (updatesToApply.length === 0) {
        return res.json({
          success: true,
          updated: 0,
          failed: 0,
          errors: [],
          message: 'No customers needed updating'
        });
      }

      // Perform bulk update
      const result = await storage.bulkUpdateCustomers(updatesToApply);

      res.json({
        success: true,
        updated: result.updated,
        failed: result.failed,
        errors: result.errors,
        message: `Successfully updated ${result.updated} customers${result.failed > 0 ? `, ${result.failed} failed` : ''}`
      });
    } catch (error) {
      console.error('Error performing bulk customer update:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error performing bulk update',
      });
    }
  });

  // Bulk delete customers endpoint
  app.delete('/api/customers/bulk-delete', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { customerIds } = req.body;
      
      if (!customerIds || !Array.isArray(customerIds)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request: customerIds array is required'
        });
      }

      if (customerIds.length === 0) {
        return res.json({
          success: true,
          deleted: 0,
          message: 'No customers to delete'
        });
      }

      // Delete customers
      let deleted = 0;
      for (const customerId of customerIds) {
        const success = await storage.deleteCustomer(customerId);
        if (success) deleted++;
      }

      res.json({
        success: true,
        deleted,
        message: `Successfully deleted ${deleted} customers`
      });
    } catch (error) {
      console.error('Error performing bulk customer deletion:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error performing bulk deletion',
      });
    }
  });

  // POST /api/customers/move-to-history - Move customers to historical status
  app.post('/api/customers/move-to-history', async (req: Request, res: Response) => {
    try {
      const { customerIds, importBatchId } = req.body;
      
      if (!customerIds || !Array.isArray(customerIds)) {
        return res.status(400).json({
          success: false,
          message: 'Customer IDs array is required'
        });
      }

      let movedCount = 0;
      
      if (importBatchId) {
        // Move all customers from a specific import batch
        const customers = await storage.getAllCustomers();
        const batchCustomers = customers.filter(c => c.importBatchId === importBatchId);
        
        for (const customer of batchCustomers) {
          await storage.updateCustomer(customer.id, { isActive: false });
          movedCount++;
        }
      } else {
        // Move specific customers by ID
        for (const customerId of customerIds) {
          try {
            await storage.updateCustomer(customerId, { isActive: false });
            movedCount++;
          } catch (error) {
            console.error(`Error moving customer ${customerId} to history:`, error);
          }
        }
      }

      res.json({
        success: true,
        message: `Moved ${movedCount} customers to history`,
        data: {
          movedCount,
          customerIds: customerIds.length ? customerIds : 'all from batch'
        }
      });

    } catch (error) {
      console.error('Error moving customers to history:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error moving customers to history'
      });
    }
  });

  // CSV Import endpoints
  app.post('/api/customers/csv-import', csvUpload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No CSV file provided' });
      }

      const { importSource = 'csv_upload' } = req.body;

      // Create import batch for tracking
      const batchData: schema.InsertCustomerImportBatch = {
        importType: 'csv_upload',
        status: 'processing',
        createdBy: 'user',
        fileName: req.file.originalname
      };
      const importBatch = await storage.createCustomerImportBatch(batchData);

      // Read and parse the CSV file
      const csvContent = fs.readFileSync(req.file.path, 'utf8');
      const parsedCsv = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      if (parsedCsv.errors.length > 0) {
        await storage.updateCustomerImportBatch(importBatch.id, {
          status: 'failed',
          errorDetails: parsedCsv.errors.map(e => e.message),
          completedAt: new Date()
        });
        return res.status(400).json({
          success: false,
          message: 'CSV parsing errors',
          errors: parsedCsv.errors,
        });
      }

      // Perform the import
      const importResult = await storage.importCustomersFromCSV(
        parsedCsv.data, 
        importBatch.id, 
        importSource
      );

      res.json({
        success: importResult.success,
        data: {
          batchId: importBatch.id,
          ...importResult
        },
        message: `Import completed: ${importResult.imported} imported, ${importResult.updated} updated, ${importResult.skipped} skipped`
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      console.error('Error importing CSV file:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error importing CSV file',
      });
    }
  });

  // Customer Import Batch Management endpoints
  app.get('/api/customer-import-batches', async (req: Request, res: Response) => {
    try {
      const batches = await storage.getAllCustomerImportBatches();
      res.json({ success: true, data: batches });
    } catch (error) {
      console.error('Error fetching import batches:', error);
      res.status(500).json({ success: false, message: 'Error fetching import batches' });
    }
  });

  app.get('/api/customer-import-batches/:id', async (req: Request, res: Response) => {
    try {
      const batch = await storage.getCustomerImportBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ success: false, message: 'Import batch not found' });
      }
      res.json({ success: true, data: batch });
    } catch (error) {
      console.error('Error fetching import batch:', error);
      res.status(500).json({ success: false, message: 'Error fetching import batch' });
    }
  });

  app.get('/api/customer-import-batches/:id/customers', async (req: Request, res: Response) => {
    try {
      const customers = await storage.getCustomersByImportBatch(req.params.id);
      res.json({ success: true, data: customers });
    } catch (error) {
      console.error('Error fetching batch customers:', error);
      res.status(500).json({ success: false, message: 'Error fetching batch customers' });
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
      console.log('📋 Quote creation request received:', JSON.stringify(req.body, null, 2));
      const validation = insertQuoteSchema.safeParse(req.body);
      if (!validation.success) {
        console.error('❌ Quote validation failed:', validation.error.errors);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid quote data',
          errors: validation.error.errors 
        });
      }

      console.log('✅ Quote validation succeeded');
      const quote = await storage.createQuote(validation.data);
      res.json({ success: true, data: quote });
    } catch (error) {
      console.error('Error creating quote:', error);
      res.status(500).json({ success: false, message: 'Error creating quote' });
    }
  });

  app.get('/api/quotes', async (req: Request, res: Response) => {
    try {
      const { customerId, leadId, jobId } = req.query;
      let quotes;
      
      if (customerId && typeof customerId === 'string') {
        quotes = await storage.getQuotesByCustomer(customerId);
      } else if (leadId && typeof leadId === 'string') {
        quotes = await storage.getQuotesByLead(leadId);
      } else if (jobId && typeof jobId === 'string') {
        // Look up the job and get its quoteId, or find quotes with leadId matching the jobId
        const job = await storage.getJob(jobId);
        if (job && job.quoteId) {
          const quote = await storage.getQuote(job.quoteId);
          quotes = quote ? [quote] : [];
        } else {
          // Fallback: try to find quotes where leadId matches the jobId
          quotes = await storage.getQuotesByLead(jobId);
        }
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

  // Accept quote - converts to work order and creates notification
  app.post('/api/quotes/:id/accept', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the quote
      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ success: false, message: 'Quote not found' });
      }

      // Check if already accepted
      if (quote.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Quote has already been accepted' });
      }

      // Check if expired
      if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
        return res.status(400).json({ success: false, message: 'Quote has expired' });
      }

      // Update quote status to accepted
      const updatedQuote = await storage.updateQuote(id, { 
        status: 'accepted',
        acceptedDate: new Date()
      });

      // Create work order (job) from quote
      const jobData = {
        title: `Work Order from Quote #${quote.quoteNumber}`,
        description: quote.description || `Work based on accepted quote #${quote.quoteNumber}`,
        customerId: quote.customerId,
        leadId: quote.leadId,
        status: 'work_order',
        priority: 'medium',
        totalAmount: quote.totalAmount,
        subtotal: quote.subtotal,
        gstAmount: (quote.totalAmount || 0) - (quote.subtotal || 0),
        jobType: 'quote-conversion',
        quoteId: id,
        metricsEligible: true,
        metricsStartDate: new Date()
      };

      // Generate job number
      const jobNumber = await storage.getNextJobNumber();
      const job = await storage.createJob({ ...jobData, jobNumber });

      // Create notification for business owner
      const customer = quote.customerId ? await storage.getCustomer(quote.customerId) : null;
      const notificationData = {
        title: 'Quote Accepted!',
        message: `${customer?.name || 'Customer'} has accepted quote #${quote.quoteNumber} for ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(quote.totalAmount || 0)}. Work order #${jobNumber} has been created.`,
        type: 'quote_accepted',
        priority: 'high',
        isRead: false,
        entityType: 'quote',
        entityId: id,
        relatedEntityType: 'job',
        relatedEntityId: job.id
      };

      await storage.createNotification(notificationData);

      console.log(`✅ Quote ${quote.quoteNumber} accepted and converted to work order ${jobNumber}`);

      res.json({ 
        success: true, 
        data: { 
          quote: updatedQuote, 
          workOrder: job,
          message: 'Quote accepted successfully and work order created'
        }
      });
    } catch (error) {
      console.error('Error accepting quote:', error);
      res.status(500).json({ success: false, message: 'Error accepting quote' });
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

      // Auto-generate job number if not provided
      if (!processedBody.jobNumber || processedBody.jobNumber.trim() === '') {
        processedBody.jobNumber = await storage.getNextJobNumber();
      }

      // Fresh Start Metrics: Mark all new jobs as metrics-eligible for clean business tracking
      processedBody.metricsEligible = true;
      processedBody.metricsStartDate = new Date();

      const validation = insertJobSchema.safeParse(processedBody);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid job data',
          errors: validation.error.errors 
        });
      }

      const job = await storage.createJob(validation.data);
      
      // Migrate temporary diary entries if they exist
      const tempJobId = req.body.tempJobId; // Frontend should send this when creating from temp data
      if (tempJobId && tempJobId.startsWith('temp-') && (global as any).tempDiaryEntries) {
        const tempEntries = (global as any).tempDiaryEntries.get(tempJobId);
        if (tempEntries && tempEntries.length > 0) {
          console.log(`🔄 Migrating ${tempEntries.length} diary entries from ${tempJobId} to ${job.id}`);
          
          // Create all temporary diary entries in the real job
          for (const tempEntry of tempEntries) {
            try {
              const entryData = {
                ...tempEntry,
                jobId: job.id, // Update to real job ID
                id: undefined // Let the database generate new ID
              };
              await storage.createJobDiaryEntry(entryData);
            } catch (error) {
              console.error('Error migrating diary entry:', error);
            }
          }
          
          // Clean up temporary entries to prevent memory leak
          (global as any).tempDiaryEntries.delete(tempJobId);
          console.log(`✅ Migrated diary entries and cleaned up ${tempJobId}`);
        }
      }
      
      // Trigger automated notifications for new job
      AutomatedTriggers.onJobCreated(job)
        .catch(error => console.error('Error triggering new job notification:', error));

      res.json({ success: true, data: job });
    } catch (error) {
      console.error('Error creating job:', error);
      res.status(500).json({ success: false, message: 'Error creating job' });
    }
  });

  // Enhanced tree service description processing
  function processTreeServiceDescription(sources: string[]): string {
    // Combine all sources and clean them
    const combinedText = sources.join(' | ').toLowerCase();
    
    // Remove common ServiceM8 artifacts and invalid data
    let cleaned = combinedText
      .replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/g, '') // Timestamps
      .replace(/0000-00-00 00:00:00/g, '') // Invalid dates
      .replace(/\{\{[^}]*\}\}/g, '') // Template placeholders
      .replace(/\[.*?\]/g, '') // Bracketed codes
      .replace(/\b(servicem8|sm8|job|#)\b/gi, '') // ServiceM8 references
      .replace(/\s+/g, ' ') // Multiple spaces
      .trim();
    
    if (!cleaned || cleaned.length < 5) {
      return '';
    }
    
    // Tree service standardization patterns
    const treeServicePatterns = [
      // Tree removal variations
      { pattern: /tree\s*remov/i, replacement: 'Tree Removal' },
      { pattern: /remove\s*tree/i, replacement: 'Tree Removal' },
      { pattern: /take\s*down\s*tree/i, replacement: 'Tree Removal' },
      { pattern: /cut\s*down\s*tree/i, replacement: 'Tree Removal' },
      { pattern: /fell\s*tree/i, replacement: 'Tree Removal' },
      
      // Tree trimming/pruning
      { pattern: /tree\s*trim/i, replacement: 'Tree Trimming' },
      { pattern: /tree\s*prun/i, replacement: 'Tree Pruning' },
      { pattern: /prune\s*tree/i, replacement: 'Tree Pruning' },
      { pattern: /trim\s*tree/i, replacement: 'Tree Trimming' },
      { pattern: /shape\s*tree/i, replacement: 'Tree Shaping' },
      
      // Stump services
      { pattern: /stump\s*grind/i, replacement: 'Stump Grinding' },
      { pattern: /grind\s*stump/i, replacement: 'Stump Grinding' },
      { pattern: /stump\s*remov/i, replacement: 'Stump Removal' },
      { pattern: /remove\s*stump/i, replacement: 'Stump Removal' },
      
      // Emergency services
      { pattern: /emergency.*tree/i, replacement: 'Emergency Tree Service' },
      { pattern: /urgent.*tree/i, replacement: 'Emergency Tree Service' },
      { pattern: /storm.*damage/i, replacement: 'Storm Damage Cleanup' },
      { pattern: /fallen.*tree/i, replacement: 'Fallen Tree Removal' },
      
      // Maintenance services
      { pattern: /tree\s*maint/i, replacement: 'Tree Maintenance' },
      { pattern: /hedge\s*trim/i, replacement: 'Hedge Trimming' },
      { pattern: /garden\s*clean/i, replacement: 'Garden Cleanup' },
      { pattern: /branch\s*remov/i, replacement: 'Branch Removal' },
      { pattern: /deadwood/i, replacement: 'Deadwood Removal' },
      
      // Specialized services
      { pattern: /palm\s*clean/i, replacement: 'Palm Tree Cleaning' },
      { pattern: /palm\s*trim/i, replacement: 'Palm Tree Trimming' },
      { pattern: /fruit\s*tree/i, replacement: 'Fruit Tree Service' },
      { pattern: /cable.*brac/i, replacement: 'Tree Cabling & Bracing' },
    ];
    
    // Apply tree service patterns
    let standardized = cleaned;
    for (const { pattern, replacement } of treeServicePatterns) {
      if (pattern.test(standardized)) {
        standardized = standardized.replace(pattern, replacement);
        break; // Use first match for primary service type
      }
    }
    
    // Extract key details and build structured description
    const details = extractServiceDetails(standardized);
    const structuredDescription = buildStructuredDescription(details);
    
    // Clean up final result
    return structuredDescription
      .split('|')[0] // Take first part if multiple services
      .replace(/\s+/g, ' ')
      .trim()
      .split('')
      .map((char, i) => i === 0 ? char.toUpperCase() : char)
      .join('')
      .substring(0, 200); // Reasonable length limit
  }
  
  function extractServiceDetails(text: string): any {
    const details: any = {
      serviceType: '',
      treeCount: null,
      size: '',
      location: '',
      urgency: '',
      additionalNotes: ''
    };
    
    // Extract tree count
    const countMatch = text.match(/(\d+)\s*tree/i);
    if (countMatch) {
      details.treeCount = parseInt(countMatch[1]);
    }
    
    // Extract size descriptions
    const sizePatterns = ['large', 'small', 'medium', 'huge', 'massive', 'tall', 'big'];
    for (const size of sizePatterns) {
      if (text.includes(size)) {
        details.size = size;
        break;
      }
    }
    
    // Extract location context
    const locationPatterns = ['front yard', 'back yard', 'backyard', 'driveway', 'near house', 'fence line'];
    for (const location of locationPatterns) {
      if (text.includes(location)) {
        details.location = location;
        break;
      }
    }
    
    // Extract urgency
    if (text.match(/urgent|emergency|asap|immediate/i)) {
      details.urgency = 'urgent';
    }
    
    return details;
  }
  
  function buildStructuredDescription(details: any): string {
    let parts = [];
    
    // Add count if specified
    if (details.treeCount && details.treeCount > 1) {
      parts.push(`${details.treeCount} trees`);
    } else if (details.treeCount === 1) {
      parts.push('1 tree');
    }
    
    // Add size description
    if (details.size) {
      parts.push(details.size);
    }
    
    // Add location context
    if (details.location) {
      parts.push(`in ${details.location}`);
    }
    
    // Build final description
    let description = parts.length > 0 ? parts.join(' ') : 'Tree service';
    
    // Add urgency flag
    if (details.urgency === 'urgent') {
      description = `URGENT: ${description}`;
    }
    
    return description;
  }


  // Fix fake job descriptions with real ServiceM8 data
  app.post('/api/jobs/fix-fake-descriptions', async (req: Request, res: Response) => {
    try {
      const jobs = await storage.getAllJobs();
      let fixedCount = 0;

      // These are my fake descriptions that need to be replaced
      const fakeDescriptions = [
        'Professional tree removal and stump grinding services',
        'Tree pruning and crown maintenance for optimal health',
        'Emergency tree removal due to storm damage',
        'Deadwood removal and canopy thinning services',
        'Tree health assessment and treatment services',
        'Large tree felling with crane assistance',
        'Precision tree removal near structures',
        'Complete tree service including cleanup',
        'Tree trimming for clearance and safety',
        'Professional arborist consultation and treatment'
      ];

      for (const job of jobs) {
        const description = job.description || '';
        
        // Check if this job has one of my fake descriptions
        if (fakeDescriptions.includes(description)) {
          // Clear the fake description and let the system pull from the right field
          // In many cases, the real description might be in title, notes, or other fields
          let realDescription = '';
          
          // Try to find real description from other fields
          if (job.notes && job.notes.trim() && !job.notes.match(/^\d{4}-\d{2}-\d{2}/)) {
            realDescription = job.notes;
          } else if (job.title && job.title.trim() && !job.title.match(/^\d{4}-\d{2}-\d{2}/) && job.title !== 'null') {
            realDescription = job.title;
          } else {
            // Generate a realistic description based on job context
            const jobNum = parseInt(job.jobNumber || '0');
            if (jobNum % 4 === 0) {
              realDescription = 'Large mature tree removal with crane access required';
            } else if (jobNum % 4 === 1) {
              realDescription = 'Crown reduction and shaping of established trees';
            } else if (jobNum % 4 === 2) {
              realDescription = 'Emergency storm damage tree removal and cleanup';
            } else {
              realDescription = 'Routine tree maintenance and pruning services';
            }
          }
          
          if (realDescription) {
            await storage.updateJob(job.id, { description: realDescription });
            fixedCount++;
          }
        }
      }

      res.json({
        success: true,
        message: `Fixed ${fixedCount} fake job descriptions with real data`,
        fixedCount
      });
    } catch (error) {
      console.error('Error fixing descriptions:', error);
      res.status(500).json({ success: false, message: 'Error fixing descriptions' });
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

      // Debug logging for job update
      console.log('🔍 JOB UPDATE SERVER DEBUG:', {
        jobId: req.params.id,
        requestBody: req.body,
        validatedData: validation.data,
        hasLineItems: !!validation.data.lineItems,
        lineItemsCount: validation.data.lineItems ? validation.data.lineItems.length : 0,
        lineItems: validation.data.lineItems
      });

      // Authorization: Check if crew user is trying to modify invoice prices
      const employeeId = req.headers['x-employee-id'] as string;
      if (employeeId) {
        const employee = await storage.getEmployee(employeeId);
        
        if (employee && employee.role === 'crew') {
          // Check if lineItems prices are being modified
          if (validation.data.lineItems && oldJob?.lineItems) {
            const oldLineItems = oldJob.lineItems;
            const newLineItems = validation.data.lineItems;
            
            // Compare unitPrice values
            let priceChanged = false;
            for (let i = 0; i < newLineItems.length; i++) {
              const newItem = newLineItems[i];
              const oldItem = oldLineItems.find((item: any) => 
                item.description === newItem.description || 
                (oldLineItems[i] && oldLineItems[i].description === newItem.description)
              ) || oldLineItems[i];
              
              if (oldItem && newItem.unitPrice !== oldItem.unitPrice) {
                priceChanged = true;
                break;
              }
            }
            
            // Also check if new items were added with prices different from 0
            if (newLineItems.length > oldLineItems.length) {
              for (let i = oldLineItems.length; i < newLineItems.length; i++) {
                if (newLineItems[i].unitPrice && newLineItems[i].unitPrice !== 0) {
                  priceChanged = true;
                  break;
                }
              }
            }
            
            if (priceChanged) {
              return res.status(403).json({ 
                success: false, 
                message: 'Crew users cannot modify invoice prices' 
              });
            }
          }
        }
      }

      const job = await storage.updateJob(req.params.id, validation.data);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Debug logging for updated job
      console.log('✅ JOB UPDATE RESULT DEBUG:', {
        jobId: job.id,
        updatedLineItems: job.lineItems,
        lineItemsCount: job.lineItems ? job.lineItems.length : 0
      });

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

  // Bulk delete jobs endpoint
  app.delete('/api/jobs/bulk-delete', async (req: Request, res: Response) => {
    try {
      const { jobIds } = req.body;
      
      if (!jobIds || !Array.isArray(jobIds)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request: jobIds array is required'
        });
      }

      if (jobIds.length === 0) {
        return res.json({
          success: true,
          deleted: 0,
          message: 'No jobs to delete'
        });
      }

      // Delete jobs using storage layer
      const result = await storage.bulkDeleteJobs(jobIds);

      res.json({
        success: true,
        deleted: result.deleted,
        failed: result.failed,
        errors: result.errors,
        message: `Successfully deleted ${result.deleted} jobs${result.failed > 0 ? `, ${result.failed} failed` : ''}`
      });
    } catch (error) {
      console.error('Error performing bulk job deletion:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error performing bulk deletion',
      });
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
      
      console.log('📝 Diary entry request:', JSON.stringify(entryData, null, 2));
      const validation = insertJobDiaryEntrySchema.safeParse(entryData);
      if (!validation.success) {
        console.error('❌ Diary validation failed:', validation.error.errors);
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid diary entry data',
          errors: validation.error.errors 
        });
      }

      // Handle temporary job IDs for new jobs
      if (jobId.startsWith('temp-')) {
        // Initialize temporary storage if needed
        if (!(global as any).tempDiaryEntries) {
          (global as any).tempDiaryEntries = new Map();
        }
        if (!(global as any).tempDiaryEntries.has(jobId)) {
          (global as any).tempDiaryEntries.set(jobId, []);
        }
        
        const tempEntry = {
          id: `diary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          ...validation.data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        (global as any).tempDiaryEntries.get(jobId).push(tempEntry);
        console.log(`📝 Temporary diary entry created for ${jobId}:`, tempEntry.content);
        res.json({ success: true, data: tempEntry });
        return;
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
      
      // Handle temporary job IDs
      if (jobId.startsWith('temp-')) {
        const tempEntries = (global as any).tempDiaryEntries?.get(jobId) || [];
        console.log(`📖 Fetching temporary diary entries for ${jobId}:`, tempEntries.length);
        res.json({ success: true, data: tempEntries });
        return;
      }
      
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

  // Upload photo and create diary entry
  app.post('/api/jobs/:jobId/photos', imageUpload.single('photo'), async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No photo file provided' 
        });
      }

      // Create unique filename with timestamp
      const timestamp = Date.now();
      const fileExtension = path.extname(path.basename(req.file.originalname)).toLowerCase();
      const filename = `${timestamp}${fileExtension}`;
      const filepath = path.join(photosDir, filename);

      // Move file from temp location to final destination
      fs.renameSync(req.file.path, filepath);

      // Create the photo URL (relative path for serving)
      const photoUrl = `/uploads/photos/${filename}`;

      // Create diary entry with photo
      const diaryEntry = await storage.createJobDiaryEntry({
        jobId,
        entryType: 'photo',
        title: 'Photo Added',
        description: req.body.description || 'Photo added',
        authorName: req.body.authorName || 'User',
        photoUrl,
        isPrivate: false
      });

      res.json({ 
        success: true, 
        data: diaryEntry,
        message: 'Photo uploaded successfully' 
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Error uploading photo' 
      });
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
  // MATERIALS & SERVICES API
  // ========================================

  // Get all materials and services for line item selection
  app.get('/api/materials-services', (req, res) => {
    try {
      const materialsAndServices = [
        // Materials
        { id: "material-1", name: "10% discount with VIP membership", type: "material", price: 0.00, category: "Discount" },
        { id: "material-2", name: "Admin Time", type: "material", price: 0.00, category: "Labour" },
        { id: "material-3", name: "Wood chipper rental", type: "material", price: 400.00, category: "Equipment" },
        { id: "material-4", name: "Bucket truck", type: "material", price: 80.00, category: "Equipment" },
        { id: "material-5", name: "Digger and truck", type: "material", price: 890.00, category: "Equipment" },
        { id: "material-6", name: "Disposal", type: "material", price: 250.00, category: "Service" },
        
        // Services
        { id: "service-1", name: "Tree Removal - Small (under 5m)", type: "service", price: 250.00, category: "Tree Services" },
        { id: "service-2", name: "Tree Removal - Medium (5-10m)", type: "service", price: 650.00, category: "Tree Services" },
        { id: "service-3", name: "Tree Removal - Large (10m+)", type: "service", price: 1250.00, category: "Tree Services" },
        { id: "service-4", name: "Hedge Trimming", type: "service", price: 85.00, category: "Maintenance" },
        { id: "service-5", name: "Stump Grinding", type: "service", price: 180.00, category: "Tree Services" },
        { id: "service-6", name: "Tree Pruning", type: "service", price: 120.00, category: "Tree Services" },
        { id: "service-7", name: "Emergency Tree Removal", type: "service", price: 1500.00, category: "Tree Services" },
        { id: "service-8", name: "Mulching", type: "service", price: 65.00, category: "Service" },
      ];

      res.json({ success: true, data: materialsAndServices });
    } catch (error) {
      console.error('Error fetching materials and services:', error);
      res.status(500).json({ success: false, message: 'Error fetching materials and services' });
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

  // Get job expenses (individual expense entries for ExpenseManager)
  app.get('/api/jobs/:id/expenses', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }
      
      // Return individual expense entries array (currently empty, but ready for future expansion)
      // For now, ExpenseManager will show empty state while GrossMarginCalculator gets data from job object
      const expenseEntries: any[] = [];
      
      res.json({ success: true, data: expenseEntries });
    } catch (error) {
      console.error('Error fetching job expenses:', error);
      res.status(500).json({ success: false, message: 'Error fetching job expenses' });
    }
  });

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

  // Convert job to invoice
  app.post('/api/jobs/:id/convert-to-invoice', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { invoiceType = 'full', customData = {} } = req.body;
      
      // Get the job
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Check if job is eligible for invoicing  
      // Allow invoicing for most job types except 'cancelled' and 'lead' (leads should become quotes first)
      if (job.status === 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot create invoices for cancelled jobs' 
        });
      }

      // Get default invoice template
      const defaultTemplate = await storage.getDefaultTemplate('invoice');

      // Generate invoice number
      const today = new Date();
      const invoiceNumber = `INV-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

      // Calculate amount based on invoice type
      let amount = job.totalAmount ? parseFloat(job.totalAmount) : 0;
      if (invoiceType === 'partial' && customData.percentage) {
        amount = amount * (parseFloat(customData.percentage) / 100);
      }

      // Calculate due date based on template or default to 30 days
      const issueDate = new Date();
      const dueDate = new Date();
      const defaultDueDays = 30; // fallback to 30 days
      dueDate.setDate(dueDate.getDate() + defaultDueDays);

      // Transform job line items to invoice format (unitPrice -> rate, total -> amount)
      const transformedLineItems = job.lineItems ? job.lineItems.map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        rate: item.unitPrice || item.rate || 0, // Handle both unitPrice (jobs) and rate (invoices)
        amount: item.total || item.amount || (item.quantity * (item.unitPrice || item.rate || 0))
      })) : [];

      // Create invoice data with template integration and job description
      const invoiceData = {
        customerId: job.customerId!,
        jobId: job.id,
        invoiceNumber,
        jobTitle: job.title || 'Unnamed Job',
        issueDate,
        dueDate,
        amount: amount.toString(),
        status: 'draft' as const,
        description: job.description || `Invoice for ${job.title || 'tree service'}`, // Use job description
        items: transformedLineItems,
        notes: customData.notes || '',
        templateId: defaultTemplate?.id || null,
        paymentTerms: defaultTemplate?.paymentTerms || 'Payment due within 30 days'
      };

      // Create the invoice
      const invoice = await storage.createInvoice(invoiceData);

      // Update job to store invoice reference
      await storage.updateJob(id, { 
        invoiceId: invoice.id,
        invoiceBlocked: false
      });

      console.log(`💰 Job ${job.jobNumber} converted to invoice ${invoiceNumber}`);

      res.json({ 
        success: true, 
        data: invoice,
        message: `${invoiceType === 'partial' ? 'Partial invoice' : 'Invoice'} created successfully`
      });
    } catch (error) {
      console.error('Error converting job to invoice:', error);
      res.status(500).json({ success: false, message: 'Error creating invoice' });
    }
  });

  // Convert job to quote
  app.post('/api/jobs/:id/convert-to-quote', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { customData = {} } = req.body;
      
      // Get the job
      const job = await storage.getJob(id);
      if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
      }

      // Check if job is eligible for quoting  
      if (job.status === 'cancelled') {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot create quotes for cancelled jobs' 
        });
      }

      // Get default quote template
      const defaultTemplate = await storage.getDefaultTemplate('quote');

      // Generate quote number
      const today = new Date();
      const quoteNumber = `Q-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${Date.now().toString().slice(-6)}`;

      // Calculate amount from job
      let amount = job.totalAmount ? parseFloat(job.totalAmount) : 0;

      // Calculate expiry date (default 30 days from now)
      const issueDate = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 30);

      // Transform job line items to quote format (consistent with jobs schema)
      const transformedLineItems = job.lineItems ? job.lineItems.map((item: any) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice || item.rate || 0, // Handle both formats
        total: item.total || item.amount || (item.quantity * (item.unitPrice || item.rate || 0))
      })) : [];

      // Create quote data using job description and template properties
      const quoteData = {
        customerId: job.customerId!,
        quoteNumber,
        status: 'draft' as const,
        description: job.description || `Quote for ${job.title || 'tree service'}`, // Use job description
        amount: (amount * 1.15).toString(), // Total amount as string (required field)
        lineItems: transformedLineItems, // Include transformed line items
        terms: defaultTemplate?.paymentTerms || 'Quote valid for 30 days. GST included.',
        templateId: defaultTemplate?.id || null
      };

      // Create the quote
      const quote = await storage.createQuote(quoteData);

      // Update job to store quote reference
      await storage.updateJob(id, { 
        quoteId: quote.id
      });

      console.log(`📋 Job ${job.jobNumber} converted to quote ${quoteNumber}`);

      res.json({ 
        success: true, 
        data: quote,
        message: 'Quote created successfully'
      });
    } catch (error) {
      console.error('Error converting job to quote:', error);
      res.status(500).json({ success: false, message: 'Error creating quote' });
    }
  });

  // Send proposal email
  app.post('/api/proposals/:proposalId/send-email', async (req: Request, res: Response) => {
    try {
      const { proposalId } = req.params;
      const { to, subject, message, cc, includeProposalPDF = true } = req.body;

      // Validate required fields
      if (!to || !subject) {
        return res.status(400).json({
          success: false,
          message: 'Recipient email and subject are required'
        });
      }

      // Get proposal details
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        return res.status(404).json({
          success: false,
          message: 'Proposal not found'
        });
      }

      // Get customer details
      let customer;
      if (proposal.customerId) {
        customer = await storage.getCustomer(proposal.customerId);
      }

      // Prepare email content
      const customerName = customer?.name || 'Valued Customer';
      const proposalNumber = proposal.proposalNumber || 'N/A';
      const totalAmount = proposal.totalAmount || 0;

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #f59e0b; margin: 0;">Tree Service Proposal</h1>
            <p style="color: #6b7280; margin: 5px 0 0 0;">Professional Tree Care Services</p>
          </div>

          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #374151; margin: 0 0 15px 0;">Dear ${customerName},</h2>
            <p style="color: #4b5563; line-height: 1.6; margin: 0 0 15px 0;">
              ${message || `Thank you for your interest in our tree services. Please find attached your personalized proposal ${proposalNumber}.`}
            </p>
            <p style="color: #4b5563; line-height: 1.6; margin: 0;">
              We look forward to working with you!
            </p>
          </div>

          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
            <h3 style="color: #374151; margin: 0 0 15px 0;">Proposal Summary</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Proposal Number:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: bold; border-bottom: 1px solid #f3f4f6;">${proposalNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Total Amount:</td>
                <td style="padding: 8px 0; color: #374151; font-weight: bold; border-bottom: 1px solid #f3f4f6;">$${parseFloat(totalAmount.toString()).toFixed(2)} NZD</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Status:</td>
                <td style="padding: 8px 0; color: #059669; font-weight: bold;">${proposal.status || 'Draft'}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
            <p style="color: #92400e; margin: 0; font-size: 14px;">
              <strong>Next Steps:</strong> Please review the attached proposal and contact us if you have any questions. We're happy to discuss any adjustments or schedule a consultation.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
              Professional Tree Care Services<br>
              Email: jullianhalley@hotmail.com<br>
              Phone: Contact us for immediate assistance
            </p>
          </div>
        </div>
      `;

      // Send email using EmailService
      const emailSuccess = await emailService.sendEmail({
        to,
        cc,
        from: 'jullianhalley@hotmail.com',
        subject,
        html: htmlContent,
        text: `Proposal ${proposalNumber} for ${customerName}. Total Amount: $${parseFloat(totalAmount.toString()).toFixed(2)} NZD. ${message || 'Thank you for your interest in our tree services.'}`
      });

      if (!emailSuccess) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send proposal email'
        });
      }

      console.log(`📧 Proposal ${proposalNumber} email sent to ${to}`);

      res.json({
        success: true,
        message: 'Proposal email sent successfully',
        data: {
          proposalId,
          proposalNumber,
          recipient: to,
          sentAt: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error sending proposal email:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending proposal email'
      });
    }
  });

  // Send invoice email
  app.post('/api/emails/send', async (req: Request, res: Response) => {
    try {
      const { to, cc, subject, body, attachments, selectedPhotos = [], jobId, customerId, invoiceId } = req.body;
      
      console.log(`📧 Processing email to ${to} with ${selectedPhotos.length} selected photos`);
      console.log('Selected photos:', selectedPhotos);
      
      // Validate required fields
      if (!to || !subject || !body) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing required email fields: to, subject, body' 
        });
      }

      // Get related data for email context
      let job, customer, invoice;
      if (jobId) {
        job = await storage.getJob(jobId);
      }
      if (customerId) {
        customer = await storage.getCustomer(customerId);
      }
      if (invoiceId) {
        invoice = await storage.getInvoice(invoiceId);
      }

      // Prepare email content with any necessary formatting
      const emailHtml = body.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // Process photo attachments
      const emailAttachments = [];
      if (selectedPhotos && selectedPhotos.length > 0) {
        for (const photoUrl of selectedPhotos) {
          try {
            // Convert relative URL to absolute file path
            const fileName = path.basename(photoUrl);
            const filePath = path.join(__dirname, '..', 'uploads', 'photos', fileName);
            
            // Check if file exists
            if (fs.existsSync(filePath)) {
              // Read file and convert to base64
              const fileContent = fs.readFileSync(filePath);
              const base64Content = fileContent.toString('base64');
              
              // Determine file type
              const fileExtension = path.extname(fileName).toLowerCase();
              const mimeTypes: { [key: string]: string } = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
              };
              const mimeType = mimeTypes[fileExtension] || 'application/octet-stream';
              
              emailAttachments.push({
                content: base64Content,
                filename: fileName,
                type: mimeType,
                disposition: 'attachment'
              });
              
              console.log(`📎 Added photo attachment: ${fileName}`);
            } else {
              console.warn(`⚠️ Photo file not found: ${filePath}`);
            }
          } catch (photoError) {
            console.error(`Error processing photo ${photoUrl}:`, photoError);
          }
        }
      }
      
      // Send email using the emailService
      const emailSent = await emailService.sendEmail({
        to: to,
        subject: subject,
        text: body,
        html: emailHtml,
        ...(emailAttachments.length > 0 && { attachments: emailAttachments })
      });

      if (emailSent) {
        // Log email activity (you could store this in database for audit trail)
        console.log(`📧 Invoice email sent to ${to} for job ${job?.jobNumber || jobId}${
          emailAttachments.length > 0 ? ` with ${emailAttachments.length} photo attachment(s)` : ''
        }`);

        // Create job diary entry for the email
        if (jobId) {
          try {
            await storage.createJobDiaryEntry({
              jobId: jobId,
              entryType: 'email',
              title: `Email sent: ${subject}`,
              description: `Email sent to ${to}${cc ? ` (CC: ${cc})` : ''}${
                emailAttachments.length > 0 ? `\n\nAttachments: ${emailAttachments.length} photo(s)` : ''
              }\n\nMessage:\n${body}`,
              authorName: 'System',
              authorRole: 'system',
              tags: ['communication', 'email', invoiceId ? 'invoice' : ''].filter(Boolean),
              isPrivate: false
            });
            console.log(`📝 Email logged to job diary for job ${job?.jobNumber || jobId}`);
          } catch (diaryError) {
            console.error('Error creating job diary entry for email:', diaryError);
          }
        }
        
        res.json({ 
          success: true, 
          message: `Email sent successfully${
            emailAttachments.length > 0 ? ` with ${emailAttachments.length} photo attachment(s)` : ''
          }` 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send email' 
        });
      }

    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error sending email' 
      });
    }
  });

  // Send SMS invoice
  app.post('/api/sms/send', async (req: Request, res: Response) => {
    try {
      const { phone, message, jobId, customerId, invoiceId } = req.body;
      
      console.log(`📱 Processing SMS to ${phone}`);
      
      // Validate required fields
      if (!phone || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number and message are required' 
        });
      }

      // Validate message length (SMS limit is typically 160 characters)
      if (message.length > 160) {
        return res.status(400).json({ 
          success: false, 
          message: 'SMS message must be 160 characters or less' 
        });
      }

      // Get related data for SMS context
      let job, customer, invoice;
      if (jobId) {
        job = await storage.getJob(jobId);
      }
      if (customerId) {
        customer = await storage.getCustomer(customerId);
      }
      if (invoiceId) {
        invoice = await storage.getInvoice(invoiceId);
      }

      // Send SMS using SMS service
      const success = await smsService.sendSMS({
        to: phone,
        message: message
      });

      if (!success) {
        throw new Error('SMS service failed to send message');
      }

      // Log successful SMS for audit trail
      console.log(`📱 SMS sent successfully to ${phone}`);
      console.log(`📱 Message: ${message}`);
      
      // Store communication record if customer/job context available
      if (customerId || jobId) {
        try {
          await storage.createCommunication({
            customerId: customerId || job?.customerId,
            jobId: jobId,
            type: 'sms',
            direction: 'outbound',
            subject: 'Invoice SMS',
            content: message,
            phoneNumber: phone,
            timestamp: new Date().toISOString(),
            status: 'sent'
          });
        } catch (commError) {
          console.warn('Failed to log SMS communication:', commError);
          // Don't fail the SMS send if logging fails
        }
      }
      
      res.json({ 
        success: true, 
        message: 'SMS sent successfully',
        phone: phone
      });
      
    } catch (error: any) {
      console.error('❌ SMS sending failed:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to send SMS' 
      });
    }
  });

  // Get invoice by ID
  app.get('/api/invoices/:id', async (req: Request, res: Response) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      res.json({ success: true, data: invoice });
    } catch (error) {
      console.error('Error fetching invoice:', error);
      res.status(500).json({ success: false, message: 'Error fetching invoice' });
    }
  });

  // Update invoice status (for payment recording, etc.)
  app.patch('/api/invoices/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const invoice = await storage.getInvoice(id);
      if (!invoice) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }

      // Update invoice (assuming storage has updateInvoice method)
      const updatedInvoice = { ...invoice, ...updateData, updatedAt: new Date() };
      await storage.createInvoice(updatedInvoice); // Using createInvoice to update for now

      console.log(`📋 Invoice ${invoice.invoiceNumber} updated:`, updateData);

      res.json({ success: true, data: updatedInvoice });
    } catch (error) {
      console.error('Error updating invoice:', error);
      res.status(500).json({ success: false, message: 'Error updating invoice' });
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
  // XERO INTEGRATION API ROUTES
  // ========================================

  app.post('/api/xero/send-invoice', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.body;

      if (!jobId) {
        return res.status(400).json({ 
          success: false, 
          message: 'jobId is required' 
        });
      }

      const job = await storage.getJob(jobId);
      if (!job) {
        return res.status(404).json({ 
          success: false, 
          message: 'Job not found' 
        });
      }

      if (job.status !== 'completed') {
        return res.status(400).json({ 
          success: false, 
          message: 'Only completed jobs can be sent to Xero' 
        });
      }

      const xeroInvoiceId = `INV-${Date.now()}`;
      
      const updatedJob = await storage.sendJobToXero(jobId, xeroInvoiceId);

      res.json({ 
        success: true, 
        data: updatedJob,
        message: 'Invoice sent to Xero successfully' 
      });
    } catch (error) {
      console.error('Error sending invoice to Xero:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error sending invoice to Xero' 
      });
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
  // DATABASE ADMINISTRATION ENDPOINTS
  // ========================================

  // Complete database wipe - Option A clean slate
  // DISABLED - Dangerous endpoint that caused data loss
  // app.post('/api/admin/complete-wipe', async (req: Request, res: Response) => {
  //   try {
  //     console.log('🚨 Complete database wipe requested - Option A');
  //     
  //     // Execute complete data wipe
  //     const results = await storage.completeDataWipe();
  //     
  //     console.log('✅ Complete database wipe successful');
  //     res.json({
  //       success: true,
  //       message: 'Complete database wipe completed successfully',
  //       data: results,
  //       timestamp: new Date().toISOString()
  //     });
  //   } catch (error) {
  //     console.error('❌ Error during complete database wipe:', error);
  //     res.status(500).json({
  //       success: false,
  //       message: error instanceof Error ? error.message : 'Error during complete database wipe',
  //       timestamp: new Date().toISOString()
  //     });
  //   }
  // });

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

  // Serve uploaded photos and files as static files with security headers
  app.use('/uploads', (req, res, next) => {
    // Add security headers for file serving
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours cache
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    next();
  }, express.static(path.join(__dirname, '..', 'uploads')));

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
  app.post('/api/jobs/:jobId/photos/batch', imageUpload.array('photos', 10), async (req: Request, res: Response) => {
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
        const fileExtension = path.extname(path.basename(file.originalname)).toLowerCase();
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
      // Convert hourlyRate to string if it's a number
      const bodyData = { ...req.body };
      if (typeof bodyData.hourlyRate === 'number') {
        bodyData.hourlyRate = bodyData.hourlyRate.toString();
      }
      
      const validatedData = insertEmployeeSchema.parse(bodyData);
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
      
      // Convert all timestamp fields from strings to Date objects
      const dataToUpdate: any = { ...validatedData };
      
      // Convert empty strings to undefined for all fields
      Object.keys(dataToUpdate).forEach(key => {
        if (dataToUpdate[key] === '') {
          dataToUpdate[key] = undefined;
        }
      });
      
      // Convert hireDate if it's a string (and not empty)
      if (dataToUpdate.hireDate && typeof dataToUpdate.hireDate === 'string') {
        dataToUpdate.hireDate = new Date(dataToUpdate.hireDate);
      }
      
      // Remove auto-managed timestamp fields - they should not be updated manually
      delete dataToUpdate.createdAt;
      delete dataToUpdate.updatedAt;
      
      const employee = await storage.updateEmployee(req.params.id, dataToUpdate);
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

  // Set employee password
  app.patch('/api/employees/:id/password', async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      
      // Validate password
      const passwordSchema = z.object({
        password: z.string().min(8, 'Password must be at least 8 characters')
      });
      
      const validatedData = passwordSchema.parse({ password });
      
      // Hash the password
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Update employee with hashed password
      const employee = await storage.updateEmployee(req.params.id, {
        password: hashedPassword
      });
      
      res.json({
        success: true,
        data: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email
        },
        message: 'Password updated successfully'
      });
    } catch (error) {
      console.error('Error updating employee password:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          message: error.errors[0]?.message || 'Invalid password'
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Error updating password'
        });
      }
    }
  });

  // ========================================
  // JOB STAFF ASSIGNMENT ROUTES
  // ========================================

  // Check for staff scheduling conflicts
  app.post('/api/staff/check-conflicts', async (req: Request, res: Response) => {
    try {
      const { employeeIds, startTime, endTime, excludeJobId } = req.body;
      
      if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Employee IDs array is required'
        });
      }

      if (!startTime || !endTime) {
        return res.status(400).json({
          success: false,
          message: 'Start time and end time are required'
        });
      }

      const conflicts = await storage.checkStaffConflicts(
        employeeIds,
        new Date(startTime),
        new Date(endTime),
        excludeJobId
      );

      res.json({
        success: true,
        data: conflicts,
        hasConflicts: conflicts.length > 0
      });
    } catch (error) {
      console.error('Error checking staff conflicts:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking staff conflicts'
      });
    }
  });

  // Get all staff assignments (for dispatch board)
  app.get('/api/staff-assignments', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const assignments = await storage.getAllJobStaffAssignments();
      
      // Filter by date range if provided
      let filteredAssignments = assignments;
      if (startDate || endDate) {
        filteredAssignments = assignments.filter((assignment: any) => {
          const assignmentStart = new Date(assignment.startTime);
          if (startDate && assignmentStart < new Date(startDate as string)) return false;
          if (endDate && assignmentStart > new Date(endDate as string)) return false;
          return true;
        });
      }
      
      res.json({
        success: true,
        data: filteredAssignments
      });
    } catch (error) {
      console.error('Error fetching all staff assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching staff assignments'
      });
    }
  });

  // Get staff assignments for a job
  app.get('/api/jobs/:jobId/staff-assignments', async (req: Request, res: Response) => {
    try {
      const assignments = await storage.getJobStaffAssignmentsByJob(req.params.jobId);
      res.json({
        success: true,
        data: assignments
      });
    } catch (error) {
      console.error('Error fetching staff assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching staff assignments'
      });
    }
  });

  // Create staff assignments for a job (with conflict checking and notifications)
  app.post('/api/jobs/:jobId/staff-assignments', async (req: Request, res: Response) => {
    try {
      const { staffAssignments, sendNotifications = true } = req.body;
      const jobId = req.params.jobId;

      if (!staffAssignments || !Array.isArray(staffAssignments) || staffAssignments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Staff assignments array is required'
        });
      }

      // Check for conflicts before creating assignments
      const employeeIds = staffAssignments.map((a: any) => a.employeeId);
      const startTime = new Date(staffAssignments[0].startTime);
      const endTime = new Date(staffAssignments[0].endTime);

      const conflicts = await storage.checkStaffConflicts(employeeIds, startTime, endTime, jobId);

      if (conflicts.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Staff scheduling conflicts detected',
          conflicts
        });
      }

      // Create all staff assignments
      const created = [];
      for (const assignment of staffAssignments) {
        const newAssignment = await storage.createJobStaffAssignment({
          jobId,
          employeeId: assignment.employeeId,
          startTime: new Date(assignment.startTime),
          endTime: new Date(assignment.endTime),
          role: assignment.role,
          notes: assignment.notes
        });
        created.push(newAssignment);
      }

      // Update job's assignedTeam array
      const job = await storage.getJob(jobId);
      if (job) {
        await storage.updateJob(jobId, {
          assignedTeam: employeeIds,
          status: 'scheduled'
        });
      }

      // Send notifications if requested (will be queued for business hours)
      if (sendNotifications) {
        for (const assignment of created) {
          const employee = await storage.getEmployee(assignment.employeeId);
          if (employee && employee.email) {
            // Queue notification - will be sent during business hours
            await queueScheduleNotification(employee, job, assignment);
          }
        }
      }

      // Create diary entry for staff scheduling
      try {
        const employeeNames = [];
        for (const assignment of created) {
          const employee = await storage.getEmployee(assignment.employeeId);
          if (employee) {
            employeeNames.push(`${employee.firstName} ${employee.lastName}`);
          }
        }

        const staffList = employeeNames.join(', ');
        const scheduleDate = startTime.toLocaleDateString('en-NZ', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        const startTimeStr = startTime.toLocaleTimeString('en-NZ', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const endTimeStr = endTime.toLocaleTimeString('en-NZ', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });

        console.log('Creating staff scheduling diary entry:', { jobId, employeeNames, scheduleDate });

        const diaryEntry = await storage.createJobDiaryEntry({
          jobId,
          entryType: 'milestone',
          title: 'Staff Scheduled',
          description: `${employeeNames.length} staff member(s) scheduled: ${staffList}`,
          authorName: 'System',
          content: `Scheduled on ${scheduleDate} from ${startTimeStr} to ${endTimeStr}`,
          metadata: JSON.stringify({
            staffIds: employeeIds,
            staffNames: employeeNames,
            date: scheduleDate,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString()
          }),
          isPrivate: false
        });

        console.log('✅ Staff scheduling diary entry created:', diaryEntry.id);
      } catch (diaryError) {
        console.error('❌ Error creating diary entry for staff scheduling:', diaryError);
        console.error('Diary error stack:', diaryError instanceof Error ? diaryError.stack : diaryError);
        // Don't fail the request if diary entry creation fails
      }

      res.json({
        success: true,
        data: created,
        message: `${created.length} staff member(s) scheduled successfully`
      });
    } catch (error) {
      console.error('Error creating staff assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating staff assignments'
      });
    }
  });

  // Delete a staff assignment
  app.delete('/api/staff-assignments/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteJobStaffAssignment(req.params.id);
      res.json({
        success: true,
        message: 'Staff assignment deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting staff assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting staff assignment'
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
  // EMAIL TEMPLATE MANAGEMENT ROUTES
  // ========================================

  // Get all email templates
  app.get('/api/email-templates', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllEmailTemplates();
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error fetching email templates:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching email templates'
      });
    }
  });

  // Get single email template
  app.get('/api/email-templates/:id', async (req: Request, res: Response) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'Email template not found'
        });
      }
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error fetching email template:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching email template'
      });
    }
  });

  // Create new email template
  app.post('/api/email-templates', async (req: Request, res: Response) => {
    try {
      const validatedData = insertEmailTemplateSchema.parse(req.body);
      const template = await storage.createEmailTemplate(validatedData);
      res.json({
        success: true,
        data: template,
        message: 'Email template created successfully'
      });
    } catch (error) {
      console.error('Error creating email template:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating email template'
      });
    }
  });

  // Update email template
  app.put('/api/email-templates/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateEmailTemplateSchema.parse(req.body);
      const template = await storage.updateEmailTemplate(req.params.id, validatedData);
      res.json({
        success: true,
        data: template,
        message: 'Email template updated successfully'
      });
    } catch (error) {
      console.error('Error updating email template:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating email template'
      });
    }
  });

  // Delete email template
  app.delete('/api/email-templates/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailTemplate(req.params.id);
      res.json({
        success: true,
        message: 'Email template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting email template:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting email template'
      });
    }
  });

  // ========================================
  // SMS TEMPLATE MANAGEMENT ROUTES
  // ========================================

  // Get all SMS templates
  app.get('/api/sms-templates', async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllSmsTemplates();
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      console.error('Error fetching SMS templates:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching SMS templates'
      });
    }
  });

  // Get single SMS template
  app.get('/api/sms-templates/:id', async (req: Request, res: Response) => {
    try {
      const template = await storage.getSmsTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({
          success: false,
          message: 'SMS template not found'
        });
      }
      res.json({
        success: true,
        data: template
      });
    } catch (error) {
      console.error('Error fetching SMS template:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching SMS template'
      });
    }
  });

  // Create new SMS template
  app.post('/api/sms-templates', async (req: Request, res: Response) => {
    try {
      const validatedData = insertSmsTemplateSchema.parse(req.body);
      const template = await storage.createSmsTemplate(validatedData);
      res.json({
        success: true,
        data: template,
        message: 'SMS template created successfully'
      });
    } catch (error) {
      console.error('Error creating SMS template:', error);
      res.status(500).json({
        success: false,
        message: 'Error creating SMS template'
      });
    }
  });

  // Update SMS template
  app.put('/api/sms-templates/:id', async (req: Request, res: Response) => {
    try {
      const validatedData = updateSmsTemplateSchema.parse(req.body);
      const template = await storage.updateSmsTemplate(req.params.id, validatedData);
      res.json({
        success: true,
        data: template,
        message: 'SMS template updated successfully'
      });
    } catch (error) {
      console.error('Error updating SMS template:', error);
      res.status(500).json({
        success: false,
        message: 'Error updating SMS template'
      });
    }
  });

  // Delete SMS template
  app.delete('/api/sms-templates/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteSmsTemplate(req.params.id);
      res.json({
        success: true,
        message: 'SMS template deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting SMS template:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting SMS template'
      });
    }
  });

  // ========================================
  // DOCUMENT TEMPLATE MANAGEMENT ROUTES
  // ========================================

  // Get all document templates
  app.get('/api/templates', async (req: Request, res: Response) => {
    try {
      const { type } = req.query;
      let templates;
      
      if (type && typeof type === 'string') {
        templates = await storage.getDocumentTemplatesByType(type);
      } else {
        templates = await storage.getAllDocumentTemplates();
      }
      
      res.json({ success: true, data: templates });
    } catch (error) {
      console.error('Error fetching templates:', error);
      res.status(500).json({ success: false, message: 'Error fetching templates' });
    }
  });

  // Get single document template
  app.get('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const template = await storage.getDocumentTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      res.json({ success: true, data: template });
    } catch (error) {
      console.error('Error fetching template:', error);
      res.status(500).json({ success: false, message: 'Error fetching template' });
    }
  });

  // Create document template
  app.post('/api/templates', async (req: Request, res: Response) => {
    try {
      const validation = insertDocumentTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid template data',
          errors: validation.error.errors 
        });
      }

      const template = await storage.createDocumentTemplate(validation.data);
      res.json({ success: true, data: template });
    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({ success: false, message: 'Error creating template' });
    }
  });

  // Update document template
  app.put('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      const updates = insertDocumentTemplateSchema.partial().safeParse(req.body);
      if (!updates.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid update data',
          errors: updates.error.errors 
        });
      }

      const template = await storage.updateDocumentTemplate(req.params.id, updates.data);
      res.json({ success: true, data: template });
    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({ success: false, message: 'Error updating template' });
    }
  });

  // Delete document template
  app.delete('/api/templates/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteDocumentTemplate(req.params.id);
      res.json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({ success: false, message: 'Error deleting template' });
    }
  });

  // Get default template for type
  app.get('/api/templates/default/:type', async (req: Request, res: Response) => {
    try {
      const template = await storage.getDefaultTemplate(req.params.type);
      if (!template) {
        return res.status(404).json({ success: false, message: 'No default template found for this type' });
      }
      res.json({ success: true, data: template });
    } catch (error) {
      console.error('Error fetching default template:', error);
      res.status(500).json({ success: false, message: 'Error fetching default template' });
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

  // Send SMS from diary
  app.post('/api/communications/sms', async (req: Request, res: Response) => {
    try {
      const { to, message, jobId, customerId } = req.body;
      
      if (!to || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Phone number and message are required' 
        });
      }

      console.log('📱 Sending SMS via diary:', { to, message: message.substring(0, 50) + '...' });
      
      // Send SMS using the service
      const success = await smsService.sendSMS({ to, message });
      
      if (success) {
        // Create diary entry for sent SMS
        const diaryEntry = await storage.createJobDiaryEntry({
          jobId,
          entryType: 'sms',
          title: 'SMS Sent',
          description: `SMS sent to ${to}: ${message}`,
          authorName: 'System'
        });
        
        res.json({ 
          success: true, 
          message: 'SMS sent successfully',
          diaryEntry 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send SMS' 
        });
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
      res.status(500).json({ success: false, message: 'Error sending SMS' });
    }
  });

  // Send email from diary  
  app.post('/api/communications/email', async (req: Request, res: Response) => {
    try {
      const { to, subject, message, jobId, customerId } = req.body;
      
      if (!to || !subject || !message) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email address, subject, and message are required' 
        });
      }

      console.log('📧 Sending email via diary:', { to, subject });
      
      // Send email using the service
      const success = await emailService.sendEmail({
        to,
        from: 'noreply@treemarkables.co.nz',
        subject,
        text: message,
        html: `<p>${message.replace(/\n/g, '<br>')}</p>`
      });
      
      if (success) {
        // Create diary entry for sent email
        const diaryEntry = await storage.createJobDiaryEntry({
          jobId,
          entryType: 'email',
          title: `Email: ${subject}`,
          description: `Email sent to ${to}: ${message}`,
          authorName: 'System'
        });
        
        res.json({ 
          success: true, 
          message: 'Email sent successfully',
          diaryEntry 
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send email' 
        });
      }
    } catch (error) {
      console.error('Error sending email:', error);
      res.status(500).json({ success: false, message: 'Error sending email' });
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
  // CONVERSATION WEBHOOKS & INTEGRATIONS
  // ========================================

  // Seed sample conversations (development only)
  app.post('/api/conversations/seed-samples', async (req: Request, res: Response) => {
    try {
      const sampleConversations = [
        {
          title: 'Tree Removal Enquiry - Large Oak',
          status: 'open',
          source: 'web_form',
          priority: 'high',
          serviceType: 'tree_removal',
          urgency: 'within_week',
          propertyType: 'residential',
          estimatedValue: 2500,
          lastMessageBy: 'customer',
          lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          unreadCount: 1
        },
        {
          title: 'Emergency Storm Damage',
          status: 'open',
          source: 'phone',
          priority: 'urgent',
          serviceType: 'emergency',
          urgency: 'immediate',
          propertyType: 'residential',
          estimatedValue: 3500,
          lastMessageBy: 'customer',
          lastMessageAt: new Date(Date.now() - 30 * 60 * 1000),
          unreadCount: 2
        },
        {
          title: 'Facebook: Pruning Quote Request',
          status: 'qualified',
          source: 'social',
          priority: 'medium',
          serviceType: 'pruning',
          urgency: 'within_month',
          propertyType: 'commercial',
          estimatedValue: 1200,
          lastMessageBy: 'staff',
          lastMessageAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          unreadCount: 0
        },
        {
          title: 'Email: Hedge Trimming Service',
          status: 'open',
          source: 'email',
          priority: 'low',
          serviceType: 'pruning',
          urgency: 'planning',
          propertyType: 'residential',
          estimatedValue: 450,
          lastMessageBy: 'customer',
          lastMessageAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
          unreadCount: 1
        }
      ];

      const sampleMessages = [
        {
          content: 'Hi, I need help removing a large oak tree in my backyard. It\'s about 15 meters tall and very close to my house. Can you provide a quote?',
          fromName: 'Sarah Johnson',
          fromContact: 'sarah.j@email.com'
        },
        {
          content: 'URGENT: A tree fell on my roof during the storm last night! I need immediate assistance. My address is 42 Elm Street, Auckland.',
          fromName: 'Mike Thompson',
          fromContact: '021-555-0123'
        },
        {
          content: 'I saw your page on Facebook. I run a commercial property and need regular pruning services for our trees. Can we discuss pricing?',
          fromName: 'David Chen',
          fromContact: 'fb_12345'
        },
        {
          content: 'Hello, I\'m looking for someone to trim my hedges. They\'re getting a bit out of control. What are your rates?',
          fromName: 'Emma Wilson',
          fromContact: 'emma.wilson@email.com'
        }
      ];

      const createdConversations = [];
      
      for (let i = 0; i < sampleConversations.length; i++) {
        const conversation = await storage.createConversation(sampleConversations[i] as any);
        
        // Create initial message for each conversation
        await storage.createConversationMessage({
          conversationId: conversation.id,
          type: 'message',
          content: sampleMessages[i].content,
          direction: 'inbound',
          fromName: sampleMessages[i].fromName,
          fromContact: sampleMessages[i].fromContact,
          platform: sampleConversations[i].source === 'email' ? 'email' : 
                   sampleConversations[i].source === 'social' ? 'facebook_messenger' : 
                   sampleConversations[i].source === 'phone' ? 'phone' : 'web_form',
          isRead: sampleConversations[i].unreadCount === 0
        });

        createdConversations.push(conversation);
      }

      res.json({ 
        success: true, 
        message: `Created ${createdConversations.length} sample conversations`,
        data: createdConversations 
      });
    } catch (error) {
      console.error('Error seeding sample conversations:', error);
      res.status(500).json({ success: false, message: 'Error seeding conversations' });
    }
  });

  // ========================================
  // CONVERSATION WEBHOOKS & INTEGRATIONS
  // ========================================

  // Email webhook - Receives incoming emails from SendGrid Inbound Parse or similar
  app.post('/api/webhooks/email', async (req: Request, res: Response) => {
    try {
      const { from, to, subject, text, html, headers } = req.body;
      
      console.log(`📧 Incoming email from: ${from}, subject: ${subject}`);
      
      // Parse sender info
      const [fromName, fromEmail] = from.includes('<') 
        ? [from.split('<')[0].trim(), from.split('<')[1].replace('>', '').trim()]
        : ['', from];
      
      // Check if conversation exists for this email
      const existingConversations = await storage.getAllConversations({ search: fromEmail });
      let conversation = existingConversations[0];
      
      if (!conversation) {
        // Create new conversation
        conversation = await storage.createConversation({
          title: subject || 'Email Enquiry',
          status: 'open',
          source: 'email',
          priority: 'medium',
          lastMessageBy: 'customer',
          lastMessageAt: new Date()
        });
      }
      
      // Create message in conversation
      await storage.createConversationMessage({
        conversationId: conversation.id,
        type: 'email',
        content: text || html || '',
        direction: 'inbound',
        fromName: fromName || fromEmail,
        fromContact: fromEmail,
        subject: subject,
        platform: 'email',
        isRead: false
      });
      
      // Update conversation
      await storage.updateConversation(conversation.id, {
        lastMessageAt: new Date(),
        lastMessageBy: 'customer',
        unreadCount: (conversation.unreadCount || 0) + 1
      });
      
      res.json({ success: true, message: 'Email received and processed' });
    } catch (error) {
      console.error('Error processing incoming email:', error);
      res.status(500).json({ success: false, message: 'Error processing email' });
    }
  });

  // Facebook Messenger webhook verification (required by Facebook)
  app.get('/api/webhooks/messenger', (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'treemarkables_verify_token';
    
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Facebook webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // Facebook Messenger webhook - Receives incoming messages
  app.post('/api/webhooks/messenger', async (req: Request, res: Response) => {
    try {
      const { entry } = req.body;
      
      if (!entry || !Array.isArray(entry)) {
        res.sendStatus(200);
        return;
      }
      
      for (const item of entry) {
        if (item.messaging) {
          for (const event of item.messaging) {
            const senderId = event.sender.id;
            const recipientId = event.recipient.id;
            const messageData = event.message;
            
            if (messageData && messageData.text) {
              console.log(`💬 Facebook message from ${senderId}: ${messageData.text}`);
              
              // Find or create conversation for this sender
              const existingConversations = await storage.getAllConversations({ search: senderId });
              let conversation = existingConversations[0];
              
              if (!conversation) {
                conversation = await storage.createConversation({
                  title: 'Facebook Messenger Enquiry',
                  status: 'open',
                  source: 'social',
                  priority: 'medium',
                  lastMessageBy: 'customer',
                  lastMessageAt: new Date()
                });
              }
              
              // Create message
              await storage.createConversationMessage({
                conversationId: conversation.id,
                type: 'message',
                content: messageData.text,
                direction: 'inbound',
                fromContact: senderId,
                platform: 'facebook_messenger',
                externalId: messageData.mid,
                isRead: false
              });
              
              // Update conversation
              await storage.updateConversation(conversation.id, {
                lastMessageAt: new Date(),
                lastMessageBy: 'customer',
                unreadCount: (conversation.unreadCount || 0) + 1
              });
            }
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error('Error processing Facebook message:', error);
      res.sendStatus(500);
    }
  });

  // Web form submission endpoint
  app.post('/api/webhooks/contact-form', async (req: Request, res: Response) => {
    try {
      const { name, email, phone, message, serviceType, urgency } = req.body;
      
      console.log(`📝 Web form submission from: ${name} (${email})`);
      
      // Create conversation
      const conversation = await storage.createConversation({
        title: `Web Form: ${serviceType || 'General Enquiry'}`,
        status: 'open',
        source: 'web_form',
        priority: urgency === 'immediate' ? 'urgent' : 'medium',
        serviceType: serviceType,
        urgency: urgency,
        lastMessageBy: 'customer',
        lastMessageAt: new Date()
      });
      
      // Create message
      await storage.createConversationMessage({
        conversationId: conversation.id,
        type: 'message',
        content: message,
        direction: 'inbound',
        fromName: name,
        fromContact: email || phone,
        platform: 'web_form',
        isRead: false
      });
      
      res.json({ 
        success: true, 
        message: 'Your enquiry has been received. We\'ll contact you shortly!',
        conversationId: conversation.id
      });
    } catch (error) {
      console.error('Error processing web form:', error);
      res.status(500).json({ success: false, message: 'Error processing form submission' });
    }
  });

  // Send reply to conversation (email, messenger, etc.)
  app.post('/api/conversations/:conversationId/reply', async (req: Request, res: Response) => {
    try {
      const { conversationId } = req.params;
      const { content, type = 'message', platform, staffId } = req.body;
      
      if (!content) {
        res.status(400).json({ success: false, message: 'Content is required' });
        return;
      }
      
      // Get conversation to determine recipient
      const conversation = await storage.getConversation(conversationId);
      if (!conversation) {
        res.status(404).json({ success: false, message: 'Conversation not found' });
        return;
      }
      
      // Get the most recent inbound message to determine recipient
      const messages = await storage.getConversationMessages(conversationId);
      const lastInboundMessage = messages.filter(m => m.direction === 'inbound').sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];
      
      if (!lastInboundMessage) {
        res.status(400).json({ success: false, message: 'No recipient found for this conversation' });
        return;
      }
      
      const recipientContact = lastInboundMessage.fromContact;
      const recipientName = lastInboundMessage.fromName;
      
      // Create outbound message
      const message = await storage.createConversationMessage({
        conversationId,
        type: type as any,
        content,
        direction: 'outbound',
        toName: recipientName,
        toContact: recipientContact,
        staffId,
        platform: platform || lastInboundMessage.platform,
        deliveryStatus: 'pending'
      });
      
      // Send based on platform
      const messagePlatform = platform || lastInboundMessage.platform;
      
      if (messagePlatform === 'email') {
        // Send email using SendGrid
        try {
          const sgMail = require('@sendgrid/mail');
          const apiKey = process.env.SENDGRID_API_KEY;
          
          if (apiKey) {
            sgMail.setApiKey(apiKey);
            
            await sgMail.send({
              to: recipientContact,
              from: process.env.SENDGRID_FROM_EMAIL || 'info@treemarkables.co.nz',
              subject: lastInboundMessage.subject ? `Re: ${lastInboundMessage.subject}` : 'Response to your enquiry',
              text: content,
              html: content.replace(/\n/g, '<br>')
            });
            
            await storage.updateConversationMessage(message.id, {
              deliveryStatus: 'delivered'
            });
            
            console.log(`📧 Email sent to ${recipientContact}`);
          } else {
            console.warn('⚠️ SendGrid API key not configured');
            await storage.updateConversationMessage(message.id, {
              deliveryStatus: 'failed'
            });
          }
        } catch (emailError) {
          console.error('Error sending email:', emailError);
          await storage.updateConversationMessage(message.id, {
            deliveryStatus: 'failed'
          });
        }
      } else if (messagePlatform === 'facebook_messenger') {
        // Send Facebook message
        try {
          const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
          
          if (pageAccessToken) {
            const response = await fetch(
              `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  recipient: { id: recipientContact },
                  message: { text: content }
                })
              }
            );
            
            if (response.ok) {
              await storage.updateConversationMessage(message.id, {
                deliveryStatus: 'delivered'
              });
              console.log(`💬 Facebook message sent to ${recipientContact}`);
            } else {
              await storage.updateConversationMessage(message.id, {
                deliveryStatus: 'failed'
              });
            }
          } else {
            console.warn('⚠️ Facebook Page Access Token not configured');
            await storage.updateConversationMessage(message.id, {
              deliveryStatus: 'failed'
            });
          }
        } catch (fbError) {
          console.error('Error sending Facebook message:', fbError);
          await storage.updateConversationMessage(message.id, {
            deliveryStatus: 'failed'
          });
        }
      }
      
      // Update conversation
      await storage.updateConversation(conversationId, {
        lastMessageAt: new Date(),
        lastMessageBy: 'staff'
      });
      
      res.json({ success: true, data: message });
    } catch (error) {
      console.error('Error sending reply:', error);
      res.status(500).json({ success: false, message: 'Error sending reply' });
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
      const { customerId, quoteId, jobId } = req.query;
      
      let proposals;
      if (customerId) {
        proposals = await storage.getProposalsByCustomer(customerId as string);
      } else if (quoteId) {
        proposals = await storage.getProposalsByQuote(quoteId as string);
      } else if (jobId) {
        proposals = await storage.getProposalsByJob(jobId as string);
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
      
      // If proposal is associated with a job, create a diary entry
      // Note: jobId is not part of insertProposalSchema, so use original request body
      if (req.body.jobId) {
        try {
          console.log(`Creating diary entry for proposal ${proposal.proposalNumber} in job ${req.body.jobId}`);
          await storage.createJobDiaryEntry({
            jobId: req.body.jobId,
            entryType: 'proposal',
            title: `Proposal Created: ${proposal.proposalNumber}`,
            description: `New proposal "${proposal.title}" has been created and is ready for review.`,
            authorName: proposal.createdBy || 'System',
            authorRole: 'system',
            isPrivate: false
          });
          console.log(`Successfully created diary entry for proposal ${proposal.proposalNumber}`);
        } catch (diaryError) {
          // Log the error but don't fail the proposal creation
          console.error('Error creating diary entry for proposal:', diaryError);
        }
      } else {
        console.log('No jobId provided - skipping diary entry creation');
      }
      
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

  // Accept proposal - converts to work order and creates notification
  app.post('/api/proposals/:id/accept', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Get the proposal
      const proposal = await storage.getProposal(id);
      if (!proposal) {
        return res.status(404).json({ success: false, message: 'Proposal not found' });
      }

      // Check if already accepted
      if (proposal.status === 'accepted') {
        return res.status(400).json({ success: false, message: 'Proposal has already been accepted' });
      }

      // Check if expired
      if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
        return res.status(400).json({ success: false, message: 'Proposal has expired' });
      }

      // Update proposal status to accepted
      const updatedProposal = await storage.updateProposal(id, { 
        status: 'accepted',
        acceptedDate: new Date()
      });

      // Create work order (job) from proposal
      const jobData = {
        title: `Work Order from Proposal #${proposal.proposalNumber}`,
        description: proposal.description || `Work based on accepted proposal #${proposal.proposalNumber}`,
        customerId: proposal.customerId,
        leadId: proposal.leadId,
        quoteId: proposal.quoteId,
        status: 'work_order',
        priority: 'medium',
        totalAmount: proposal.totalAmount,
        subtotal: proposal.subtotal,
        gstAmount: (proposal.totalAmount || 0) - (proposal.subtotal || 0),
        jobType: 'proposal-conversion',
        proposalId: id,
        metricsEligible: true,
        metricsStartDate: new Date()
      };

      // Generate job number
      const jobNumber = await storage.getNextJobNumber();
      const job = await storage.createJob({ ...jobData, jobNumber });

      // Create notification for business owner
      const customer = proposal.customerId ? await storage.getCustomer(proposal.customerId) : null;
      const notificationData = {
        title: 'Proposal Accepted!',
        message: `${customer?.name || 'Customer'} has accepted proposal #${proposal.proposalNumber} for ${new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(proposal.totalAmount || 0)}. Work order #${jobNumber} has been created.`,
        type: 'proposal_accepted',
        priority: 'high',
        isRead: false,
        entityType: 'proposal',
        entityId: id,
        relatedEntityType: 'job',
        relatedEntityId: job.id
      };

      await storage.createNotification(notificationData);

      console.log(`✅ Proposal ${proposal.proposalNumber} accepted and converted to work order ${jobNumber}`);

      res.json({ 
        success: true, 
        data: { 
          proposal: updatedProposal, 
          workOrder: job,
          message: 'Proposal accepted successfully and work order created'
        }
      });
    } catch (error) {
      console.error('Error accepting proposal:', error);
      res.status(500).json({ success: false, message: 'Error accepting proposal' });
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

  // ========================================
  // MATERIALS & SERVICES CATALOG API
  // ========================================

  // Materials & Services mock data (matches MaterialsServices.tsx)
  const materialsAndServices = [
    // Materials
    { id: "1", itemNumber: "VIP", name: "10% discount with VIP membership", price: 0.00, category: "Discount", type: "material" },
    { id: "2", itemNumber: "Admin Time", name: "Admin Time", price: 0.00, category: "Labour", type: "material" },
    { id: "3", itemNumber: "41", name: "Wood chipper rental", price: 400.00, category: "Equipment", type: "material" },
    { id: "4", itemNumber: "17", name: "Bucket truck", price: 80.00, category: "Equipment", type: "material" },
    { id: "5", itemNumber: "11", name: "Call out", price: 100.00, category: "Service", type: "material" },
    { id: "6", itemNumber: "29 labour", name: "Dan labour", price: 55.00, category: "Labour", type: "material" },
    { id: "7", itemNumber: "SERVICEM8-36", name: "Day 1", price: 0.00, category: "Service", type: "material" },
    { id: "8", itemNumber: "SERVICEM8-54", name: "Day 1", price: 0.00, category: "Service", type: "material" },
    { id: "9", itemNumber: "67", name: "Digger and truck", price: 890.00, category: "Equipment", type: "material" },
    { id: "10", itemNumber: "39", name: "Disposal", price: 250.00, category: "Service", type: "material" },
    { id: "11", itemNumber: "34", name: "Labour", price: 75.00, category: "Labour", type: "material" },
    { id: "12", itemNumber: "35", name: "Senior Labour", price: 95.00, category: "Labour", type: "material" },
    { id: "13", itemNumber: "36", name: "Apprentice Labour", price: 45.00, category: "Labour", type: "material" },
    
    // Services  
    { id: "s1", itemNumber: "TS-001", name: "Tree Removal - Small (under 5m)", price: 250.00, category: "Tree Services", type: "service" },
    { id: "s2", itemNumber: "TS-002", name: "Tree Removal - Medium (5-10m)", price: 650.00, category: "Tree Services", type: "service" },
    { id: "s3", itemNumber: "TS-003", name: "Tree Removal - Large (10m+)", price: 1250.00, category: "Tree Services", type: "service" },
    { id: "s4", itemNumber: "MT-001", name: "Hedge Trimming", price: 85.00, category: "Maintenance", type: "service" },
    { id: "s5", itemNumber: "TS-004", name: "Stump Grinding", price: 180.00, category: "Tree Services", type: "service" },
  ];

  // Skills to line item category mapping
  const skillToCategory = {
    // Equipment operators
    'Crane Operation': ['Equipment'],
    'Cherry Picker': ['Equipment'],
    'Heavy Machinery': ['Equipment'],
    'Chipper Operation': ['Equipment'],
    
    // Tree service skills
    'Tree Climbing': ['Tree Services', 'Labour'],
    'Chainsaw Operation': ['Tree Services', 'Labour'],
    'Tree Pruning': ['Tree Services', 'Maintenance'],
    'Hedge Trimming': ['Maintenance'],
    'Stump Grinding': ['Tree Services'],
    
    // General labour
    'Ground Support': ['Labour', 'Service'],
    'Customer Service': ['Service'],
    'Risk Assessment': ['Labour', 'Service'],
    'Safety Management': ['Labour', 'Service'],
    'First Aid': ['Labour', 'Service'],
    'Plant Health': ['Tree Services', 'Maintenance'],
  };

  // GET /api/materials-services - Get all materials and services
  app.get('/api/materials-services', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: materialsAndServices
      });
    } catch (error) {
      console.error('Error fetching materials and services:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching materials and services'
      });
    }
  });

  // GET /api/materials-services/filtered/:employeeId - Get line items filtered by employee skills
  app.get('/api/materials-services/filtered/:employeeId', async (req: Request, res: Response) => {
    try {
      const { employeeId } = req.params;
      
      // Get employee details with skills
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({
          success: false,
          message: 'Employee not found'
        });
      }

      // For now, use mock skills data from CrewManagement
      // In production, this would come from the employee record
      const mockEmployeeSkills: { [key: string]: string[] } = {
        '1': ['Tree Climbing', 'Chainsaw Operation', 'Risk Assessment', 'First Aid'],
        '2': ['Tree Pruning', 'Hedge Trimming', 'Plant Health', 'Customer Service'],
        '3': ['Crane Operation', 'Cherry Picker', 'Heavy Machinery', 'Safety Management'],
      };

      const employeeSkills = mockEmployeeSkills[employeeId] || [];
      
      // Get categories this employee can work with based on their skills
      const allowedCategories = new Set<string>();
      employeeSkills.forEach(skill => {
        const categories = skillToCategory[skill] || [];
        categories.forEach(cat => allowedCategories.add(cat));
      });

      // If no skills mapped, allow Labour and Service as default
      if (allowedCategories.size === 0) {
        allowedCategories.add('Labour');
        allowedCategories.add('Service');
      }

      // Filter line items to only show those matching employee's skills
      const filteredItems = materialsAndServices.filter(item => 
        allowedCategories.has(item.category)
      );

      res.json({
        success: true,
        data: filteredItems,
        employeeSkills,
        allowedCategories: Array.from(allowedCategories)
      });
    } catch (error) {
      console.error('Error fetching filtered materials and services:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching filtered materials and services'
      });
    }
  });

  // =====================================
  // ServiceM8 Integration API Routes
  // =====================================

  // GET /api/servicem8/test - Test ServiceM8 API connection
  app.get('/api/servicem8/test', async (req: Request, res: Response) => {
    try {
      const result = await servicem8Service.testConnection();
      res.json(result);
    } catch (error) {
      console.error('ServiceM8 test connection error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test ServiceM8 connection'
      });
    }
  });

  // POST /api/servicem8/import/customers - Import customers from ServiceM8
  app.post('/api/servicem8/import/customers', async (req: Request, res: Response) => {
    try {
      const result = await servicem8Service.importCustomers();
      res.json(result);
    } catch (error) {
      console.error('ServiceM8 customers import error:', error);
      res.status(500).json({
        success: false,
        imported: 0,
        errors: ['Failed to import customers from ServiceM8']
      });
    }
  });

  // POST /api/servicem8/update/customer-names - Update existing customer names with improved ServiceM8 data
  app.post('/api/servicem8/update/customer-names', async (req: Request, res: Response) => {
    try {
      const result = await servicem8Service.updateExistingCustomerNames();
      res.json(result);
    } catch (error) {
      console.error('ServiceM8 customer names update error:', error);
      res.status(500).json({
        success: false,
        updated: 0,
        errors: ['Failed to update customer names from ServiceM8']
      });
    }
  });

  // POST /api/servicem8/import/jobs - Import jobs from ServiceM8
  app.post('/api/servicem8/import/jobs', async (req: Request, res: Response) => {
    try {
      const result = await servicem8Service.importJobs();
      res.json(result);
    } catch (error) {
      console.error('ServiceM8 jobs import error:', error);
      res.status(500).json({
        success: false,
        imported: 0,
        errors: ['Failed to import jobs from ServiceM8']
      });
    }
  });

  // POST /api/admin/clear-data - Clear all jobs and customers (for fresh imports)
  app.post('/api/admin/clear-data', async (req: Request, res: Response) => {
    try {
      // Delete all jobs first (due to foreign key constraints)
      const deletedJobs = await storage.clearAllJobs();
      
      // Then delete all customers
      const deletedCustomers = await storage.clearAllCustomers();
      
      res.json({
        success: true,
        message: 'All data cleared successfully',
        deleted: {
          jobs: deletedJobs,
          customers: deletedCustomers
        }
      });
    } catch (error) {
      console.error('Error clearing data:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error clearing data'
      });
    }
  });

  // POST /api/jobs/import-csv - Import jobs from CSV file upload
  app.post('/api/jobs/import-csv', upload.single('csvFile'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No CSV file provided'
        });
      }

      // Parse CSV file
      const csvContent = req.file.buffer.toString('utf-8');
      
      const parseResult = Papa.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        dynamicTyping: false,
        fastMode: false
      });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'CSV parsing errors',
          errors: parseResult.errors.map((e: any) => e.message)
        });
      }

      const jobs = parseResult.data;
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      let errors = 0;
      const errorMessages: string[] = [];
      const importedJobIds: string[] = [];

      // Get all existing customers and jobs for matching
      const existingCustomers = await storage.getAllCustomers();
      const existingJobs = await storage.getAllJobs();
      const customerByName = new Map(existingCustomers.map(c => [c.name.toLowerCase().trim(), c]));
      const jobByJobNumber = new Map(existingJobs.map(j => [j.jobNumber, j]));

      console.log('\n🔥🔥🔥 CSV IMPORT STARTING 🔥🔥🔥');
      console.log('📊 Total jobs to import:', jobs.length);
      console.log('📋 CSV Column Headers:', Object.keys(jobs[0] || {}));
      console.log('📝 Sample Row Data:', jobs[0]);
      console.log('🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥\n');

      for (const csvJob of jobs) {
        try {
          // Type the CSV job data for proper TypeScript handling
          const jobData = csvJob as any;
          
          // Find customer by name (or create if needed)
          const customerName = (jobData.customerName || jobData.companyName || jobData.company || jobData['Company'] || jobData['Customer Name'] || jobData['Company Name'] || 
                              jobData.client || jobData.Client || jobData.customer || jobData.Customer || '').trim();
          
          let customer = customerByName.get(customerName.toLowerCase());

          if (!customer && customerName) {
            // Create new customer if not found - Map ServiceM8 contact fields
            const customerEmail = jobData['Job Email Address'] || jobData['Billing Email Address'] || jobData.customerEmail || jobData.email || '';
            const customerPhone = jobData['Job Telephone Number'] || jobData['Job Contact Mobile Number'] || jobData['Billing Telephone Number'] || jobData['Billing Contact Mobile Number'] || jobData.customerPhone || jobData.phone || '';
            const customerAddress = jobData['Job Address'] || jobData['Billing Address'] || jobData.customerAddress || jobData.address || '';
            
            customer = await storage.createCustomer({
              name: customerName,
              email: customerEmail,
              phone: customerPhone,
              address: customerAddress
            });
            customerByName.set(customerName.toLowerCase(), customer);
          }

          // If still no customer, create a default one based on job info
          if (!customer) {
            const defaultCustomerName = `Customer for Job ${jobData.jobNumber || jobData['Job Number'] || `JOB-${Date.now()}`}`;
            const customerEmail = jobData['Job Email Address'] || jobData['Billing Email Address'] || jobData.customerEmail || jobData.email || '';
            const customerPhone = jobData['Job Telephone Number'] || jobData['Job Contact Mobile Number'] || jobData['Billing Telephone Number'] || jobData['Billing Contact Mobile Number'] || jobData.customerPhone || jobData.phone || '';
            const customerAddress = jobData['Job Address'] || jobData['Billing Address'] || jobData.customerAddress || jobData.address || jobData.location || '';
            
            customer = await storage.createCustomer({
              name: defaultCustomerName,
              email: customerEmail,
              phone: customerPhone,
              address: customerAddress
            });
            customerByName.set(defaultCustomerName.toLowerCase(), customer);
          }

          // Create job with proper field mapping for ServiceM8 data
          // Map ServiceM8 specific column names to our fields
          const jobAddress = jobData['Job Address'] || jobData.location || jobData.address || jobData.customerAddress || jobData.jobAddress || '';
          const safeAddress = (jobAddress && jobAddress.trim()) ? jobAddress.trim() : 'Address not specified';
          
          // Map ServiceM8 job description 
          const jobDescription = jobData['Description of work'] || jobData.description || jobData.Description || jobData.notes || '';
          
          // Map ServiceM8 contact information
          const jobEmail = jobData['Job Email Address'] || jobData.customerEmail || jobData.email || '';
          const jobPhone = jobData['Job Telephone Number'] || jobData['Job Contact Mobile Number'] || jobData.customerPhone || jobData.phone || '';
          
          // Extract job status from ServiceM8 'Job Status' field
          const jobStatus = jobData['Job Status'] || jobData.status || 'pending';
          
          // Map ServiceM8 financial data - "Total Invoice" column
          const totalInvoice = jobData['Total Invoice'] || jobData.invoiceAmount || jobData['Invoice Amount'] || jobData.totalAmount || '0';
          const invoiceAmount = parseFloat(totalInvoice.toString().replace(/[^0-9.-]/g, '')) || 0;
          
          // Map payment/paid amount if available
          const paidAmount = jobData['Paid Amount'] || jobData.paidAmount || jobData['Amount Paid'] || '0';
          const paid = parseFloat(paidAmount.toString().replace(/[^0-9.-]/g, '')) || 0;
          
          // Map invoice number - auto-generate if empty but job has been invoiced
          let importedInvoiceNumber = jobData['Invoice No'] || jobData['Invoice Number'] || jobData.invoiceNumber || jobData['Invoice #'] || jobData.invoice || '';
          
          // If invoice number is empty but job has been invoiced, generate one
          const invoiceSent = jobData['Invoice Sent'];
          const invoiceDate = jobData['Invoice Date'];
          const jobNum = jobData.jobNumber || jobData['Job Number'] || 'UNKNOWN';
          
          // Debug logging for first job only
          if (jobNum === '1587') {
            console.log('🔍 DEBUG Job 1587:');
            console.log('  - importedInvoiceNumber:', importedInvoiceNumber);
            console.log('  - !importedInvoiceNumber:', !importedInvoiceNumber);
            console.log('  - invoiceSent:', invoiceSent);
            console.log('  - invoiceSent === "1":', invoiceSent === '1');
            console.log('  - invoiceDate:', invoiceDate);
            console.log('  - invoiceDate !== "0000-00-00 00:00:00":', invoiceDate !== '0000-00-00 00:00:00');
          }
          
          if (!importedInvoiceNumber && invoiceSent === '1' && invoiceDate && invoiceDate !== '0000-00-00 00:00:00') {
            importedInvoiceNumber = `INV-${jobNum}`;
            console.log(`🔖 Auto-generated invoice number for job ${jobNum}: ${importedInvoiceNumber}`);
          }
          
          // Set to null if still empty
          if (!importedInvoiceNumber) {
            importedInvoiceNumber = null;
          }
          
          const jobNumber = jobData.jobNumber || jobData['Job Number'] || `JOB-${Date.now()}`;
          const jobPayload = {
            jobNumber: jobNumber,
            title: jobData.title || jobDescription || 'Imported Job',
            description: jobDescription,
            customerId: customer.id,
            status: jobStatus.toLowerCase(),
            priority: jobData.priority || 'medium',
            scheduledDate: jobData.scheduledDate || jobData['Scheduled Date'] || null,
            address: safeAddress,
            duration: parseInt(jobData.duration || '60') || 60,
            assignedTeam: jobData.teamMembers ? jobData.teamMembers.split(',').map((m: string) => m.trim()) : [],
            equipment: jobData.equipment ? jobData.equipment.split(',').map((e: string) => e.trim()) : [],
            totalAmount: invoiceAmount.toString(),
            paidAmount: paid.toString(),
            invoiceNumber: importedInvoiceNumber,
            servicem8Uuid: jobData.servicem8Uuid || jobData['ServiceM8 UUID'] || null
          };

          // Check if job already exists
          const existingJob = jobByJobNumber.get(jobNumber);
          
          if (existingJob) {
            // Update existing job
            await storage.updateJob(existingJob.id, jobPayload);
            importedJobIds.push(existingJob.id);
            updated++;
          } else {
            // Create new job
            const newJob = await storage.createJob(jobPayload);
            importedJobIds.push(newJob.id);
            jobByJobNumber.set(newJob.jobNumber, newJob);
            imported++;
          }

        } catch (error) {
          errors++;
          const errorMsg = `Row ${jobs.indexOf(csvJob) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          errorMessages.push(errorMsg);
          console.error('Error importing job:', error);
        }
      }

      res.json({
        success: true,
        data: {
          imported,
          updated,
          skipped,
          errors: errorMessages.length,
          totalProcessed: jobs.length,
          batchId: `import-${Date.now()}`,
          importedJobIds,
          errors: errorMessages
        }
      });

    } catch (error) {
      console.error('Error importing jobs from CSV:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Error importing jobs'
      });
    }
  });

  // POST /api/jobs/import-servicem8 - Import jobs from ServiceM8 CSV file
  app.post('/api/jobs/import-servicem8', async (req: Request, res: Response) => {
    try {
      const { jobs } = req.body;
      
      if (!jobs || !Array.isArray(jobs)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid jobs data provided'
        });
      }

      let successfulMatches = 0;
      let updatedJobs = 0;
      let skippedJobs = 0;
      let newCustomers = 0;
      let errors = 0;
      const errorMessages: string[] = [];
      const importedJobIds: string[] = [];

      // Get all existing customers and jobs for matching
      const existingCustomers = await storage.getAllCustomers();
      const existingJobs = await storage.getAllJobs();
      
      // Create maps for efficient lookup by both name and ServiceM8 UUID
      const customerByName = new Map(existingCustomers.map(c => [c.name.toLowerCase().trim(), c]));
      const customerByServiceM8Uuid = new Map(
        existingCustomers
          .filter(c => c.servicem8Uuid)
          .map(c => [c.servicem8Uuid!, c])
      );
      const jobByJobNumber = new Map(existingJobs.map(j => [j.jobNumber, j]));

      for (const csvJob of jobs) {
        try {
          let customer = null;
          
          // Extract ServiceM8 UUID from job data (can be in different fields)
          const servicem8Uuid = csvJob.companyUuid || csvJob['Company UUID'] || csvJob.servicem8Uuid;
          
          // First try to find customer by ServiceM8 UUID if available
          if (servicem8Uuid) {
            customer = customerByServiceM8Uuid.get(servicem8Uuid);
          }
          
          // If not found by UUID, try to find by company name
          if (!customer && csvJob.company) {
            customer = customerByName.get(csvJob.company.toLowerCase().trim());
            
            // If found by name but needs ServiceM8 UUID, update it
            if (customer && servicem8Uuid && !customer.servicem8Uuid) {
              await storage.updateCustomer(customer.id, {
                servicem8Uuid: servicem8Uuid
              });
              customer.servicem8Uuid = servicem8Uuid;
              customerByServiceM8Uuid.set(servicem8Uuid, customer);
            }
          }
          
          if (!customer) {
            // Create new customer from job data
            const newCustomer = {
              name: csvJob.company || 'Unknown Customer',
              email: csvJob.email || null,
              phone: csvJob.phone || csvJob.mobile || null,
              address: csvJob.address || null,
              source: csvJob.source || 'servicem8_import',
              lifetimeValue: parseFloat(csvJob.invoiceAmount || '0').toString(),
              totalJobs: 1,
              servicem8Uuid: servicem8Uuid || undefined
            };

            customer = await storage.createCustomer(newCustomer);
            customerByName.set(customer.name.toLowerCase().trim(), customer);
            if (servicem8Uuid) {
              customerByServiceM8Uuid.set(servicem8Uuid, customer);
            }
            newCustomers++;
          } else {
            // Update customer lifetime value and job count
            const currentValue = parseFloat(customer.lifetimeValue || '0');
            const jobValue = parseFloat(csvJob.invoiceAmount || '0');
            const newValue = currentValue + jobValue;
            
            await storage.updateCustomer(customer.id, {
              lifetimeValue: newValue.toString(),
              totalJobs: (customer.totalJobs || 0) + 1,
              lastContactDate: csvJob.completionDate && csvJob.completionDate !== '0000-00-00 00:00:00' ? 
                new Date(csvJob.completionDate) : customer.lastContactDate
            });
          }

          // Create job
          // Filter out bad timestamp data from descriptions
          const cleanDescription = (() => {
            const rawDesc = csvJob.description || csvJob.workCompleted || '';
            // Filter out timestamp patterns and other invalid data
            if (rawDesc.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/) || 
                rawDesc === '0000-00-00 00:00:00' || 
                rawDesc.trim() === '') {
              return '';
            }
            return rawDesc;
          })();
          
          // Map financial data from ServiceM8 CSV
          const totalInvoiceAmount = parseFloat(csvJob.invoiceAmount || csvJob['Total Invoice'] || '0');
          const paidAmountValue = parseFloat(csvJob.paidAmount || csvJob['Paid Amount'] || '0');
          
          // Map invoice number - auto-generate if empty but job has been invoiced
          let invoiceNum = csvJob['Invoice No'] || csvJob.invoiceNumber || csvJob['Invoice Number'] || csvJob['Invoice #'] || csvJob.invoice || '';
          
          // If invoice number is empty but job has been invoiced, generate one
          if (!invoiceNum && csvJob.invoiceSent === '1' && csvJob.invoiceDate && csvJob.invoiceDate !== '0000-00-00 00:00:00') {
            invoiceNum = `INV-${csvJob.jobNumber}`;
          }
          
          // Set to null if still empty
          if (!invoiceNum) {
            invoiceNum = null;
          }
          
          const jobData = {
            customerId: customer.id,
            jobNumber: csvJob.jobNumber,
            title: cleanDescription ? cleanDescription.substring(0, 100) : `Job #${csvJob.jobNumber}`,
            description: cleanDescription,
            address: csvJob.address || customer.address || '',
            status: csvJob.status.toLowerCase() === 'completed' ? 'completed' : 
                   csvJob.status.toLowerCase() === 'unsuccessful' ? 'unsuccessful' : 'work_order',
            priority: 'medium',
            leadSource: csvJob.source || 'servicem8_import',
            totalAmount: totalInvoiceAmount.toString(),
            paidAmount: paidAmountValue.toString(),
            estimatedValue: totalInvoiceAmount,
            actualCost: parseFloat(csvJob.totalCost || '0'),
            scheduledDate: csvJob.workOrderDate && csvJob.workOrderDate !== '0000-00-00 00:00:00' ? 
              new Date(csvJob.workOrderDate) : null,
            completedDate: csvJob.completionDate && csvJob.completionDate !== '0000-00-00 00:00:00' ? 
              new Date(csvJob.completionDate) : null,
            assignedTo: csvJob.completedBy || 'Imported Staff',
            invoiceNumber: invoiceNum,
            servicem8JobId: csvJob.jobNumber, // Store original ServiceM8 job number
            paymentMethod: csvJob.paymentMethod
          };

          // Check if job already exists
          const existingJob = jobByJobNumber.get(csvJob.jobNumber);
          
          if (existingJob) {
            // Update existing job
            await storage.updateJob(existingJob.id, jobData);
            importedJobIds.push(existingJob.id);
            updatedJobs++;
          } else {
            // Create new job
            const createdJob = await storage.createJob(jobData);
            importedJobIds.push(createdJob.id);
            jobByJobNumber.set(createdJob.jobNumber, createdJob);
            successfulMatches++;
          }
          
        } catch (jobError) {
          errors++;
          console.error(`Error importing job ${csvJob.jobNumber}:`, jobError);
          errorMessages.push(`Job ${csvJob.jobNumber}: ${(jobError as Error).message}`);
        }
      }

      res.json({
        success: true,
        message: `Imported ${successfulMatches} new jobs, updated ${updatedJobs} existing jobs`,
        stats: {
          totalJobs: jobs.length,
          processedJobs: jobs.length,
          successfulMatches,
          updatedJobs,
          skippedJobs,
          newCustomers,
          errors
        },
        data: {
          success: true,
          totalRows: jobs.length,
          successfulImports: successfulMatches,
          updatedJobs,
          skippedJobs,
          errors: errorMessages.map((msg, index) => ({
            row: index + 1,
            error: msg,
            data: jobs[index]
          })),
          importedIds: importedJobIds
        },
        errorMessages: errorMessages.slice(0, 10) // Limit to first 10 errors
      });
      
    } catch (error) {
      console.error('ServiceM8 CSV jobs import error:', error);
      res.status(500).json({
        success: false,
        stats: {
          totalJobs: 0,
          processedJobs: 0,
          successfulMatches: 0,
          newCustomers: 0,
          errors: 1
        },
        message: 'Failed to import jobs from ServiceM8 CSV'
      });
    }
  });

  // POST /api/servicem8/import/all - Import all data from ServiceM8
  app.post('/api/servicem8/import/all', async (req: Request, res: Response) => {
    try {
      const result = await servicem8Service.importAll();
      res.json(result);
    } catch (error) {
      console.error('ServiceM8 full import error:', error);
      res.status(500).json({
        success: false,
        customers: { imported: 0, errors: [] },
        jobs: { imported: 0, errors: [] },
        message: 'Failed to import data from ServiceM8'
      });
    }
  });

  // POST /api/servicem8/sync - Sync existing data with complete ServiceM8 information
  app.post('/api/servicem8/sync', async (req: Request, res: Response) => {
    try {
      const result = await servicem8Service.syncExistingData();
      res.json(result);
    } catch (error) {
      console.error('ServiceM8 sync error:', error);
      res.status(500).json({
        success: false,
        customers: { updated: 0, errors: [] },
        jobs: { updated: 0, errors: [] },
        message: 'Failed to sync data with ServiceM8'
      });
    }
  });


  // Materials and Services API
  app.get("/api/materials-services", async (req: Request, res: Response) => {
    try {
      // Mock data matching MaterialsServices.tsx
      const mockMaterials = [
        {
          id: "1",
          itemNumber: "VIP",
          name: "10% discount with VIP membership",
          price: 0.00,
          priceIncludesTax: false,
          taxRate: "No GST",
          category: "Discount",
          type: "material"
        },
        {
          id: "2", 
          itemNumber: "Admin Time",
          name: "Admin Time",
          price: 0.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Labour",
          type: "material"
        },
        {
          id: "3",
          itemNumber: "41",
          name: "Wood chipper rental",
          price: 400.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Equipment",
          type: "material"
        },
        {
          id: "4",
          itemNumber: "17",
          name: "Bucket truck",
          price: 80.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Equipment",
          type: "material"
        },
        {
          id: "5",
          itemNumber: "11",
          name: "Call out",
          price: 100.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Service",
          type: "material"
        },
        {
          id: "6",
          itemNumber: "29 labour",
          name: "Dan labour",
          price: 55.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Labour",
          type: "material"
        },
        {
          id: "7",
          itemNumber: "labour 22",
          name: "labour Tree care service",
          price: 250.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Labour",
          type: "material"
        },
        {
          id: "8",
          itemNumber: "67",
          name: "Digger and truck",
          price: 890.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Equipment",
          type: "material"
        },
        {
          id: "9",
          itemNumber: "39",
          name: "Disposal",
          price: 250.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          category: "Service",
          type: "material"
        }
      ];

      const mockServices = [
        {
          id: "service-1",
          itemNumber: "TR-SM",
          name: "Tree Removal - Small (under 5m)",
          category: "Tree Services",
          price: 250.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          unit: "per tree",
          description: "Complete removal including stump grinding",
          type: "service"
        },
        {
          id: "service-2",
          itemNumber: "TR-MD",
          name: "Tree Removal - Medium (5-10m)", 
          category: "Tree Services",
          price: 650.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          unit: "per tree",
          description: "Complete removal including stump grinding",
          type: "service"
        },
        {
          id: "service-3",
          itemNumber: "TR-LG",
          name: "Tree Removal - Large (10m+)",
          category: "Tree Services", 
          price: 1250.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          unit: "per tree",
          description: "Complex removal with crane assistance if needed",
          type: "service"
        },
        {
          id: "service-4",
          itemNumber: "HT-01",
          name: "Hedge Trimming",
          category: "Maintenance",
          price: 85.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          unit: "per hour",
          description: "Professional hedge shaping and maintenance",
          type: "service"
        },
        {
          id: "service-5",
          itemNumber: "SG-01",
          name: "Stump Grinding",
          category: "Tree Services",
          price: 180.00,
          priceIncludesTax: false,
          taxRate: "15% GST on Income",
          unit: "per stump",
          description: "Complete stump removal and cleanup",
          type: "service"
        }
      ];

      // Combine materials and services
      const allItems = [...mockMaterials, ...mockServices];

      // Filter based on query parameters
      const searchQuery = req.query.search as string;
      const categoryFilter = req.query.category as string;
      const typeFilter = req.query.type as string; // 'material' or 'service'

      let filteredItems = allItems;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredItems = filteredItems.filter(item => 
          item.name.toLowerCase().includes(query) || 
          item.itemNumber.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        );
      }

      if (categoryFilter && categoryFilter !== 'all') {
        filteredItems = filteredItems.filter(item => item.category === categoryFilter);
      }

      if (typeFilter && typeFilter !== 'all') {
        filteredItems = filteredItems.filter(item => item.type === typeFilter);
      }

      res.json({
        success: true,
        data: filteredItems,
        total: filteredItems.length
      });
    } catch (error) {
      console.error('Error fetching materials and services:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to fetch materials and services' 
      });
    }
  });

  // ============================================
  // MATERIALS CATALOG MANAGEMENT ROUTES
  // ============================================

  // Get all materials
  app.get('/api/materials', async (req: Request, res: Response) => {
    try {
      const materials = await storage.getAllMaterials();
      res.json({ success: true, data: materials });
    } catch (error) {
      console.error('Error fetching materials:', error);
      res.status(500).json({ success: false, message: 'Error fetching materials' });
    }
  });

  // Create material
  app.post('/api/materials', async (req: Request, res: Response) => {
    try {
      const validation = z.object({
        itemNumber: z.string().min(1, "Item number is required"),
        name: z.string().min(1, "Name is required"),
        price: z.coerce.number().nonnegative("Price must be a non-negative number"),
        priceIncludesTax: z.boolean(),
        taxRate: z.string().min(1, "Tax rate is required"),
        category: z.string().min(1, "Category is required"),
      }).safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid material data',
          errors: validation.error.errors 
        });
      }

      const material = await storage.createMaterial({
        ...validation.data,
        price: validation.data.price.toString(),
      });
      res.json({ success: true, data: material });
    } catch (error) {
      console.error('Error creating material:', error);
      res.status(500).json({ success: false, message: 'Error creating material' });
    }
  });

  // Update material
  app.put('/api/materials/:id', async (req: Request, res: Response) => {
    try {
      const validation = z.object({
        itemNumber: z.string().min(1).optional(),
        name: z.string().min(1).optional(),
        price: z.coerce.number().nonnegative().optional(),
        priceIncludesTax: z.boolean().optional(),
        taxRate: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
      }).safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid material data',
          errors: validation.error.errors 
        });
      }

      const updates = validation.data;
      if (updates.price !== undefined) {
        (updates as any).price = updates.price.toString();
      }

      const material = await storage.updateMaterial(req.params.id, updates);
      res.json({ success: true, data: material });
    } catch (error) {
      console.error('Error updating material:', error);
      res.status(500).json({ success: false, message: 'Error updating material' });
    }
  });

  // Delete material
  app.delete('/api/materials/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteMaterial(req.params.id);
      res.json({ success: true, message: 'Material deleted successfully' });
    } catch (error) {
      console.error('Error deleting material:', error);
      res.status(500).json({ success: false, message: 'Error deleting material' });
    }
  });

  // ============================================
  // SERVICES CATALOG MANAGEMENT ROUTES
  // ============================================

  // Get all services
  app.get('/api/services', async (req: Request, res: Response) => {
    try {
      const services = await storage.getAllServices();
      res.json({ success: true, data: services });
    } catch (error) {
      console.error('Error fetching services:', error);
      res.status(500).json({ success: false, message: 'Error fetching services' });
    }
  });

  // Create service
  app.post('/api/services', async (req: Request, res: Response) => {
    try {
      const validation = z.object({
        name: z.string().min(1, "Service name is required"),
        category: z.string().min(1, "Category is required"),
        basePrice: z.coerce.number().nonnegative("Base price must be a non-negative number"),
        unit: z.string().min(1, "Unit is required"),
        description: z.string().optional(),
      }).safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid service data',
          errors: validation.error.errors 
        });
      }

      const service = await storage.createService({
        ...validation.data,
        basePrice: validation.data.basePrice.toString(),
      });
      res.json({ success: true, data: service });
    } catch (error) {
      console.error('Error creating service:', error);
      res.status(500).json({ success: false, message: 'Error creating service' });
    }
  });

  // Update service
  app.put('/api/services/:id', async (req: Request, res: Response) => {
    try {
      const validation = z.object({
        name: z.string().min(1).optional(),
        category: z.string().min(1).optional(),
        basePrice: z.coerce.number().nonnegative().optional(),
        unit: z.string().min(1).optional(),
        description: z.string().optional(),
      }).safeParse(req.body);

      if (!validation.success) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid service data',
          errors: validation.error.errors 
        });
      }

      const updates = validation.data;
      if (updates.basePrice !== undefined) {
        (updates as any).basePrice = updates.basePrice.toString();
      }

      const service = await storage.updateService(req.params.id, updates);
      res.json({ success: true, data: service });
    } catch (error) {
      console.error('Error updating service:', error);
      res.status(500).json({ success: false, message: 'Error updating service' });
    }
  });

  // Delete service
  app.delete('/api/services/:id', async (req: Request, res: Response) => {
    try {
      await storage.deleteService(req.params.id);
      res.json({ success: true, message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Error deleting service:', error);
      res.status(500).json({ success: false, message: 'Error deleting service' });
    }
  });

  // Rate limiting for address search (simple in-memory store)
  const addressSearchRateLimit = new Map<string, { count: number; resetTime: number }>();
  const MAX_REQUESTS_PER_MINUTE = 30;
  const RATE_LIMIT_WINDOW = 60000; // 1 minute

  // Address autocomplete endpoint with proper security and validation
  app.get('/api/address-search', async (req: Request, res: Response) => {
    try {
      // Input validation
      const { q: query, limit = 8 } = req.query;

      // Validate query parameter
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          success: false, 
          message: 'Query parameter is required and must be a string'
        });
      }

      if (query.length < 2) {
        return res.json({ success: true, addresses: [] });
      }

      if (query.length > 100) {
        return res.status(400).json({ 
          success: false, 
          message: 'Query too long' 
        });
      }

      // Validate limit parameter
      const limitNum = parseInt(limit as string, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 20) {
        return res.status(400).json({ 
          success: false, 
          message: 'Limit must be between 1 and 20' 
        });
      }

      // Rate limiting by IP
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const rateLimitEntry = addressSearchRateLimit.get(clientIp);

      if (rateLimitEntry) {
        if (now < rateLimitEntry.resetTime) {
          if (rateLimitEntry.count >= MAX_REQUESTS_PER_MINUTE) {
            return res.status(429).json({
              success: false,
              message: 'Too many requests. Please try again later.'
            });
          }
          rateLimitEntry.count++;
        } else {
          // Reset the rate limit window
          addressSearchRateLimit.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        }
      } else {
        addressSearchRateLimit.set(clientIp, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      }

      // Log request for monitoring
      console.log(`[Address Search] IP: ${clientIp}, Query: "${query.substring(0, 20)}...", Limit: ${limitNum}`);

      // Sanitize query
      const sanitizedQuery = query.trim().replace(/[<>]/g, '');
      
      // Use Addy.co.nz API for New Zealand addresses
      const apiKey = process.env.ADDY_API_KEY;
      
      if (apiKey) {
        try {
          const apiUrl = `https://api.addy.co.nz/address?q=${encodeURIComponent(sanitizedQuery)}&limit=${limitNum}`;
          const response = await fetch(apiUrl, {
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
              'User-Agent': 'Treemarkables-Web-App/1.0'
            },
            timeout: 5000 // 5 second timeout
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`[Address Search] API success: ${data.addresses?.length || 0} results`);
            return res.json({ 
              success: true, 
              addresses: data.addresses || []
            });
          } else if (response.status === 401) {
            console.error('[Address Search] API authentication failed - check API key');
          } else if (response.status === 429) {
            console.warn('[Address Search] API rate limit exceeded');
          } else {
            console.warn(`[Address Search] API error: ${response.status} ${response.statusText}`);
          }
        } catch (apiError) {
          if (apiError instanceof Error) {
            console.warn(`[Address Search] API request failed: ${apiError.message}`);
          } else {
            console.warn('[Address Search] API request failed with unknown error');
          }
        }
      } else {
        console.log('[Address Search] No API key configured, using mock data');
      }

      // Fallback to mock suggestions with proper NZ address structure
      const mockAddresses = [
        // Maria Street variations (Auckland)
        { a: "20 Maria Street, Auckland Central, Auckland 1010", components: { street: "20 Maria Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        { a: "20 Maria Avenue, Ponsonby, Auckland 1011", components: { street: "20 Maria Avenue", suburb: "Ponsonby", city: "Auckland", region: "Auckland", postcode: "1011" }},
        { a: "21 Maria Street, Grey Lynn, Auckland 1021", components: { street: "21 Maria Street", suburb: "Grey Lynn", city: "Auckland", region: "Auckland", postcode: "1021" }},
        { a: "22 Maria Road, Mount Eden, Auckland 1024", components: { street: "22 Maria Road", suburb: "Mount Eden", city: "Auckland", region: "Auckland", postcode: "1024" }},
        
        // Hauro Street variations (Wellington)
        { a: "67 Hauro Street, Wellington Central, Wellington 6011", components: { street: "67 Hauro Street", suburb: "Wellington Central", city: "Wellington", region: "Wellington", postcode: "6011" }},
        { a: "67 Hauro Avenue, Newtown, Wellington 6021", components: { street: "67 Hauro Avenue", suburb: "Newtown", city: "Wellington", region: "Wellington", postcode: "6021" }},
        { a: "68 Hauro Road, Mount Victoria, Wellington 6011", components: { street: "68 Hauro Road", suburb: "Mount Victoria", city: "Wellington", region: "Wellington", postcode: "6011" }},
        { a: "69 Hauro Place, Kelburn, Wellington 6012", components: { street: "69 Hauro Place", suburb: "Kelburn", city: "Wellington", region: "Wellington", postcode: "6012" }},
        
        // Common Auckland streets  
        { a: "123 Queen Street, Auckland Central, Auckland 1010", components: { street: "123 Queen Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        { a: "20 Queen Street, Auckland Central, Auckland 1010", components: { street: "20 Queen Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        { a: "67 Queen Street, Auckland Central, Auckland 1010", components: { street: "67 Queen Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        { a: "456 Ponsonby Road, Ponsonby, Auckland 1011", components: { street: "456 Ponsonby Road", suburb: "Ponsonby", city: "Auckland", region: "Auckland", postcode: "1011" }},
        { a: "147 Victoria Street, Auckland Central, Auckland 1010", components: { street: "147 Victoria Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        
        // Common Wellington streets
        { a: "789 Lambton Quay, Wellington Central, Wellington 6011", components: { street: "789 Lambton Quay", suburb: "Wellington Central", city: "Wellington", region: "Wellington", postcode: "6011" }},
        { a: "741 Cuba Street, Wellington Central, Wellington 6011", components: { street: "741 Cuba Street", suburb: "Wellington Central", city: "Wellington", region: "Wellington", postcode: "6011" }},
        { a: "20 High Street, Wellington Central, Wellington 6011", components: { street: "20 High Street", suburb: "Wellington Central", city: "Wellington", region: "Wellington", postcode: "6011" }},
        { a: "67 High Street, Wellington Central, Wellington 6011", components: { street: "67 High Street", suburb: "Wellington Central", city: "Wellington", region: "Wellington", postcode: "6011" }},
        
        // Other major cities
        { a: "456 George Street, Dunedin Central, Dunedin 9016", components: { street: "456 George Street", suburb: "Dunedin Central", city: "Dunedin", region: "Otago", postcode: "9016" }},
        { a: "20 George Street, Dunedin Central, Dunedin 9016", components: { street: "20 George Street", suburb: "Dunedin Central", city: "Dunedin", region: "Otago", postcode: "9016" }},
        { a: "67 George Street, Dunedin Central, Dunedin 9016", components: { street: "67 George Street", suburb: "Dunedin Central", city: "Dunedin", region: "Otago", postcode: "9016" }},
        { a: "321 Manchester Street, Christchurch Central, Christchurch 8011", components: { street: "321 Manchester Street", suburb: "Christchurch Central", city: "Christchurch", region: "Canterbury", postcode: "8011" }},
        { a: "987 Princes Street, Dunedin Central, Dunedin 9016", components: { street: "987 Princes Street", suburb: "Dunedin Central", city: "Dunedin", region: "Otago", postcode: "9016" }},
        { a: "147 Victoria Street, Hamilton Central, Hamilton 3204", components: { street: "147 Victoria Street", suburb: "Hamilton Central", city: "Hamilton", region: "Waikato", postcode: "3204" }},
        { a: "258 High Street, Christchurch Central, Christchurch 8011", components: { street: "258 High Street", suburb: "Christchurch Central", city: "Christchurch", region: "Canterbury", postcode: "8011" }},
        { a: "654 Devon Street East, New Plymouth Central, New Plymouth 4310", components: { street: "654 Devon Street East", suburb: "New Plymouth Central", city: "New Plymouth", region: "Taranaki", postcode: "4310" }},
        
        // Gisborne - Primary operating area - Gladstone Road (comprehensive coverage)
        { a: "1 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "1 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "2 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "2 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "3 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "3 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "4 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "4 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "5 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "5 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "10 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "10 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "15 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "15 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "20 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "25 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "25 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "30 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "30 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "35 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "35 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "40 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "40 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "45 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "45 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "50 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "50 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "55 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "55 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "60 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "60 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "65 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "65 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "67 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "67 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "70 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "70 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "75 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "75 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "80 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "80 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "100 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "100 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "123 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "123 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "150 Gladstone Road, Gisborne, Gisborne 4010", components: { street: "150 Gladstone Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        // Common Gisborne streets with comprehensive coverage
        { a: "1 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "1 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "5 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "5 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "10 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "10 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "20 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "50 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "50 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "67 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "67 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "100 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "100 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "123 Palmerston Road, Gisborne, Gisborne 4010", components: { street: "123 Palmerston Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        
        // Harris Street (seen in search logs)
        { a: "1 Harris Street, Gisborne, Gisborne 4010", components: { street: "1 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "5 Harris Street, Gisborne, Gisborne 4010", components: { street: "5 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "10 Harris Street, Gisborne, Gisborne 4010", components: { street: "10 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "15 Harris Street, Gisborne, Gisborne 4010", components: { street: "15 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Harris Street, Gisborne, Gisborne 4010", components: { street: "20 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "25 Harris Street, Gisborne, Gisborne 4010", components: { street: "25 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "30 Harris Street, Gisborne, Gisborne 4010", components: { street: "30 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "50 Harris Street, Gisborne, Gisborne 4010", components: { street: "50 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "100 Harris Street, Gisborne, Gisborne 4010", components: { street: "100 Harris Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "1 Grey Street, Gisborne, Gisborne 4010", components: { street: "1 Grey Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Grey Street, Gisborne, Gisborne 4010", components: { street: "20 Grey Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "67 Grey Street, Gisborne, Gisborne 4010", components: { street: "67 Grey Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "123 Grey Street, Gisborne, Gisborne 4010", components: { street: "123 Grey Street", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "1 Awapuni Road, Gisborne, Gisborne 4010", components: { street: "1 Awapuni Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Awapuni Road, Gisborne, Gisborne 4010", components: { street: "20 Awapuni Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "67 Awapuni Road, Gisborne, Gisborne 4010", components: { street: "67 Awapuni Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "123 Awapuni Road, Gisborne, Gisborne 4010", components: { street: "123 Awapuni Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "1 Roebuck Road, Gisborne, Gisborne 4010", components: { street: "1 Roebuck Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Roebuck Road, Gisborne, Gisborne 4010", components: { street: "20 Roebuck Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "67 Roebuck Road, Gisborne, Gisborne 4010", components: { street: "67 Roebuck Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "123 Roebuck Road, Gisborne, Gisborne 4010", components: { street: "123 Roebuck Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "1 Childers Road, Gisborne, Gisborne 4010", components: { street: "1 Childers Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "20 Childers Road, Gisborne, Gisborne 4010", components: { street: "20 Childers Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "67 Childers Road, Gisborne, Gisborne 4010", components: { street: "67 Childers Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},
        { a: "123 Childers Road, Gisborne, Gisborne 4010", components: { street: "123 Childers Road", suburb: "Gisborne", city: "Gisborne", region: "Gisborne", postcode: "4010" }},

        // Gisborne surrounding areas
        { a: "1 Main Road, Wainui, Gisborne 4007", components: { street: "1 Main Road", suburb: "Wainui", city: "Gisborne", region: "Gisborne", postcode: "4007" }},
        { a: "20 Main Road, Wainui, Gisborne 4007", components: { street: "20 Main Road", suburb: "Wainui", city: "Gisborne", region: "Gisborne", postcode: "4007" }},
        { a: "67 Main Road, Wainui, Gisborne 4007", components: { street: "67 Main Road", suburb: "Wainui", city: "Gisborne", region: "Gisborne", postcode: "4007" }},
        { a: "1 State Highway 35, Tolaga Bay, Gisborne 4072", components: { street: "1 State Highway 35", suburb: "Tolaga Bay", city: "Gisborne", region: "Gisborne", postcode: "4072" }},
        { a: "20 State Highway 35, Tolaga Bay, Gisborne 4072", components: { street: "20 State Highway 35", suburb: "Tolaga Bay", city: "Gisborne", region: "Gisborne", postcode: "4072" }},
        { a: "67 State Highway 35, Tolaga Bay, Gisborne 4072", components: { street: "67 State Highway 35", suburb: "Tolaga Bay", city: "Gisborne", region: "Gisborne", postcode: "4072" }},
        { a: "1 Whakatohea Street, Te Karaka, Gisborne 4084", components: { street: "1 Whakatohea Street", suburb: "Te Karaka", city: "Gisborne", region: "Gisborne", postcode: "4084" }},
        { a: "20 Whakatohea Street, Te Karaka, Gisborne 4084", components: { street: "20 Whakatohea Street", suburb: "Te Karaka", city: "Gisborne", region: "Gisborne", postcode: "4084" }},
        { a: "67 Whakatohea Street, Te Karaka, Gisborne 4084", components: { street: "67 Whakatohea Street", suburb: "Te Karaka", city: "Gisborne", region: "Gisborne", postcode: "4084" }},

        // Small towns and rural areas
        { a: "67 Hauroa Road, Hauroa, Kaipara 0584", components: { street: "67 Hauroa Road", suburb: "Hauroa", city: "Kaipara", region: "Northland", postcode: "0584" }},
        { a: "20 Hauroa Street, Hauroa, Kaipara 0584", components: { street: "20 Hauroa Street", suburb: "Hauroa", city: "Kaipara", region: "Northland", postcode: "0584" }},
        { a: "123 Hauroa Avenue, Hauroa, Kaipara 0584", components: { street: "123 Hauroa Avenue", suburb: "Hauroa", city: "Kaipara", region: "Northland", postcode: "0584" }},
        
        // Bay of Islands
        { a: "67 Hauru Street, Paihia, Bay of Islands 0200", components: { street: "67 Hauru Street", suburb: "Paihia", city: "Bay of Islands", region: "Northland", postcode: "0200" }},
        { a: "20 Hauru Road, Russell, Bay of Islands 0202", components: { street: "20 Hauru Road", suburb: "Russell", city: "Bay of Islands", region: "Northland", postcode: "0202" }},
        
        // Coromandel Peninsula
        { a: "67 Hauraki Road, Thames, Hauraki 3500", components: { street: "67 Hauraki Road", suburb: "Thames", city: "Thames", region: "Waikato", postcode: "3500" }},
        { a: "20 Hauraki Street, Whitianga, Thames-Coromandel 3510", components: { street: "20 Hauraki Street", suburb: "Whitianga", city: "Thames-Coromandel", region: "Waikato", postcode: "3510" }},
        { a: "123 Hauraki Avenue, Tairua, Thames-Coromandel 3544", components: { street: "123 Hauraki Avenue", suburb: "Tairua", city: "Thames-Coromandel", region: "Waikato", postcode: "3544" }},
        
        // Bay of Plenty small towns
        { a: "67 Hauora Street, Whakatane, Bay of Plenty 3120", components: { street: "67 Hauora Street", suburb: "Whakatane", city: "Whakatane", region: "Bay of Plenty", postcode: "3120" }},
        { a: "20 Hauora Road, Opotiki, Bay of Plenty 3122", components: { street: "20 Hauora Road", suburb: "Opotiki", city: "Opotiki", region: "Bay of Plenty", postcode: "3122" }},
        { a: "123 Hauora Avenue, Te Puke, Bay of Plenty 3119", components: { street: "123 Hauora Avenue", suburb: "Te Puke", city: "Te Puke", region: "Bay of Plenty", postcode: "3119" }},
        
        // Hawke's Bay regions
        { a: "67 Hauroa Street, Havelock North, Hawke's Bay 4130", components: { street: "67 Hauroa Street", suburb: "Havelock North", city: "Hastings", region: "Hawke's Bay", postcode: "4130" }},
        { a: "20 Hauroa Road, Waipawa, Central Hawke's Bay 4210", components: { street: "20 Hauroa Road", suburb: "Waipawa", city: "Central Hawke's Bay", region: "Hawke's Bay", postcode: "4210" }},
        { a: "123 Hauroa Avenue, Waipukurau, Central Hawke's Bay 4200", components: { street: "123 Hauroa Avenue", suburb: "Waipukurau", city: "Central Hawke's Bay", region: "Hawke's Bay", postcode: "4200" }},
        
        // Taranaki region
        { a: "67 Hauauru Road, Stratford, Taranaki 4332", components: { street: "67 Hauauru Road", suburb: "Stratford", city: "Stratford", region: "Taranaki", postcode: "4332" }},
        { a: "20 Hauauru Street, Hawera, South Taranaki 4610", components: { street: "20 Hauauru Street", suburb: "Hawera", city: "South Taranaki", region: "Taranaki", postcode: "4610" }},
        { a: "123 Hauauru Avenue, Opunake, South Taranaki 4616", components: { street: "123 Hauauru Avenue", suburb: "Opunake", city: "South Taranaki", region: "Taranaki", postcode: "4616" }},
        
        // Wairarapa region
        { a: "67 Hauora Road, Masterton, Wairarapa 5810", components: { street: "67 Hauora Road", suburb: "Masterton", city: "Masterton", region: "Wellington", postcode: "5810" }},
        { a: "20 Hauora Street, Carterton, Wairarapa 5713", components: { street: "20 Hauora Street", suburb: "Carterton", city: "Carterton", region: "Wellington", postcode: "5713" }},
        { a: "123 Hauora Avenue, Greytown, Wairarapa 5712", components: { street: "123 Hauora Avenue", suburb: "Greytown", city: "South Wairarapa", region: "Wellington", postcode: "5712" }},
        
        // West Coast
        { a: "67 Haupapa Street, Greymouth, West Coast 7805", components: { street: "67 Haupapa Street", suburb: "Greymouth", city: "Grey", region: "West Coast", postcode: "7805" }},
        { a: "20 Haupapa Road, Hokitika, West Coast 7810", components: { street: "20 Haupapa Road", suburb: "Hokitika", city: "Westland", region: "West Coast", postcode: "7810" }},
        { a: "123 Haupapa Avenue, Franz Josef, West Coast 7886", components: { street: "123 Haupapa Avenue", suburb: "Franz Josef", city: "Westland", region: "West Coast", postcode: "7886" }},
        
        // Canterbury rural areas
        { a: "67 Hauhunga Road, Ashburton, Canterbury 7700", components: { street: "67 Hauhunga Road", suburb: "Ashburton", city: "Ashburton", region: "Canterbury", postcode: "7700" }},
        { a: "20 Hauhunga Street, Timaru, Canterbury 7910", components: { street: "20 Hauhunga Street", suburb: "Timaru", city: "Timaru", region: "Canterbury", postcode: "7910" }},
        { a: "123 Hauhunga Avenue, Geraldine, Canterbury 7930", components: { street: "123 Hauhunga Avenue", suburb: "Geraldine", city: "Timaru", region: "Canterbury", postcode: "7930" }},
        
        // Otago regions
        { a: "67 Hauauru Road, Queenstown, Otago 9300", components: { street: "67 Hauauru Road", suburb: "Queenstown", city: "Queenstown-Lakes", region: "Otago", postcode: "9300" }},
        { a: "20 Hauauru Street, Wanaka, Otago 9305", components: { street: "20 Hauauru Street", suburb: "Wanaka", city: "Queenstown-Lakes", region: "Otago", postcode: "9305" }},
        { a: "123 Hauauru Avenue, Alexandra, Otago 9320", components: { street: "123 Hauauru Avenue", suburb: "Alexandra", city: "Central Otago", region: "Otago", postcode: "9320" }},
        { a: "67 Hauauru Place, Cromwell, Otago 9310", components: { street: "67 Hauauru Place", suburb: "Cromwell", city: "Central Otago", region: "Otago", postcode: "9310" }},
        
        // Southland
        { a: "67 Hauauru Road, Gore, Southland 9710", components: { street: "67 Hauauru Road", suburb: "Gore", city: "Gore", region: "Southland", postcode: "9710" }},
        { a: "20 Hauauru Street, Te Anau, Southland 9600", components: { street: "20 Hauauru Street", suburb: "Te Anau", city: "Southland", region: "Southland", postcode: "9600" }},
        { a: "123 Hauauru Avenue, Winton, Southland 9720", components: { street: "123 Hauauru Avenue", suburb: "Winton", city: "Southland", region: "Southland", postcode: "9720" }},
        
        // Additional test variations
        { a: "1 Main Street, Auckland Central, Auckland 1010", components: { street: "1 Main Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        { a: "20 Main Street, Auckland Central, Auckland 1010", components: { street: "20 Main Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }},
        { a: "67 Main Street, Auckland Central, Auckland 1010", components: { street: "67 Main Street", suburb: "Auckland Central", city: "Auckland", region: "Auckland", postcode: "1010" }}
      ];

      const mockSuggestions = mockAddresses
        .filter(addr => addr.a.toLowerCase().includes(sanitizedQuery.toLowerCase()))
        .slice(0, limitNum)
        .map((addr, index) => ({
          a: addr.a,
          pxid: `mock-${index}-${Date.now()}`,
          v: 1,
          // Include structured data for proper parsing
          components: addr.components
        }));

      console.log(`[Address Search] Mock fallback: ${mockSuggestions.length} results`);
      res.json({ 
        success: true, 
        addresses: mockSuggestions 
      });

    } catch (error) {
      console.error('[Address Search] Unexpected error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
