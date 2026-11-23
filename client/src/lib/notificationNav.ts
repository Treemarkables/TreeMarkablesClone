import {
  DISPATCH_OPEN_ENTRY_KEY,
  DISPATCH_OPEN_JOB_KEY,
  DISPATCH_OPEN_TAB_KEY,
  NOTIFICATION_NAV_STORAGE_KEY,
  entryFromNotificationPath,
  jobIdFromNotificationPath,
  parseStoredNotificationNav,
  serializeStoredNotificationNav,
  tabFromNotificationPath,
} from "@shared/notificationDeepLink";

/**
 * Persist a notification deep-link across the races that otherwise dump a
 * tap on the bare dispatch board:
 *   • frozen-resume reload (heartbeat stale after background)
 *   • `/` → `/dispatch` redirect before DispatchBoard mounts
 *   • lazy Dispatch chunk not mounted when notification-navigation fires
 *
 * Do NOT consume/remove until the destination (job card or other route)
 * confirms it applied the path.
 */
export function persistNotificationNav(path: string, now = Date.now()): void {
  if (!path) return;
  (window as unknown as { __notificationNavHandled?: boolean }).__notificationNavHandled = false;
  const payload = serializeStoredNotificationNav(path, now);
  try {
    localStorage.setItem(NOTIFICATION_NAV_STORAGE_KEY, payload);
  } catch {
    /* private mode */
  }
  (window as unknown as { __pendingNotificationPath?: string | null }).__pendingNotificationPath = path;

  const jobId = jobIdFromNotificationPath(path);
  if (jobId) {
    try {
      sessionStorage.setItem(DISPATCH_OPEN_JOB_KEY, jobId);
      const tab = tabFromNotificationPath(path);
      if (tab) sessionStorage.setItem(DISPATCH_OPEN_TAB_KEY, tab);
      else sessionStorage.removeItem(DISPATCH_OPEN_TAB_KEY);
      const entry = entryFromNotificationPath(path);
      if (entry) sessionStorage.setItem(DISPATCH_OPEN_ENTRY_KEY, entry);
      else sessionStorage.removeItem(DISPATCH_OPEN_ENTRY_KEY);
    } catch {
      /* ignore */
    }
  }
}

export function peekNotificationNav(now = Date.now()): string | null {
  const early = (window as unknown as { __pendingNotificationPath?: string | null }).__pendingNotificationPath;
  if (typeof early === "string" && early) return early;
  try {
    return parseStoredNotificationNav(localStorage.getItem(NOTIFICATION_NAV_STORAGE_KEY), now);
  } catch {
    return null;
  }
}

export function clearNotificationNav(): void {
  (window as unknown as { __pendingNotificationPath?: string | null }).__pendingNotificationPath = null;
  try {
    localStorage.removeItem(NOTIFICATION_NAV_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function peekDispatchOpenJob(): {
  jobId: string;
  tab?: "details" | "billing" | "checklist" | "diary";
  entry?: string;
} | null {
  try {
    const jobId = sessionStorage.getItem(DISPATCH_OPEN_JOB_KEY);
    if (!jobId) return null;
    const tabRaw = sessionStorage.getItem(DISPATCH_OPEN_TAB_KEY);
    const tab =
      tabRaw === "diary" || tabRaw === "checklist" || tabRaw === "billing" || tabRaw === "details"
        ? tabRaw
        : undefined;
    const entry = sessionStorage.getItem(DISPATCH_OPEN_ENTRY_KEY) || undefined;
    return { jobId, tab, entry };
  } catch {
    return null;
  }
}

export function clearDispatchOpenJob(): void {
  try {
    sessionStorage.removeItem(DISPATCH_OPEN_JOB_KEY);
    sessionStorage.removeItem(DISPATCH_OPEN_TAB_KEY);
    sessionStorage.removeItem(DISPATCH_OPEN_ENTRY_KEY);
  } catch {
    /* ignore */
  }
}

export function ackNativeNotificationTap(): void {
  try {
    (window as unknown as { __notificationNavHandled?: boolean }).__notificationNavHandled = true;
    window.dispatchEvent(new Event("nativeNotificationTapAck"));
    window.dispatchEvent(new Event("nativeNotificationTapHandled"));
  } catch {
    /* ignore */
  }
}
