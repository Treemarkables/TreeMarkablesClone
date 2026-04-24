/**
 * Marketing Campaign Scheduler
 * Automatically publishes scheduled campaigns at the right time
 */

import { storage } from "../storage";
import { metaMarketingService } from "./metaMarketingService";

class MarketingScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes

  /**
   * Start the marketing scheduler
   */
  start() {
    if (this.intervalId) {
      console.log('📅 Marketing scheduler already running');
      return;
    }

    console.log('📅 Starting marketing campaign scheduler (checks every 5 minutes)...');
    
    // Run immediately on start
    void this.checkAndPublishCampaigns().catch((err) => {
      console.error('❌ Marketing scheduler unhandled error (initial run):', err);
    });

    // Then run periodically
    this.intervalId = setInterval(() => {
      void this.checkAndPublishCampaigns().catch((err) => {
        console.error('❌ Marketing scheduler unhandled error:', err);
      });
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the marketing scheduler
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📅 Marketing scheduler stopped');
    }
  }

  /**
   * Check for scheduled campaigns and publish them
   */
  private async checkAndPublishCampaigns() {
    try {
      // Get all scheduled campaigns that are due to be published
      const dueCampaigns = await storage.getScheduledMarketingCampaigns();

      if (dueCampaigns.length === 0) {
        console.log('📅 No scheduled campaigns due for publishing');
        return;
      }

      console.log(`📅 Found ${dueCampaigns.length} campaign(s) ready to publish`);

      for (const campaign of dueCampaigns) {
        try {
          if (campaign.type === 'ad') {
            await this.publishAdCampaign(campaign);
          } else if (campaign.type === 'review_post') {
            await this.publishReviewPost(campaign);
          }
        } catch (error) {
          console.error(`❌ Failed to publish campaign ${campaign.id}:`, error);
          
          // Mark campaign as failed
          await storage.updateMarketingCampaign(campaign.id, {
            status: 'failed',
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in marketing scheduler:', error);
    }
  }

  /**
   * Publish an ad campaign
   */
  private async publishAdCampaign(campaign: any) {
    console.log(`📢 Publishing ad campaign: ${campaign.name}`);

    const { campaignId, adSetId, adId } = await metaMarketingService.createAdCampaign(
      campaign.objective || 'awareness',
      parseFloat(campaign.budget?.toString() || '0'),
      campaign.budgetType as 'daily' | 'lifetime' || 'daily',
      campaign.adCreative,
      campaign.targeting,
      campaign.platform
    );

    await storage.updateMarketingCampaign(campaign.id, {
      metaCampaignId: campaignId,
      metaAdSetId: adSetId,
      metaAdId: adId,
      status: 'published',
      publishedAt: new Date(),
    });

    console.log(`✅ Ad campaign published successfully: ${campaign.name}`);
  }

  /**
   * Publish a review post
   */
  private async publishReviewPost(campaign: any) {
    console.log(`⭐ Publishing review post: ${campaign.name}`);

    const { postId, permalink } = await metaMarketingService.postReviewToFacebook(
      campaign.reviewText || '',
      campaign.reviewAuthor || '',
      campaign.reviewRating || 5,
      campaign.reviewSource || 'google'
    );

    await storage.updateMarketingCampaign(campaign.id, {
      metaPostId: postId,
      status: 'published',
      publishedAt: new Date(),
    });

    console.log(`✅ Review post published successfully: ${campaign.name}`);
    console.log(`📎 Permalink: ${permalink}`);
  }

  /**
   * Force check and publish campaigns (for testing)
   */
  async forceCheck() {
    await this.checkAndPublishCampaigns();
  }
}

export const marketingScheduler = new MarketingScheduler();
