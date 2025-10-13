/**
 * Meta (Facebook/Instagram) Marketing Service
 * Handles ad creation, post publishing, and campaign tracking
 */

interface MetaAdCreative {
  headline: string;
  text: string;
  imageUrl: string;
  ctaText: string;
  ctaUrl: string;
}

interface MetaTargeting {
  location: string[];
  ageMin: number;
  ageMax: number;
  interests: string[];
}

interface MetaAdCampaign {
  campaignId: string;
  adSetId: string;
  adId: string;
  status: 'active' | 'paused' | 'completed';
}

interface MetaPost {
  postId: string;
  permalink: string;
  createdTime: string;
}

interface MetaCampaignStats {
  reach: number;
  impressions: number;
  clicks: number;
  engagement: number;
  spent: number;
  conversions: number;
}

export class MetaMarketingService {
  private pageAccessToken: string;
  private pageId: string;
  private adAccountId: string;

  constructor() {
    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN || '';
    this.pageId = process.env.FACEBOOK_PAGE_ID || '';
    this.adAccountId = process.env.FACEBOOK_AD_ACCOUNT_ID || '';
  }

  /**
   * Create a Facebook/Instagram ad campaign
   */
  async createAdCampaign(
    objective: string,
    budget: number,
    budgetType: 'daily' | 'lifetime',
    adCreative: MetaAdCreative,
    targeting: MetaTargeting,
    platform: 'facebook' | 'instagram' | 'both'
  ): Promise<MetaAdCampaign> {
    if (!this.pageAccessToken || !this.adAccountId) {
      throw new Error('Meta Marketing API credentials not configured. Please add FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_AD_ACCOUNT_ID to your secrets.');
    }

    try {
      // Step 1: Create Campaign
      const campaignData = new URLSearchParams({
        name: `Campaign ${Date.now()}`,
        objective: this.mapObjective(objective),
        status: 'PAUSED', // Start paused for safety
        access_token: this.pageAccessToken,
      });

      const campaignResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.adAccountId}/campaigns`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: campaignData.toString(),
        }
      );

      if (!campaignResponse.ok) {
        const error = await campaignResponse.json();
        throw new Error(`Failed to create campaign: ${JSON.stringify(error)}`);
      }

      const { id: campaignId } = await campaignResponse.json();

      // Step 2: Create Ad Set
      const adSetData = new URLSearchParams({
        name: `AdSet ${Date.now()}`,
        campaign_id: campaignId,
        billing_event: 'IMPRESSIONS',
        optimization_goal: 'REACH',
        [budgetType === 'daily' ? 'daily_budget' : 'lifetime_budget']: Math.round(budget * 100).toString(), // Convert to cents
        targeting: JSON.stringify(this.buildTargeting(targeting)),
        status: 'PAUSED',
        access_token: this.pageAccessToken,
      });

      const adSetResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.adAccountId}/adsets`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: adSetData.toString(),
        }
      );

      if (!adSetResponse.ok) {
        const error = await adSetResponse.json();
        throw new Error(`Failed to create ad set: ${JSON.stringify(error)}`);
      }

      const { id: adSetId } = await adSetResponse.json();

      // Step 3: Create Ad Creative
      const creativeData = new URLSearchParams({
        name: `Creative ${Date.now()}`,
        object_story_spec: JSON.stringify({
          page_id: this.pageId,
          link_data: {
            link: adCreative.ctaUrl,
            message: adCreative.text,
            name: adCreative.headline,
            call_to_action: {
              type: this.mapCtaType(adCreative.ctaText),
              value: { link: adCreative.ctaUrl },
            },
            image_url: adCreative.imageUrl,
          },
        }),
        access_token: this.pageAccessToken,
      });

      const creativeResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.adAccountId}/adcreatives`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: creativeData.toString(),
        }
      );

      if (!creativeResponse.ok) {
        const error = await creativeResponse.json();
        throw new Error(`Failed to create ad creative: ${JSON.stringify(error)}`);
      }

      const { id: creativeId } = await creativeResponse.json();

      // Step 4: Create Ad
      const adData = new URLSearchParams({
        name: `Ad ${Date.now()}`,
        adset_id: adSetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status: 'PAUSED',
        access_token: this.pageAccessToken,
      });

      const adResponse = await fetch(
        `https://graph.facebook.com/v18.0/act_${this.adAccountId}/ads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: adData.toString(),
        }
      );

      if (!adResponse.ok) {
        const error = await adResponse.json();
        throw new Error(`Failed to create ad: ${JSON.stringify(error)}`);
      }

      const { id: adId } = await adResponse.json();

      return {
        campaignId,
        adSetId,
        adId,
        status: 'paused',
      };
    } catch (error) {
      console.error('Error creating Meta ad campaign:', error);
      throw error;
    }
  }

  /**
   * Post a review to Facebook page
   */
  async postReviewToFacebook(
    reviewText: string,
    reviewAuthor: string,
    reviewRating: number,
    reviewSource: string
  ): Promise<MetaPost> {
    if (!this.pageAccessToken || !this.pageId) {
      throw new Error('Facebook API credentials not configured. Please add FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID to your secrets.');
    }

    try {
      const stars = '⭐'.repeat(reviewRating);
      const message = `${stars}\n\n"${reviewText}"\n\n- ${reviewAuthor}\n\n${reviewSource === 'google' ? '📍 Review from Google' : '💙 Review from Facebook'}`;

      const postData = new URLSearchParams({
        message,
        access_token: this.pageAccessToken,
      });

      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.pageId}/feed`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: postData.toString(),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to post review: ${JSON.stringify(error)}`);
      }

      const { id: postId } = await response.json();

      // Get post permalink
      const postResponse = await fetch(
        `https://graph.facebook.com/v18.0/${postId}?fields=permalink_url,created_time&access_token=${this.pageAccessToken}`
      );

      const postDetails = await postResponse.json();

      return {
        postId,
        permalink: postDetails.permalink_url || '',
        createdTime: postDetails.created_time || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error posting review to Facebook:', error);
      throw error;
    }
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(campaignId: string): Promise<MetaCampaignStats> {
    if (!this.pageAccessToken) {
      throw new Error('Facebook API credentials not configured');
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${campaignId}/insights?fields=reach,impressions,clicks,actions,spend&access_token=${this.pageAccessToken}`
      );

      if (!response.ok) {
        const error = await response.json();
        console.error('Error fetching campaign stats:', error);
        return {
          reach: 0,
          impressions: 0,
          clicks: 0,
          engagement: 0,
          spent: 0,
          conversions: 0,
        };
      }

      const { data } = await response.json();
      const insights = data[0] || {};

      return {
        reach: parseInt(insights.reach || '0'),
        impressions: parseInt(insights.impressions || '0'),
        clicks: parseInt(insights.clicks || '0'),
        engagement: this.calculateEngagement(insights.actions || []),
        spent: parseFloat(insights.spend || '0'),
        conversions: this.extractConversions(insights.actions || []),
      };
    } catch (error) {
      console.error('Error getting campaign stats:', error);
      return {
        reach: 0,
        impressions: 0,
        clicks: 0,
        engagement: 0,
        spent: 0,
        conversions: 0,
      };
    }
  }

  /**
   * Activate/pause a campaign
   */
  async updateCampaignStatus(
    campaignId: string,
    status: 'active' | 'paused'
  ): Promise<void> {
    if (!this.pageAccessToken) {
      throw new Error('Facebook API credentials not configured');
    }

    const metaStatus = status === 'active' ? 'ACTIVE' : 'PAUSED';

    const updateData = new URLSearchParams({
      status: metaStatus,
      access_token: this.pageAccessToken,
    });

    await fetch(
      `https://graph.facebook.com/v18.0/${campaignId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: updateData.toString(),
      }
    );
  }

  // Helper methods
  private mapObjective(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'BRAND_AWARENESS',
      traffic: 'LINK_CLICKS',
      engagement: 'POST_ENGAGEMENT',
      leads: 'LEAD_GENERATION',
      sales: 'CONVERSIONS',
    };
    return mapping[objective] || 'REACH';
  }

  private mapCtaType(ctaText: string): string {
    const text = ctaText.toLowerCase();
    if (text.includes('learn')) return 'LEARN_MORE';
    if (text.includes('shop')) return 'SHOP_NOW';
    if (text.includes('book')) return 'BOOK_NOW';
    if (text.includes('sign')) return 'SIGN_UP';
    if (text.includes('call')) return 'CALL_NOW';
    if (text.includes('contact')) return 'CONTACT_US';
    return 'LEARN_MORE';
  }

  private buildTargeting(targeting: MetaTargeting) {
    return {
      geo_locations: {
        countries: ['NZ'], // New Zealand
        regions: targeting.location.map(loc => ({ name: loc })),
      },
      age_min: targeting.ageMin,
      age_max: targeting.ageMax,
      interests: targeting.interests.map(interest => ({ name: interest })),
    };
  }

  private calculateEngagement(actions: any[]): number {
    const engagementTypes = ['like', 'comment', 'share', 'post_reaction'];
    return actions
      .filter(action => engagementTypes.includes(action.action_type))
      .reduce((sum, action) => sum + parseInt(action.value || '0'), 0);
  }

  private extractConversions(actions: any[]): number {
    const conversionAction = actions.find(
      action => action.action_type === 'offsite_conversion.fb_pixel_purchase'
    );
    return parseInt(conversionAction?.value || '0');
  }
}

export const metaMarketingService = new MetaMarketingService();
