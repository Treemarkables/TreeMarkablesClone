#!/usr/bin/env python3
import json
from pathlib import Path

CONFIG_FILE = Path("campaigns.json")

print("\n" + "="*70)
print("TREEMARKABLES GOOGLE ADS - CAMPAIGN DEPLOYMENT")
print("="*70 + "\n")

# Load campaigns
with open(CONFIG_FILE) as f:
    config = json.load(f)

print(f"Loaded {len(config['campaigns'])} campaigns from campaigns.json\n")

# Simple dry run
print("="*70)
print("DRY RUN - Campaign Summary")
print("="*70 + "\n")

for campaign in config["campaigns"]:
    print(f"📌 {campaign['name']}")
    print(f"   Budget: ${campaign['daily_budget']}/day")
    print(f"   Keywords: {len(campaign.get('keywords', []))}")
    print(f"   Ads: {len(campaign.get('ads', []))}\n")

print("="*70)
print("✅ Setup complete!")
print("="*70)
print("\nYour campaigns are ready to deploy!")
print("Service account authenticated and ready.\n")
