#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
from dotenv import load_dotenv
from google.ads.googleads.client import GoogleAdsClient
from google.ads.googleads.errors import GoogleAdsException

load_dotenv()

CREDENTIALS = {
    "client_id": os.getenv("GOOGLE_ADS_CLIENT_ID"),
    "client_secret": os.getenv("GOOGLE_ADS_CLIENT_SECRET"),
    "refresh_token": os.getenv("GOOGLE_ADS_REFRESH_TOKEN"),
    "developer_token": "hKuaqYP3FzeXGdSM_p7uMA",
}

CUSTOMER_ID = "215149092"
CONFIG_FILE = Path("campaigns.json")

def log(msg, level="INFO"):
    print(f"[{level}] {msg}")

def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)

def verify_credentials():
    required = ["client_id", "client_secret", "refresh_token", "developer_token"]
    missing = [k for k in required if not CREDENTIALS.get(k)]
    if missing:
        log(f"Missing credentials: {missing}", "ERROR")
        log("Run: python3 setup_oauth.py", "ERROR")
        sys.exit(1)
    log("Credentials verified", "SUCCESS")

def init_client():
    try:
        client = GoogleAdsClient.load_from_dict({
            "developer_token": CREDENTIALS["developer_token"],
            "client_id": CREDENTIALS["client_id"],
            "client_secret": CREDENTIALS["client_secret"],
            "refresh_token": CREDENTIALS["refresh_token"],
            "use_proto_plus": True,
        })
        log("Google Ads API client initialized", "SUCCESS")
        return client
    except Exception as e:
        log(f"Failed to init client: {e}", "ERROR")
        sys.exit(1)

class CampaignManager:
    def __init__(self, client, customer_id):
        self.client = client
        self.customer_id = customer_id
        self.campaign_service = client.get_service("CampaignService")
        self.ad_group_service = client.get_service("AdGroupService")
        self.ad_group_ad_service = client.get_service("AdGroupAdService")
        self.ad_group_criterion_service = client.get_service("AdGroupCriterionService")
        self.changes = {"created": 0, "updated": 0, "errors": 0}

    def get_existing_campaigns(self):
        query = "SELECT campaign.id, campaign.name, campaign.status FROM campaign ORDER BY campaign.name"
        try:
            response = self.campaign_service.search_stream(customer_id=self.customer_id, query=query)
            campaigns = {}
            for batch in response:
                for row in batch.results:
                    campaigns[row.campaign.name] = {
                        "id": row.campaign.id,
                        "resource_name": row.campaign.resource_name,
                    }
            log(f"Retrieved {len(campaigns)} existing campaigns", "SUCCESS")
            return campaigns
        except:
            return {}

    def create_campaign(self, campaign_spec, dry_run=True):
        campaign_name = campaign_spec["name"]
        daily_budget_micros = int(campaign_spec["daily_budget"] * 1_000_000)

        campaign = self.client.get_type("Campaign")
        campaign.name = campaign_name
        campaign.status = self.client.enums.CampaignStatusEnum.ENABLED
        campaign.advertising_channel_type = self.client.enums.AdvertisingChannelTypeEnum.SEARCH

        budget = self.client.get_type("Budget")
        budget.amount_micros = daily_budget_micros
        campaign.budget = budget

        campaign.bidding_strategy_type = self.client.enums.BiddingStrategyTypeEnum.MAXIMIZE_CONVERSIONS

        geo_target = campaign.geo_targets.add()
        geo_target.id = 2087

        campaign.network_settings.target_google_search = True
        campaign.network_settings.target_content_network = False

        operation = self.client.get_type("CampaignOperation")
        operation.create.CopyFrom(campaign)

        if dry_run:
            log(f"  [DRY RUN] Campaign: {campaign_name} (${campaign_spec['daily_budget']}/day)")
            return None

        try:
            response = self.campaign_service.mutate_campaigns(customer_id=self.customer_id, operations=[operation])
            resource_name = response.results[0].resource_name
            log(f"  ✓ Created: {campaign_name}", "SUCCESS")
            self.changes["created"] += 1
            return resource_name
        except GoogleAdsException as e:
            log(f"  ERROR: {campaign_name}: {e}", "ERROR")
            self.changes["errors"] += 1
            return None

    def create_ad_group(self, campaign_resource_name, campaign_name, dry_run=True):
        ad_group = self.client.get_type("AdGroup")
        ad_group.name = f"{campaign_name} - Ads"
        ad_group.campaign = campaign_resource_name
        ad_group.status = self.client.enums.AdGroupStatusEnum.ENABLED
        ad_group.cpc_bid_micros = int(2.0 * 1_000_000)

        operation = self.client.get_type("AdGroupOperation")
        operation.create.CopyFrom(ad_group)

        if dry_run:
            return None

        try:
            response = self.ad_group_service.mutate_ad_groups(customer_id=self.customer_id, operations=[operation])
            return response.results[0].resource_name
        except:
            return None

    def create_ads(self, ad_group_resource_name, ad_specs, dry_run=True):
        operations = []
        for ad_spec in ad_specs:
            ad_group_ad = self.client.get_type("AdGroupAd")
            ad_group_ad.ad_group = ad_group_resource_name
            ad_group_ad.status = self.client.enums.AdGroupAdStatusEnum.ENABLED

            ad = self.client.get_type("Ad")
            ad.final_urls.append(ad_spec["final_url"])

            rsa = self.client.get_type("ResponsiveSearchAdInfo")
            for headline_key in ["headline_1", "headline_2", "headline_3"]:
                headline = self.client.get_type("AdTextAsset")
                headline.text = ad_spec[headline_key]
                rsa.headlines.append(headline)

            description = self.client.get_type("AdTextAsset")
            description.text = ad_spec["description"]
            rsa.descriptions.append(description)

            ad.responsive_search_ad.CopyFrom(rsa)
            ad_group_ad.ad.CopyFrom(ad)

            operation = self.client.get_type("AdGroupAdOperation")
            operation.create.CopyFrom(ad_group_ad)
            operations.append(operation)

        if dry_run or not operations:
            return

        try:
            response = self.ad_group_ad_service.mutate_ad_group_ads(customer_id=self.customer_id, operations=operations)
            log(f"    ✓ Created {len(response.results)} ads", "SUCCESS")
        except:
            pass

    def create_keywords(self, ad_group_resource_name, keywords, dry_run=True):
        operations = []
        match_type_enum = {
            "EXACT": self.client.enums.KeywordMatchTypeEnum.EXACT,
            "PHRASE": self.client.enums.KeywordMatchTypeEnum.PHRASE,
            "BROAD": self.client.enums.KeywordMatchTypeEnum.BROAD,
        }

        for kw_spec in keywords:
            keyword = self.client.get_type("KeywordInfo")
            keyword.text = kw_spec["text"]
            keyword.match_type = match_type_enum.get(kw_spec.get("match_type", "BROAD"), self.client.enums.KeywordMatchTypeEnum.BROAD)

            ad_group_criterion = self.client.get_type("AdGroupCriterion")
            ad_group_criterion.ad_group = ad_group_resource_name
            ad_group_criterion.status = self.client.enums.AdGroupCriterionStatusEnum.ENABLED
            ad_group_criterion.keyword.CopyFrom(keyword)

            if "bid_amount" in kw_spec:
                ad_group_criterion.cpc_bid_micros = int(kw_spec["bid_amount"] * 1_000_000)

            operation = self.client.get_type("AdGroupCriterionOperation")
            operation.create.CopyFrom(ad_group_criterion)
            operations.append(operation)

        if dry_run or not operations:
            return

        try:
            response = self.ad_group_criterion_service.mutate_ad_group_criteria(customer_id=self.customer_id, operations=operations)
            log(f"    ✓ Created {len(response.results)} keywords", "SUCCESS")
        except:
            pass

    def summary(self):
        print("\n" + "="*70)
        print("DEPLOYMENT SUMMARY")
        print("="*70)
        print(f"✓ Created:   {self.changes['created']} campaigns")
        print(f"✗ Errors:    {self.changes['errors']} campaigns")
        print("="*70 + "\n")

def main():
    parser = __import__('argparse').ArgumentParser(description="Deploy Treemarkables Google Ads campaigns")
    parser.add_argument("--confirm", action="store_true", help="Actually deploy changes")
    args = parser.parse_args()

    dry_run = not args.confirm

    print("\n" + "="*70)
    print("TREEMARKABLES GOOGLE ADS - CAMPAIGN DEPLOYMENT")
    print("="*70)

    if dry_run:
        print("🔍 DRY RUN MODE (no changes will be made)")
        print("   Run with --confirm to actually deploy\n")
    else:
        print("⚠️  DEPLOYMENT MODE (making changes to your account)\n")

    verify_credentials()
    config = load_config()
    client = init_client()

    manager = CampaignManager(client, CUSTOMER_ID)
    existing = manager.get_existing_campaigns()

    print("\n" + "-"*70)
    print("PROCESSING CAMPAIGNS")
    print("-"*70 + "\n")

    for campaign_spec in config["campaigns"]:
        campaign_name = campaign_spec["name"]
        daily_budget = campaign_spec.get("daily_budget", 0)

        print(f"📌 Campaign: {campaign_name} (${daily_budget}/day)")

        if campaign_name in existing:
            log(f"  Already exists", "SUCCESS")
        else:
            campaign_resource = manager.create_campaign(campaign_spec, dry_run=dry_run)

            if campaign_resource:
                ad_group_resource = manager.create_ad_group(campaign_resource, campaign_name, dry_run=dry_run)

                if ad_group_resource:
                    manager.create_ads(ad_group_resource, campaign_spec.get("ads", []), dry_run=dry_run)
                    manager.create_keywords(ad_group_resource, campaign_spec.get("keywords", []), dry_run=dry_run)

    manager.summary()

    if dry_run:
        print("💡 To deploy these changes, run:")
        print("   python3 deploy_campaigns.py --confirm\n")
    else:
        log("✅ Deployment complete!", "SUCCESS")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⛔ Cancelled by user.")
        sys.exit(0)
    except Exception as e:
        log(f"Unexpected error: {e}", "ERROR")
        import traceback
        traceback.print_exc()
        sys.exit(1)
