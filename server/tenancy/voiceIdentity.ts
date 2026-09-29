/**
 * Per-business Twilio Voice client identities.
 *
 * Inbound customer calls are dialled to one identity. That identity used to be
 * a single shared name (`treemarkables-owner`) issued to every admin, so any
 * business's TestFlight app rang for Treemarkables calls. Identities are now
 * `inflow-<businessId>` for the people who should ring, and
 * `inflow-<businessId>-<employeeId>` for everyone else.
 */

const BUSINESS_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isBusinessId(value: string | undefined | null): value is string {
  return !!value && BUSINESS_ID.test(value);
}

/** Identity the answer webhook dials for a business's inbound calls. */
export function inboundVoiceIdentity(businessId: string): string {
  return `inflow-${businessId}`;
}

/** Identity for a signed-in device that must not ring on the business's inbound line. */
export function employeeVoiceIdentity(businessId: string, employeeId: string): string {
  return `inflow-${businessId}-${employeeId}`;
}

export function voiceIdentityForEmployee(
  businessId: string,
  employeeId: string,
  isAdmin: boolean,
): string {
  return isAdmin
    ? inboundVoiceIdentity(businessId)
    : employeeVoiceIdentity(businessId, employeeId);
}

/**
 * Pull the business id out of a Voice SDK `From` header (`client:inflow-<uuid>`
 * or `client:inflow-<uuid>-<employeeUuid>`). Anything else is not one of our
 * tokens.
 */
export function businessIdFromVoiceClient(fromHeader: string | undefined | null): string | undefined {
  if (!fromHeader) return undefined;
  const identity = fromHeader.startsWith("client:") ? fromHeader.slice("client:".length) : fromHeader;
  const match = identity.match(
    /^inflow-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:-|$)/i,
  );
  return match?.[1];
}
