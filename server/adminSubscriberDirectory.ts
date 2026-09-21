/**
 * Pure helpers for the platform-admin Subscribers directory.
 *
 * Kept free of DB imports so unit tests can run without DATABASE_URL.
 * Signup creates a `businesses` row plus an admin employee; the concierge
 * list must surface that owner email, not only the business name.
 */

export type SubscriberOwnerContact = {
  ownerEmail: string | null;
  ownerName: string | null;
};

export type SubscriberChecklistProgress = {
  requiredDone: number;
  requiredTotal: number;
};

export type SubscriberSummary = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  comped: boolean;
  createdAt: Date | string | null;
  requiredDone: number;
  requiredTotal: number;
  ownerEmail: string | null;
  ownerName: string | null;
  planKey: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
};

function nonEmpty(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function pickOwnerContact(args: {
  settings?: { ownerName?: string | null; businessEmail?: string | null } | null;
  admins: Array<{
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    createdAt?: Date | string | null;
  }>;
}): SubscriberOwnerContact {
  const admins = [...args.admins].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
  const first = admins[0];
  const nameFromAdmin = first
    ? [first.firstName, first.lastName].map(nonEmpty).filter((p): p is string => !!p).join(" ")
    : "";
  const ownerName = nonEmpty(args.settings?.ownerName) || nameFromAdmin || null;
  // Signup stores the typed address on the admin employee, not business_settings.
  const ownerEmail = nonEmpty(first?.email) || nonEmpty(args.settings?.businessEmail);
  return {
    ownerEmail: ownerEmail ? ownerEmail.toLowerCase() : null,
    ownerName,
  };
}

export function compareSubscribersNewestFirst(
  a: { createdAt: Date | string | null },
  b: { createdAt: Date | string | null },
): number {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return tb - ta;
}

export async function checklistProgressOrEmpty(
  load: () => Promise<SubscriberChecklistProgress>,
): Promise<SubscriberChecklistProgress> {
  try {
    return await load();
  } catch (err) {
    console.error(
      "[admin/subscribers] checklist failed (subscriber still listed):",
      (err as Error)?.message,
    );
    return { requiredDone: 0, requiredTotal: 0 };
  }
}
