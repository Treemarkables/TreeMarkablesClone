import twilio from 'twilio';

let connectionSettings: any;

async function getCredentials() {
  if (process.env.TWILIO_ACCOUNT_SID && (process.env.TWILIO_AUTH_TOKEN || (process.env.TWILIO_API_KEY && process.env.TWILIO_API_KEY_SECRET))) {
    console.log('🔍 Using Twilio credentials from Secrets');
    return {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      apiKey: process.env.TWILIO_API_KEY,
      apiKeySecret: process.env.TWILIO_API_KEY_SECRET,
      phoneNumber: process.env.TWILIO_PHONE_NUMBER
    };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=twilio',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.account_sid) {
    throw new Error('Twilio not connected');
  }
  
  console.log('🔍 Twilio connection settings retrieved from connector:', {
    hasAccountSid: !!connectionSettings.settings.account_sid,
    hasAuthToken: !!connectionSettings.settings.auth_token,
    hasApiKey: !!connectionSettings.settings.api_key,
    hasApiKeySecret: !!connectionSettings.settings.api_key_secret,
    hasPhoneNumber: !!connectionSettings.settings.phone_number,
    accountSidPrefix: connectionSettings.settings.account_sid?.substring(0, 10),
    phoneNumber: connectionSettings.settings.phone_number
  });
  
  return {
    accountSid: connectionSettings.settings.account_sid,
    authToken: connectionSettings.settings.auth_token,
    apiKey: connectionSettings.settings.api_key,
    apiKeySecret: connectionSettings.settings.api_key_secret,
    phoneNumber: connectionSettings.settings.phone_number
  };
}

export async function getTwilioClient() {
  const { accountSid, authToken, apiKey, apiKeySecret } = await getCredentials();
  
  if (apiKey && apiKeySecret) {
    return twilio(apiKey, apiKeySecret, {
      accountSid: accountSid
    });
  } else if (authToken) {
    return twilio(accountSid, authToken);
  } else {
    throw new Error('Twilio credentials not configured - need either API Key or Auth Token');
  }
}

export async function getTwilioFromPhoneNumber() {
  const { phoneNumber } = await getCredentials();
  return phoneNumber;
}
