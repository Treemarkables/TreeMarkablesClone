import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

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

async function fetchServerPrefs(): Promise<BellPreferences> {
  const res = await fetch("/api/notifications/preferences", { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load notification preferences (${res.status})`);
  const json = await res.json();
  return (json?.data?.bellPreferences as BellPreferences | null) ?? {};
}

async function putServerPrefs(bellPreferences: BellPreferences): Promise<BellPreferences> {
  const res = await fetch("/api/notifications/preferences", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ bellPreferences }),
  });
  if (!res.ok) throw new Error(`Failed to update notification preferences (${res.status})`);
  const json = await res.json();
  return (json?.data?.bellPreferences as BellPreferences | null) ?? {};
}

const QUERY_KEY = ["/api/notifications/preferences"] as const;

export function useBellPreferences() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    onError: (err, _next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(QUERY_KEY, context.previous);
      }
      toast({
        title: "Couldn't save notification preference",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
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
    setPref: (type: NotificationType, visible: boolean) => {
      const next: BellPreferences = { ...prefs };
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
