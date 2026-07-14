import { Resend } from 'resend';

// Get Resend credentials from environment secret
function getCredentials() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY not found in environment');
    console.error('Available env keys:', Object.keys(process.env).filter(k => k.includes('RESEND') || k.includes('KEY')));
    throw new Error('RESEND_API_KEY not found in environment');
  }
  
  console.log(`✅ RESEND_API_KEY loaded: ${apiKey.substring(0, 10)}...`);
  
  // Base From header: default sender name over the verified sending address.
  // Per-tenant emails override the display name (emailService.composeFrom) but
  // keep this address. Set RESEND_FROM_EMAIL in the environment to move sending
  // to a newly verified domain (e.g. "Inflow <no-reply@mail.inflowapp.co.nz>")
  // without a code change.
  const fromEmail = (process.env.RESEND_FROM_EMAIL || 'Treemarkables <info@updates.treemarkables.co.nz>').trim();

  return { apiKey, fromEmail };
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableResendClient() {
  const credentials = getCredentials();
  return {
    client: new Resend(credentials.apiKey),
    fromEmail: credentials.fromEmail
  };
}
