import { Vonage } from '@vonage/server-sdk';
import { Auth } from '@vonage/auth';

export function getVonageCredentials() {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  const vonageNumber = process.env.VONAGE_NUMBER;
  const forwardToNumber = process.env.VONAGE_FORWARD_TO_NUMBER;

  if (!apiKey || !apiSecret) {
    throw new Error('Vonage credentials not configured. Please set VONAGE_API_KEY and VONAGE_API_SECRET.');
  }

  return { apiKey, apiSecret, vonageNumber, forwardToNumber };
}

export function getVonageClient(): Vonage {
  const { apiKey, apiSecret } = getVonageCredentials();
  const auth = new Auth({ apiKey, apiSecret });
  return new Vonage(auth);
}

export function isVonageConfigured(): boolean {
  try {
    getVonageCredentials();
    return true;
  } catch {
    return false;
  }
}
