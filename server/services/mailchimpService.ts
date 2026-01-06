import crypto from 'crypto';

interface MailchimpMember {
  email_address: string;
  status: 'subscribed' | 'pending' | 'unsubscribed' | 'cleaned';
  merge_fields: {
    FNAME?: string;
    LNAME?: string;
    PHONE?: string;
    ADDRESS?: string;
  };
  tags?: string[];
}

interface MailchimpConfig {
  apiKey: string;
  audienceId: string;
}

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

function getDataCenter(apiKey: string): string {
  const parts = apiKey.split('-');
  return parts[parts.length - 1] || 'us1';
}

function getSubscriberHash(email: string): string {
  return crypto.createHash('md5').update(email.toLowerCase()).digest('hex');
}

export async function syncCustomerToMailchimp(
  customer: { 
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    tags?: string[] | null;
  },
  config: MailchimpConfig
): Promise<{ success: boolean; error?: string }> {
  if (!customer.email) {
    return { success: false, error: 'Customer has no email address' };
  }

  if (!config.apiKey || !config.audienceId) {
    return { success: false, error: 'Mailchimp not configured' };
  }

  const dc = getDataCenter(config.apiKey);
  const subscriberHash = getSubscriberHash(customer.email);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${config.audienceId}/members/${subscriberHash}`;

  const nameParts = customer.name.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const memberData: MailchimpMember = {
    email_address: customer.email,
    status: 'subscribed',
    merge_fields: {
      FNAME: firstName,
      LNAME: lastName,
      PHONE: customer.phone || undefined,
      ADDRESS: customer.address || undefined,
    },
    tags: customer.tags || undefined,
  };

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString('base64')}`,
      },
      body: JSON.stringify({
        ...memberData,
        status_if_new: 'subscribed',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Mailchimp] Failed to sync customer:', customer.email, errorData);
      return { 
        success: false, 
        error: errorData.detail || errorData.title || 'Unknown error' 
      };
    }

    console.log('[Mailchimp] Successfully synced customer:', customer.email);
    return { success: true };
  } catch (error) {
    console.error('[Mailchimp] Error syncing customer:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}

export async function syncAllCustomersToMailchimp(
  customers: Array<{ 
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    tags?: string[] | null;
  }>,
  config: MailchimpConfig
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    synced: 0,
    failed: 0,
    errors: [],
  };

  if (!config.apiKey || !config.audienceId) {
    return {
      success: false,
      synced: 0,
      failed: 0,
      errors: ['Mailchimp not configured. Please add your API key and Audience ID in settings.'],
    };
  }

  const customersWithEmail = customers.filter(c => c.email);
  console.log(`[Mailchimp] Starting sync for ${customersWithEmail.length} customers with email`);

  for (const customer of customersWithEmail) {
    const syncResult = await syncCustomerToMailchimp(customer, config);
    if (syncResult.success) {
      result.synced++;
    } else {
      result.failed++;
      result.errors.push(`${customer.name}: ${syncResult.error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  result.success = result.failed === 0;
  console.log(`[Mailchimp] Sync complete: ${result.synced} synced, ${result.failed} failed`);
  
  return result;
}

export async function getMailchimpAudiences(apiKey: string): Promise<{ id: string; name: string; memberCount: number }[]> {
  if (!apiKey) {
    throw new Error('API key is required');
  }

  const dc = getDataCenter(apiKey);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch audiences');
    }

    const data = await response.json();
    return data.lists.map((list: any) => ({
      id: list.id,
      name: list.name,
      memberCount: list.stats?.member_count || 0,
    }));
  } catch (error) {
    console.error('[Mailchimp] Error fetching audiences:', error);
    throw error;
  }
}

export async function testMailchimpConnection(config: MailchimpConfig): Promise<{ success: boolean; error?: string; audienceName?: string }> {
  if (!config.apiKey) {
    return { success: false, error: 'API key is required' };
  }

  if (!config.audienceId) {
    return { success: false, error: 'Audience ID is required' };
  }

  const dc = getDataCenter(config.apiKey);
  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${config.audienceId}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`anystring:${config.apiKey}`).toString('base64')}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: errorData.detail || 'Failed to connect to Mailchimp' 
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      audienceName: data.name 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Network error' 
    };
  }
}
