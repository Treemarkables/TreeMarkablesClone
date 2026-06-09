// Foreground-reload guard registry.
//
// On iOS WKWebView / PWAs the app force-reloads when it comes back to the
// foreground after being backgrounded a while, so users pick up fresh code
// (see client/src/main.tsx). That reload is destructive if the user has
// in-progress work on screen — locking the phone mid-edit and returning would
// wipe anything not yet auto-saved (job-card auto-save history makes this real).
//
// Any surface with unsaved work registers a predicate here. Before reloading,
// main.tsx asks isReloadUnsafe(); if anything says "I'm mid-edit", the reload is
// skipped and retried on the next foreground instead.

type ReloadGuard = () => boolean;

const guards = new Set<ReloadGuard>();

/** Register a predicate that returns true while a foreground reload would lose work.
 *  Returns an unregister function — call it on unmount. */
export function registerReloadGuard(guard: ReloadGuard): () => void {
  guards.add(guard);
  return () => {
    guards.delete(guard);
  };
}

/** True if any registered surface currently has work a reload would destroy. */
export function isReloadUnsafe(): boolean {
  let unsafe = false;
  guards.forEach((guard) => {
    try {
      if (guard()) unsafe = true;
    } catch {
      // A throwing guard shouldn't make a reload unconditionally unsafe.
    }
  });
  return unsafe;
}
