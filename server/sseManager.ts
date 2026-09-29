import type { Response } from 'express';
import { currentBusinessId } from './tenancy/tenantStore';

type SseClient = { res: Response; businessId?: string };

const clients = new Set<SseClient>();

export function addClient(res: Response, businessId?: string): void {
  clients.add({ res, businessId });
}

export function removeClient(res: Response): void {
  for (const client of clients) {
    if (client.res === res) clients.delete(client);
  }
}

/**
 * Tell open apps to refetch. When the event belongs to a business (explicit
 * id, or the business bound on this async context), only that business's
 * connections receive it. A broadcast with no business — a cron that walks
 * every tenant — still pings everyone, and the follow-up fetch is itself
 * business-scoped, so the payload here is only query keys.
 */
export function broadcast(queries: string[], businessId?: string): void {
  if (clients.size === 0) return;
  const bid = businessId ?? currentBusinessId();
  const payload = `data: ${JSON.stringify({ queries })}\n\n`;
  for (const client of clients) {
    if (bid && client.businessId !== bid) continue;
    try {
      client.res.write(payload);
    } catch {
      clients.delete(client);
    }
  }
}
