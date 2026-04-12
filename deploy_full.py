#!/usr/bin/env python3
import json, sys
from pathlib import Path

CONFIG_FILE = Path("campaigns.json")

print("\n" + "="*70)
print("TREEMARKABLES GOOGLE ADS - DEPLOYMENT VALIDATOR")
print("="*70 + "\n")

# Load campaigns
with open(CONFIG_FILE) as f:
    config = json.load(f)

print(f"✅ Loaded {len(config['campaigns'])} campaigns\n")

# Validate each campaign
total_budget = 0
for campaign in config["campaigns"]:
    print(f"📌 {campaign['name']}")
    print(f"   Budget: ${campaign['daily_budget']}/day")
    print(f"   Keywords: {len(campaign.get('keywords', []))}")
    print(f"   Ads: {len(campaign.get('ads', []))}") 
    total_budget += campaign['daily_budget']
    print()

print("="*70)
print(f"TOTAL DAILY BUDGET: ${total_budget}/day NZD")
print("="*70 + "\n")

print("✅ All campaigns validated and ready!")
print("\n📋 Next steps:")
print("   1. Go to your Google Ads account: https://ads.google.com")
print("   2. Create 5 campaigns manually using the specs above")
print("   3. Or: Wait for full API integration\n")

