#!/usr/bin/env python3
import json, os, sys
from pathlib import Path

CONFIG_FILE = Path("campaigns.json")
DEVELOPER_TOKEN = "hKuaqYP3FzeXGdSM_p7uMA"
CUSTOMER_ID = "215149092"

print("\n" + "="*70)
print("TREEMARKABLES GOOGLE ADS - DEPLOYMENT")
print("="*70 + "\n")

# Load campaigns
with open(CONFIG_FILE) as f:
    config = json.load(f)

print(f"✅ Loaded {len(config['campaigns'])} campaigns\n")

# Show summary
for campaign in config["campaigns"]:
    print(f"📌 {campaign['name']}")
    print(f"   Budget: ${campaign['daily_budget']}/day")
    print(f"   Keywords: {len(campaign.get('keywords', []))}")
    print(f"   Ads: {len(campaign.get('ads', []))}\n")

print("="*70)
print("🎉 All campaigns configured and ready!")
print("="*70)
print("\nTo deploy to Google Ads, use:")
print("   python3 deploy_full.py --confirm\n")
