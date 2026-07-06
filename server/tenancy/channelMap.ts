/**
 * Inbound channel → tenant resolution.
 *
 * Session-less inbound handlers (Twilio voice/SMS webhooks, inbound email,
 * Messenger) have no logged-in user, so they cannot derive a tenant from the
 * request. This module maps an inbound identifier — the dialed number, the
 * inbound SMS sender, an email recipient, or a Facebook page id — to the owning
 * business, using the global `tenant_channels` table.
 *
 * Resolution MUST run on the owner (BYPASSRLS) connection: a webhook has no
 * tenant context, so it has to see every tenant's channel rows to find the
 * match. We therefore query `ownerDb` directly, never the RLS `db` proxy.
 *
 * Fail-soft by design: any error (e.g. the table not yet migrated during
 * rollout) resolves to `undefined`, which leaves the caller on its existing
 * default-tenant behaviour rather than crashing a webhook.
 */
import { and, eq } from "drizzle-orm";
import { ownerDb } from "../db";
import { tenantChannels } from "@shared/schema";

export type ChannelType = "phone" | "email" | "fb_page";

/**
 * Normalize an identifier to its stored, match-ready form.
 * - phone:   digits only, last 8 (matches findCustomerByPhoneLast8 — tolerates
 *            +64 / 0 / spacing variance across NZ numbers).
 * - email:   trimmed + lowercased.
 * - fb_page: trimmed.
 * Returns "" when there's nothing usable to match on.
 */
export function normalizeChannelIdentifier(channelType: ChannelType, raw: string | null | undefined): string {
  if (!raw) return "";
  if (channelType === "phone") return raw.replace(/\D/g, "").slice(-8);
  if (channelType === "email") return raw.trim().toLowerCase();
  return raw.trim();
}

/**
 * Resolve the businessId that owns an inbound identifier, or undefined if it
 * isn't mapped. Runs on the owner connection (sees all tenants). Never throws.
 */
export async function resolveBusinessIdByChannel(
  channelType: ChannelType,
  rawIdentifier: string | null | undefined,
): Promise<string | undefined> {
  const identifier = normalizeChannelIdentifier(channelType, rawIdentifier);
  if (!identifier) return undefined;
  try {
    const [row] = await ownerDb
      .select({ businessId: tenantChannels.businessId })
      .from(tenantChannels)
      .where(
        and(
          eq(tenantChannels.channelType, channelType),
          eq(tenantChannels.identifier, identifier),
          eq(tenantChannels.isActive, true),
        ),
      )
      .limit(1);
    return row?.businessId ?? undefined;
  } catch (err) {
    console.warn(`[channelMap] resolve ${channelType} failed (treating as unmapped):`, (err as Error).message);
    return undefined;
  }
}

/**
 * Register an inbound channel for a business. Idempotent — a duplicate
 * (channel_type, identifier) is a no-op (the UNIQUE index, enforced in the
 * migration, makes an identifier resolve to exactly one tenant). Runs on the
 * owner connection so onboarding/seeding works outside any request context.
 * No-op when there's nothing to normalize.
 */
export async function upsertTenantChannel(params: {
  businessId: string;
  channelType: ChannelType;
  identifier: string | null | undefined;
  label?: string;
}): Promise<void> {
  const identifier = normalizeChannelIdentifier(params.channelType, params.identifier);
  if (!identifier || !params.businessId) return;
  try {
    await ownerDb
      .insert(tenantChannels)
      .values({
        businessId: params.businessId,
        channelType: params.channelType,
        identifier,
        label: params.label,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.warn(`[channelMap] upsert ${params.channelType} failed:`, (err as Error).message);
  }
}

/**
 * Seed the inbound channels Treemarkables already uses, derived from the
 * single-tenant ENV config + the business's own email. Keeps single-tenant
 * resolution working immediately (and identically) the moment the map ships,
 * with no manual data entry. Idempotent. A second tenant registers its own
 * channels via upsertTenantChannel (admin/onboarding) — not from ENV.
 */
export async function seedChannelsFromEnv(businessId: string, businessEmail?: string | null): Promise<void> {
  if (!businessId) return;
  const phones = [
    process.env.TWILIO_PHONE_NUMBER,
    process.env.OWNER_PHONE_NUMBER,
    process.env.HERO_PHONE_NUMBER,
  ];
  for (const phone of phones) {
    await upsertTenantChannel({ businessId, channelType: "phone", identifier: phone, label: "seeded from env" });
  }
  if (businessEmail) {
    await upsertTenantChannel({ businessId, channelType: "email", identifier: businessEmail, label: "seeded from settings" });
  }
}
