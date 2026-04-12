#!/usr/bin/env python3
import os, sys, subprocess
from pathlib import Path

print("\n" + "="*70)
print("🔧 Treemarkables Google Ads API - Replit Setup")
print("="*70 + "\n")

print("⏳ Installing dependencies...")
os.system("pip install google-ads python-dotenv --break-system-packages -q")
print("✅ Dependencies installed\n")

print("Checking required files...")
required = ["campaigns.json", "deploy_campaigns.py"]
missing = [f for f in required if not Path(f).exists()]
if missing:
    print(f"❌ Missing: {missing}")
    sys.exit(1)
print("✅ All files present\n")

if Path(".env").exists():
    print("✅ .env exists (credentials ready)")
else:
    print("Running OAuth setup...")
    os.system("python3 setup_oauth.py")

print("\n" + "="*70)
print("Step 1: Dry Run (Preview)")
print("="*70 + "\n")
os.system("python3 deploy_campaigns.py")

print("\n" + "="*70)
print("✅ Setup complete!")
print("="*70)
print("\nTo deploy campaigns, run:")
print("   python3 deploy_campaigns.py --confirm\n")
