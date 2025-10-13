/**
 * Reviews Service - Fetch Google and Facebook Reviews
 * 
 * Setup Instructions:
 * 
 * GOOGLE REVIEWS:
 * 1. Get your Google Place ID:
 *    - Go to https://developers.google.com/maps/documentation/places/web-service/place-id
 *    - Or search your business on Google Maps, the Place ID is in the URL
 * 2. Get Google Places API Key:
 *    - Go to https://console.cloud.google.com/
 *    - Create/select a project
 *    - Enable "Places API"
 *    - Create credentials (API Key)
 * 3. Add secrets via Replit Secrets:
 *    - GOOGLE_PLACES_API_KEY
 *    - GOOGLE_PLACE_ID
 * 
 * FACEBOOK REVIEWS:
 * 1. Get your Facebook Page ID:
 *    - Go to your Facebook Page
 *    - Click "About" → Page Transparency → Page ID
 * 2. Get Page Access Token:
 *    - Go to https://developers.facebook.com/tools/explorer/
 *    - Select your page
 *    - Generate token with 'pages_read_engagement' permission
 *    - Use Access Token Tool to extend it (never expires)
 * 3. Add secrets via Replit Secrets:
 *    - FACEBOOK_PAGE_ACCESS_TOKEN
 *    - FACEBOOK_PAGE_ID
 */

interface GoogleReview {
  author_name: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
  profile_photo_url?: string;
}

interface GooglePlacesResponse {
  result?: {
    reviews?: GoogleReview[];
    rating?: number;
    user_ratings_total?: number;
  };
  status: string;
  error_message?: string;
}

interface FacebookReview {
  created_time: string;
  recommendation_type: string;
  reviewer: {
    name: string;
    id: string;
  };
  review_text?: string;
  rating?: number;
}

interface FacebookReviewsResponse {
  data: FacebookReview[];
  paging?: {
    cursors: {
      before: string;
      after: string;
    };
    next?: string;
  };
}

interface Review {
  id: string;
  name: string;
  location: string;
  rating: number;
  comment: string;
  service: string;
  source: string;
  date: string;
}

/**
 * Fetch Google Reviews using Places API
 */
export async function fetchGoogleReviews(): Promise<Review[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    console.log('⚠️ Google Reviews: Missing API key or Place ID. Add GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID to Replit Secrets.');
    return [];
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`;
    
    const response = await fetch(url);
    const data: GooglePlacesResponse = await response.json();

    if (data.status !== 'OK') {
      console.error('❌ Google Reviews API error:', data.status, data.error_message);
      return [];
    }

    const reviews = data.result?.reviews || [];
    console.log(`✅ Fetched ${reviews.length} Google reviews`);

    return reviews.map((review, index) => ({
      id: `google-${index}`,
      name: review.author_name,
      location: 'Google Review',
      rating: review.rating,
      comment: review.text || '',
      service: 'Customer Review',
      source: 'google',
      date: new Date(review.time * 1000).toISOString(),
    }));
  } catch (error) {
    console.error('❌ Error fetching Google reviews:', error);
    return [];
  }
}

/**
 * Fetch Facebook Reviews using Graph API
 */
export async function fetchFacebookReviews(): Promise<Review[]> {
  const accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  const pageId = process.env.FACEBOOK_PAGE_ID;

  if (!accessToken || !pageId) {
    console.log('⚠️ Facebook Reviews: Missing access token or Page ID. Add FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID to Replit Secrets.');
    return [];
  }

  try {
    // Fetch reviews/ratings from Facebook Page
    const url = `https://graph.facebook.com/v18.0/${pageId}/ratings?fields=created_time,recommendation_type,reviewer,review_text,rating&access_token=${accessToken}&limit=50`;
    
    const response = await fetch(url);
    const data: FacebookReviewsResponse = await response.json();

    if (!data.data) {
      console.error('❌ Facebook Reviews API error:', data);
      return [];
    }

    console.log(`✅ Fetched ${data.data.length} Facebook reviews`);

    return data.data.map((review, index) => ({
      id: `facebook-${index}`,
      name: review.reviewer.name,
      location: 'Facebook Review',
      rating: review.rating || (review.recommendation_type === 'positive' ? 5 : 3),
      comment: review.review_text || `Recommended this business`,
      service: 'Customer Review',
      source: 'facebook',
      date: review.created_time,
    }));
  } catch (error) {
    console.error('❌ Error fetching Facebook reviews:', error);
    return [];
  }
}

/**
 * Fetch all reviews from both Google and Facebook
 */
export async function fetchAllReviews(): Promise<{ google: Review[]; facebook: Review[] }> {
  const [googleReviews, facebookReviews] = await Promise.all([
    fetchGoogleReviews(),
    fetchFacebookReviews(),
  ]);

  return {
    google: googleReviews,
    facebook: facebookReviews,
  };
}
