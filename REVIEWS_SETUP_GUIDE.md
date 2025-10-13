# Google & Facebook Reviews Setup Guide

Your review widgets are already integrated on all your pages! They just need to be connected to your actual Google and Facebook business profiles.

## 📍 Where Your Review Widgets Are:
- ✅ **Home Page** - Shows reviews from both platforms
- ✅ **Tree Removal Page** - Displays customer reviews
- ✅ **Tree Pruning Page** - Shows service reviews
- ✅ **Stump Grinding Page** - Customer testimonials
- ✅ **Hedge Trimming Page** - Review showcase

## 🔧 Setup Instructions

### Step 1: Google Reviews Setup

#### A. Get Your Google Place ID
1. Go to [Google Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder)
2. Search for "Treemarkables Gisborne" (or your business name)
3. Copy your **Place ID** (starts with `ChIJ...`)

**OR** find it from Google Maps:
1. Search your business on Google Maps
2. Look at the URL - the Place ID is the long code after `!1s`

#### B. Get Google Places API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Places API**:
   - Click "Enable APIs and Services"
   - Search for "Places API"
   - Click "Enable"
4. Create API Key:
   - Go to "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the API key

#### C. Add to Replit Secrets
1. In your Replit project, click the **Secrets** tool (🔒 in left sidebar)
2. Add these two secrets:
   ```
   GOOGLE_PLACES_API_KEY = [your API key]
   GOOGLE_PLACE_ID = [your Place ID]
   ```

---

### Step 2: Facebook Reviews Setup

#### A. Get Your Facebook Page ID
1. Go to your Facebook Business Page
2. Click **About** in the left menu
3. Scroll to **Page Transparency** section
4. Your **Page ID** is listed there

**Alternative method:**
1. Go to your page
2. Look at the URL: `facebook.com/YourPageName`
3. Use [Find my Facebook ID](https://findmyfbid.com/) and paste your page URL

#### B. Get Page Access Token
1. Go to [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Click "Get Token" → "Get Page Access Token"
3. Select your Facebook Page
4. Grant permission: `pages_read_engagement`
5. Copy the generated **Access Token**

**IMPORTANT: Extend token to never expire**
1. Go to [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/)
2. Paste your token
3. Click "Extend Access Token"
4. Copy the **new extended token**

#### C. Add to Replit Secrets
1. In your Replit project, open **Secrets** tool (🔒)
2. Add these two secrets:
   ```
   FACEBOOK_PAGE_ACCESS_TOKEN = [your extended token]
   FACEBOOK_PAGE_ID = [your Page ID]
   ```

---

## ✅ Verification

After adding all 4 secrets:
1. **Restart your Replit app** (it will auto-restart)
2. Visit any of your pages:
   - Home page (`/`)
   - Tree Removal (`/tree-removal`)
   - Tree Pruning (`/tree-pruning`)
   - Stump Grinding (`/stump-grinding`)
   - Hedge Trimming (`/hedge-trimming`)
3. Check the console logs for:
   - `✅ Fetched X Google reviews`
   - `✅ Fetched X Facebook reviews`

If you see warnings like:
- `⚠️ Google Reviews: Missing API key or Place ID`
- `⚠️ Facebook Reviews: Missing access token or Page ID`

Double-check that the secret names match exactly (case-sensitive).

---

## 🔍 Troubleshooting

### Google Reviews Not Showing
- ✅ Check API key is valid and Places API is enabled
- ✅ Verify Place ID is correct (should start with `ChIJ`)
- ✅ Make sure your business has reviews on Google
- ✅ Check API quota limits in Google Cloud Console

### Facebook Reviews Not Showing
- ✅ Ensure token has `pages_read_engagement` permission
- ✅ Verify Page ID is correct
- ✅ Make sure token is extended (never expires)
- ✅ Check your page has "Reviews" tab enabled

### Reviews Still Show Placeholders
- ✅ Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
- ✅ Check browser console for error messages
- ✅ Verify all 4 secrets are added correctly

---

## 📝 Notes

- **Google reviews update** every 10 minutes (cached)
- **Facebook reviews update** every 10 minutes (cached)
- **Fallback reviews** are shown if API connection fails
- Reviews are **automatically synced** - no manual updates needed
- Both review sources are **combined** and displayed together

---

## 🎯 What Happens Next

Once connected, your pages will:
1. ✅ Fetch real reviews from Google and Facebook
2. ✅ Display them in the review sections
3. ✅ Auto-update every 10 minutes
4. ✅ Show fallback testimonials if API fails

No code changes needed - just add the 4 secrets and you're done! 🎉
