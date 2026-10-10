// Merge a batch annotation lookup into the diary's in-memory map.
//
// A save that lands while the batch request is still in flight must win.
// Overwriting that entry with the older response (often "no annotation")
// puts the original photo back on screen the moment the request returns.

export function applyAnnotationBatch<T>(
  current: Record<string, T>,
  requested: string[],
  fetched: Record<string, T | undefined>,
  empty: () => T,
): Record<string, T> {
  let changed = false;
  const next: Record<string, T> = { ...current };
  for (const url of requested) {
    if (Object.prototype.hasOwnProperty.call(current, url)) continue;
    next[url] = fetched[url] ?? empty();
    changed = true;
  }
  return changed ? next : current;
}
