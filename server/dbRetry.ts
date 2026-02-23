import { pool } from "./db";

function isTransientDbError(error: any): boolean {
  const msg = error?.message || '';
  const code = error?.code || '';
  return (
    msg.includes('Connection terminated') ||
    msg.includes('terminating connection') ||
    msg.includes('connection unexpectedly') ||
    msg.includes('Cannot set property message') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('socket hang up') ||
    msg.includes('Client has encountered a connection error') ||
    code === '57P01' ||
    code === '57P03' ||
    code === '08006' ||
    code === '08003' ||
    code === '08001'
  );
}

export async function withDbRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries && isTransientDbError(error)) {
        const delay = Math.min(500 * Math.pow(2, attempt), 3000);
        console.error(`Database transient error (retry ${attempt + 1}/${maxRetries}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}
