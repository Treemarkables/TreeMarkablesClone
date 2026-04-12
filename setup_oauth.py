#!/usr/bin/env python3
import os, sys, json, urllib.request, urllib.parse
from pathlib import Path

CLIENT_ID = "819973954312-946ia8864u20476qs6sb00noreq3v248.apps.googleusercontent.com"
CLIENT_SECRET = "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N"
REDIRECT_URI = "http://localhost:8080"
SCOPE = "https://www.googleapis.com/auth/adwords"
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"

print("\n" + "="*70)
print("🔐 Google Ads API OAuth 2.0 Setup - Treemarkables")
print("="*70)

params = {"client_id": CLIENT_ID, "redirect_uri": REDIRECT_URI, "response_type": "code", "scope": SCOPE, "access_type": "offline", "prompt": "consent"}
auth_url = f"{AUTH_URL}?{urllib.parse.urlencode(params)}"

print(f"\n1️⃣  Visit this URL to authorize:\n{auth_url}\n")
print("2️⃣  You'll be redirected to localhost with an auth code")
print("3️⃣  Copy the code from the URL and paste it below\n")

auth_code = input("Paste auth code here: ").strip()
if not auth_code:
    print("❌ No auth code provided.")
    sys.exit(1)

print(f"\n⏳ Exchanging code for tokens...")
data = {"client_id": CLIENT_ID, "client_secret": CLIENT_SECRET, "code": auth_code, "grant_type": "authorization_code", "redirect_uri": REDIRECT_URI}
req = urllib.request.Request(TOKEN_URL, data=urllib.parse.urlencode(data).encode('utf-8'), headers={'Content-Type': 'application/x-www-form-urlencoded'})

try:
    with urllib.request.urlopen(req) as response:
        token_response = json.loads(response.read().decode('utf-8'))
except Exception as e:
    print(f"❌ Token exchange failed: {e}")
    sys.exit(1)

if "refresh_token" not in token_response:
    print(f"❌ Failed to get refresh token: {token_response}")
    sys.exit(1)

refresh_token = token_response["refresh_token"]
access_token = token_response["access_token"]

env_file = Path(".env")
env_content = f"""GOOGLE_ADS_REFRESH_TOKEN={refresh_token}
GOOGLE_ADS_ACCESS_TOKEN={access_token}
GOOGLE_ADS_CLIENT_ID={CLIENT_ID}
GOOGLE_ADS_CLIENT_SECRET={CLIENT_SECRET}
GOOGLE_ADS_DEVELOPER_TOKEN=hKuaqYP3FzeXGdSM_p7uMA
GOOGLE_ADS_CUSTOMER_ID=215-149-0929
"""
env_file.write_text(env_content)

print(f"\n✅ Credentials saved to .env")
print(f"📝 Refresh token: {refresh_token[:20]}...")
print("\n" + "="*70)
print("✅ OAuth Setup Complete!")
print("="*70)
print("\nNext: Run python3 REPLIT_SETUP.py\n")
