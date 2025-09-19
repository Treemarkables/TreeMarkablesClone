# GoHighLevel Integration Setup via Zapier

## Overview
Your Treemarkables website is now configured to automatically send contact form submissions to GoHighLevel via Zapier. This integration creates new contacts and conversations in GoHighLevel whenever someone submits a quote request.

⚠️ **IMPORTANT**: The integration works through your existing contact form at `/api/contact`. Do NOT create additional webhook endpoints or dual submissions as this will create duplicate contacts in GoHighLevel.

## Setup Steps

### 1. Create Zapier Account
- Go to [zapier.com](https://zapier.com) and sign up or log in
- You'll need a Zapier plan that supports webhooks (Premium plan or higher)

### 2. Create New Zap
1. Click "Create Zap"
2. **Trigger Step**: Choose "Webhooks by Zapier"
   - Event: "Catch Hook" 
   - This will generate a webhook URL (copy this for later)

### 3. Configure GoHighLevel Action
1. **Action Step**: Search for "LeadConnector" (this is GoHighLevel's Zapier name)
2. Choose event: "Create/Update Contact" or "Create Contact"
3. Connect your GoHighLevel account when prompted
4. Map the webhook data to GoHighLevel fields:
   - **Name** → `name` (from webhook)
   - **Email** → `email` (from webhook)  
   - **Phone** → `phone` (from webhook)
   - **Source** → `source` (will show "treemarkables-contact-form")
   - **Notes/Message** → `message` (from webhook)
   - **Custom Fields**:
     - How they heard about us → `hearAbout`
     - Page visited → `leadSource.pagePath`
     - UTM Source → `leadSource.utmSource`
     - UTM Campaign → `leadSource.utmCampaign`

### 4. Optional: Create Conversation
Add another action step to create a conversation:
1. Add Action: LeadConnector → "Create Conversation" 
2. Map the contact to the conversation
3. Set initial message text using the form message

### 5. Configure Website Environment Variable
1. In your Replit project, go to the "Secrets" tab (🔒 icon)
2. Add a new secret:
   - **Key**: `ZAPIER_WEBHOOK_URL`
   - **Value**: The webhook URL from step 2 (looks like: `https://hooks.zapier.com/hooks/catch/...`)

### 6. Test the Integration
1. Go to your website: [treemarkables.co.nz](https://treemarkables.co.nz)
2. Fill out the contact form with test data
3. Submit the form
4. Check your Zapier dashboard - verify ONLY ONE Zap was triggered
5. Verify the contact was created in GoHighLevel
6. **Important**: If you see duplicate Zaps triggering, check that you're only using the main contact form (not any additional webhook endpoints)

### 7. Configure Duplicate Prevention (Recommended)
In your Zapier action step, add a Filter to prevent duplicates:
1. Add Filter step before the GoHighLevel action
2. Set condition: "Only continue if contact with this email doesn't already exist"
3. Or use a custom field with hash of name+email+date to detect duplicates

## Data Sent to Zapier

The webhook sends this data structure:
```json
{
  "name": "Customer Name",
  "email": "customer@example.com", 
  "phone": "027-123-4567",
  "hearAbout": "Google Search",
  "message": "I need a tree removed",
  "leadSource": {
    "pagePath": "/tree-removal",
    "pageUrl": "https://treemarkables.co.nz/tree-removal",
    "utmSource": "google",
    "utmCampaign": "tree-removal-ads",
    "referrer": "https://google.com",
    "gaClientId": "123456789.0987654321"
  },
  "source": "treemarkables-contact-form",
  "timestamp": "2025-09-19T10:30:00Z",
  "ip": "203.123.45.67",
  "userAgent": "Mozilla/5.0..."
}
```

## Benefits of This Setup

✅ **No API Limits**: Uses Zapier instead of GoHighLevel API  
✅ **Automatic Contact Creation**: Every form submission creates a contact  
✅ **Rich Lead Data**: Captures UTM parameters, referrer, page visited  
✅ **Conversation Ready**: Can automatically start conversations  
✅ **No Code Changes**: Works with existing contact forms  
✅ **Reliable**: Non-blocking - won't affect website if Zapier is down  

## Troubleshooting

### Form Submissions Not Appearing in Zapier
1. Check that `ZAPIER_WEBHOOK_URL` is set correctly in Replit Secrets
2. Test the webhook URL directly in Zapier dashboard
3. Check server logs in Replit for webhook errors
4. Verify forms are being submitted through the main contact form (not direct API calls)

### Contacts Not Creating in GoHighLevel  
1. Verify GoHighLevel connection in Zapier
2. Check field mappings in the Zap
3. Test with the Zapier debugger
4. Ensure you have permission to create contacts in GoHighLevel

### Duplicate Contacts/Conversations
- **Most Common Cause**: Multiple webhook endpoints or dual submissions
- **Solution**: Use ONLY the main contact form - verify no additional webhook posts
- GoHighLevel will typically update existing contacts based on email
- Add Zapier Filter step to check for existing contacts before creating new ones
- Consider using a unique identifier field to track processed leads

### Integration Fails But Website Still Works
- This is expected behavior - the webhook is non-blocking
- Check server logs for specific Zapier forwarding errors
- Website functionality continues even if Zapier is temporarily unavailable

## Cost Considerations

- **Zapier**: Premium plan starts at $20/month for webhook triggers
- **GoHighLevel**: No additional API costs using this method
- **Alternative**: Direct API integration requires GoHighLevel Pro plan ($497+/month)

## Next Steps

1. Set up the Zapier webhook as described above
2. Test with a few form submissions  
3. Configure GoHighLevel workflows to automatically follow up with new leads
4. Set up email/SMS sequences for new conversations
5. Create lead scoring based on UTM parameters and page visits

This integration eliminates manual data entry and ensures every website lead is immediately available in your GoHighLevel CRM with full context about how they found you.