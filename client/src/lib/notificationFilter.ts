import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Every notification `type` that can appear in the bell. Add new entries here
// when adding new emitters server-side. A missing key in bellPreferences = use
// default visibility (true, fail-open).
export const NOTIFICATION_TYPES = [
  "photo_added",
  "note_added",
  "email_reply",
  "email_received",
  "sms_reply",
  "new_conversation",
  "new_lead",
  "reminder_stale_lead",
  "quote_sent",
  "quote_accepted",
  "proposal_sent",
  "proposal_accepted",
  "reminder_stale_quote",
  "job_status_change",
  "job_scheduled",
  "job_completed",
  "invoice_payment",
  "reminder_uninvoiced",
  "reschedule_request",
  "schedule_proposal_ready",
  "reminder_no_crew",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type BellPreferences = Partial<Record<NotificationType, boolean>>;

// Server-side emitters drifted into two extra spellings of the same job-status
// event. Treat all three as one toggle on the settings page (job_status_change)
// instead of confusing users with three almost-identical switches.
const TYPE_ALIASES: Record<string, NotificationType> = {
  job_status_changed: "job_status_change",
  job_status_update: "job_status_change",
};

function resolveType(type: string): string {
  return TYPE_ALIASES[type] ?? type;
}

// Legacy grouped preferences from before bell prefs moved to the server.
// One-time migration translates these into the per-type server format.
interface LegacyNotificationPrefs {
  browserNotifications?: boolean;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  emailActivity?: boolean;
  smsActivity?: boolean;
  proposalActivity?: boolean;
  photoActivity?: boolean;
  noteActivity?: boolean;
  quoteActivity?: boolean;
  jobStatusChanges?: boolean;
  leadActivity?: boolean;
  paymentActivity?: boolean;
  rescheduleRequests?: boolean;
}

const LEGACY_GROUP_TO_TYPES: Record<keyof LegacyNotificationPrefs, NotificationType[]> = {
  browserNotifications: [],
  emailNotifications: [],
  smsNotifications: [],
  emailActivity: ["email_reply", "email_received"],
  smsActivity: ["sms_reply"],
  proposalActivity: ["proposal_sent", "proposal_accepted"],
  photoActivity: ["photo_added"],
  noteActivity: ["note_added"],
  quoteActivity: ["quote_sent", "quote_accepted"],
  jobStatusChanges: ["job_status_change", "job_scheduled", "job_completed"],
  leadActivity: ["new_lead", "new_conversation", "reminder_stale_lead"],
  paymentActivity: ["invoice_payment", "reminder_uninvoiced"],
  rescheduleRequests: [
    "reschedule_request",
    "schedule_proposal_ready",
    "reminder_no_crew",
    "reminder_stale_quote",
  ],
};

const LEGACY_LOCALSTORAGE_KEY = "notificationPreferences";
const MIGRATION_FLAG_KEY = "bellPrefsMigratedV1";

function readLegacyLocalStorage(): LegacyNotificationPrefs | null {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as LegacyNotificationPrefs;
  } catch {
    return null;
  }
}

function legacyToBellPrefs(legacy: LegacyNotificationPrefs): BellPreferences {
  const out: BellPreferences = {};
  for (const [groupKey, types] of Object.entries(LEGACY_GROUP_TO_TYPES) as Array<
    [keyof LegacyNotificationPrefs, NotificationType[]]
  >) {
    if (legacy[groupKey] === false) {
      for (const t of types) out[t] = false;
    }
  }
  return out;
}

// Sanitise raw bellPreferences into a valid BellPreferences map: drop any
// keys that aren't in NOTIFICATION_TYPES and any values that aren't `false`.
// Earlier versions of the settings UI wrote response-envelope garbage into
// this column (nested `data` + `success`), so we defensively strip it on
// every read — the next PUT then overwrites the row with the clean shape.
const VALID_TYPES: ReadonlySet<string> = new Set(NOTIFICATION_TYPES);

function sanitiseBellPrefs(raw: unknown): BellPreferences {
  if (!raw || typeof raw !== "object") return {};
  const out: BellPreferences = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (VALID_TYPES.has(key) && value === false) {
      out[key as NotificationType] = false;
    }
  }
  return out;
}

async function fetchServerPrefs(): Promise<BellPreferences> {
  const res = await fetch("/api/notifications/preferences", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load notification preferences (${res.status})`);
  const json = await res.json();
  return sanitiseBellPrefs(json?.data?.bellPreferences);
}

async function putServerPrefs(bellPreferences: BellPreferences): Promise<BellPreferences> {
  // Pre-sanitise outgoing payload too — never PUT keys/values outside the
  // known schema, even if the in-memory state somehow has them.
  const clean = sanitiseBellPrefs(bellPreferences);
  const res = await fetch("/api/notifications/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ bellPreferences: clean }),
  });
  if (!res.ok) {
    // Capture status + short body snippet so the UI can surface the real
    // reason a save failed, since DevTools is hard to attach in a PWA.
    let bodySnippet = "";
    try {
      bodySnippet = (await res.text()).slice(0, 200);
    } catch {
      // ignore
    }
    throw new Error(`PUT ${res.status} ${res.statusText}${bodySnippet ? ` — ${bodySnippet}` : ""}`);
  }
  const json = await res.json();
  return sanitiseBellPrefs(json?.data?.bellPreferences);
}

const QUERY_KEY = ["/api/notifications/preferences"] as const;

export function useBellPreferences() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const serverPrefs = await fetchServerPrefs();

      // One-time migration: if server has no bell prefs yet AND user has legacy
      // localStorage prefs, translate the grouped keys into per-type and PUT.
      // Marker flag prevents repeat attempts.
      const alreadyMigrated = localStorage.getItem(MIGRATION_FLAG_KEY) === "v1";
      const serverEmpty = Object.keys(serverPrefs).length === 0;
      if (!alreadyMigrated && serverEmpty) {
        const legacy = readLegacyLocalStorage();
        if (legacy) {
          const migrated = legacyToBellPrefs(legacy);
          if (Object.keys(migrated).length > 0) {
            try {
              const saved = await putServerPrefs(migrated);
              localStorage.setItem(MIGRATION_FLAG_KEY, "v1");
              return saved;
            } catch (err) {
              console.error("Bell prefs migration failed:", err);
              return serverPrefs;
            }
          }
        }
        localStorage.setItem(MIGRATION_FLAG_KEY, "v1");
      }
      return serverPrefs;
    },
    // The global queryClient defaults set refetchInterval: 30000, which would
    // race against in-flight mutations and could clobber a freshly-saved
    // toggle with the pre-mutation server state. Bell prefs only change from
    // user input on this device, so no background polling is needed.
    refetchInterval: false,
    refetchOnWindowFocus: false,
    staleTime: 30_000,
    retry: 1,
  });

  const mutation = useMutation({
    mutationFn: (next: BellPreferences) => putServerPrefs(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEY });
      const previous = queryClient.getQueryData<BellPreferences>(QUERY_KEY);
      queryClient.setQueryData(QUERY_KEY, next);
      return { previous };
    },
    onError: (_err, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(QUERY_KEY, saved);
    },
  });

  const prefs: BellPreferences = query.data ?? {};

  return {
    prefs,
    isLoading: query.isLoading,
    isError: query.isError,
    saveError: mutation.error as Error | null,
    setPref: (type: NotificationType, visible: boolean) => {
      // Read latest from the cache, not the render-time closure, so two
      // toggles fired in the same frame don't each start from the same stale
      // base and clobber each other on the server.
      const latest =
        queryClient.getQueryData<BellPreferences>(QUERY_KEY) ?? prefs;
      const next: BellPreferences = { ...latest };
      if (visible) {
        delete next[type];
      } else {
        next[type] = false;
      }
      mutation.mutate(next);
    },
  };
}

export function isNotificationVisible(
  type: string,
  prefs: BellPreferences,
): boolean {
  const resolved = resolveType(type) as NotificationType;
  return prefs[resolved] !== false;
}
