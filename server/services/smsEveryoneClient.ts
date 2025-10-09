interface SMSEveryoneCredentials {
  username: string;
  password: string;
  senderId: string;
}

interface SMSEveryoneResponse {
  Code: number;
  CampaignId?: number;
  Messages?: number;
  Segments?: number;
  Credits?: number;
  Message?: string;
}

async function getCredentials(): Promise<SMSEveryoneCredentials> {
  if (process.env.SMSEVERYONE_USERNAME && process.env.SMSEVERYONE_PASSWORD && process.env.SMSEVERYONE_SENDER_ID) {
    console.log('🔍 Using SMS Everyone credentials from Secrets');
    return {
      username: process.env.SMSEVERYONE_USERNAME,
      password: process.env.SMSEVERYONE_PASSWORD,
      senderId: process.env.SMSEVERYONE_SENDER_ID
    };
  }

  throw new Error('SMS Everyone credentials not configured');
}

function createAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  const base64Credentials = Buffer.from(credentials).toString('base64');
  return `Basic ${base64Credentials}`;
}

export async function sendSMSEveryoneMessage(
  to: string,
  message: string,
  schedule?: Date
): Promise<SMSEveryoneResponse> {
  const credentials = await getCredentials();
  
  const body: any = {
    Message: message,
    Originator: credentials.senderId,
    Destinations: [to],
    Action: 'create'
  };

  if (schedule) {
    const year = schedule.getFullYear();
    const month = String(schedule.getMonth() + 1).padStart(2, '0');
    const day = String(schedule.getDate()).padStart(2, '0');
    const hour = String(schedule.getHours()).padStart(2, '0');
    const minute = String(schedule.getMinutes()).padStart(2, '0');
    body.TimeScheduled = `${year}${month}${day}${hour}${minute}`;
  }

  // Try NZ endpoint first, then fallback to .com endpoint
  const endpoints = [
    'https://smseveryone.co.nz/api/campaign',
    'https://smseveryone.com/api/campaign'
  ];
  
  let response;
  let lastError;
  
  for (const endpoint of endpoints) {
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': createAuthHeader(credentials.username, credentials.password),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      if (response.ok) {
        break; // Success, exit loop
      }
    } catch (error) {
      lastError = error;
      // Try next endpoint
    }
  }
  
  if (!response) {
    throw lastError || new Error('Failed to connect to SMS Everyone API');
  }

  const result = await response.json();
  
  if (!response.ok || result.Code !== 0) {
    console.error('📱 SMS Everyone API Error:', {
      status: response.status,
      code: result.Code,
      message: result.Message,
      response: result
    });
    throw new Error(result.Message || `SMS Everyone API error: ${response.status} (Code: ${result.Code})`);
  }

  console.log('✅ SMS Everyone API Response:', {
    campaignId: result.CampaignId,
    messages: result.Messages,
    credits: result.Credits
  });

  return result;
}

export async function getSMSEveryoneCredits(): Promise<number> {
  const credentials = await getCredentials();
  
  // Try NZ endpoint first, then fallback to .com endpoint
  const endpoints = [
    'https://smseveryone.co.nz/api/credits',
    'https://smseveryone.com/api/credits'
  ];
  
  let response;
  let lastError;
  
  for (const endpoint of endpoints) {
    try {
      response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': createAuthHeader(credentials.username, credentials.password),
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        break; // Success, exit loop
      }
    } catch (error) {
      lastError = error;
      // Try next endpoint
    }
  }
  
  if (!response) {
    throw lastError || new Error('Failed to connect to SMS Everyone API');
  }

  const result = await response.json();
  
  if (!response.ok || result.Code !== 0) {
    throw new Error(result.Message || `SMS Everyone API error: ${response.status}`);
  }

  return result.Credits || 0;
}

export async function getSMSEveryoneSenderId(): Promise<string> {
  const credentials = await getCredentials();
  return credentials.senderId;
}

interface SMSReply {
  originator: string;
  recipient: string;
  message_text: string;
  received: string;
  reference?: string;
}

interface SMSRepliesResponse {
  replies: SMSReply[];
}

export async function retrieveSMSReplies(): Promise<SMSReply[]> {
  const credentials = await getCredentials();
  
  // Try NZ endpoint first, then fallback to AU endpoint
  const endpoints = [
    'https://smseveryone.co.nz/api/v1/replies',
    'https://www.smseveryone.com.au/api/v1/replies'
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: credentials.username,
          password: credentials.password
        })
      });

      if (response.ok) {
        const result: SMSRepliesResponse = await response.json();
        return result.replies || [];
      }
      
      // If not OK, try next endpoint
      if (endpoint === endpoints[endpoints.length - 1]) {
        throw new Error(`SMS Everyone Replies API error: ${response.status}`);
      }
    } catch (error) {
      // If it's the last endpoint, throw the error
      if (endpoint === endpoints[endpoints.length - 1]) {
        throw error;
      }
      // Otherwise, continue to next endpoint
    }
  }
  
  return [];
}
