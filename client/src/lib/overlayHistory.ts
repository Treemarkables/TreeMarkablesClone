/**
 * Hardware-back stack for fullscreen overlays (job card, photo viewer).
 *
 * Android WebView back does not close a React modal. It walks WebView
 * history, and with no history entry it finishes the activity. Each open
 * overlay pushes one same-URL history entry. Back pops only the top overlay.
 * Closing with a button drops that entry without also closing the overlay
 * underneath.
 */

export interface OverlayHistory {
  getState: () => unknown;
  pushState: (state: unknown) => void;
  back: () => void;
  addPopListener: (cb: () => void) => () => void;
}

type Entry = { id: number; close: () => void };

export function createOverlayHistory(history: OverlayHistory) {
  const stack: Entry[] = [];
  let seq = 0;
  let suppress = 0;
  let removeListener: (() => void) | null = null;

  const onPop = () => {
    if (suppress > 0) {
      suppress -= 1;
      return;
    }
    const top = stack.pop();
    top?.close();
  };

  return {
    push(close: () => void): () => void {
      if (!removeListener) removeListener = history.addPopListener(onPop);
      const id = ++seq;
      const entry: Entry = { id, close };
      stack.push(entry);
      const prev = history.getState();
      const base =
        prev && typeof prev === "object" ? { ...(prev as Record<string, unknown>) } : {};
      history.pushState({ ...base, inflowOverlay: id });
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const idx = stack.indexOf(entry);
        if (idx >= 0) stack.splice(idx, 1);
        const state = history.getState() as { inflowOverlay?: number } | null;
        if (state?.inflowOverlay === id) {
          suppress += 1;
          history.back();
        }
      };
    },
  };
}

function browserHistory(): OverlayHistory {
  return {
    getState: () => window.history.state,
    pushState: (state) => window.history.pushState(state, ""),
    back: () => window.history.back(),
    addPopListener: (cb) => {
      window.addEventListener("popstate", cb);
      return () => window.removeEventListener("popstate", cb);
    },
  };
}

let browserController: ReturnType<typeof createOverlayHistory> | null = null;

/** Push a history entry while `open` is true. Back calls `onBack` once. */
export function bindOverlayHistory(open: boolean, onBack: () => void): () => void {
  if (!open || typeof window === "undefined") return () => {};
  if (!browserController) browserController = createOverlayHistory(browserHistory());
  return browserController.push(onBack);
}
