import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { sendContactEmail } from "./email";
import path from "path";
import fs from "fs";

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
