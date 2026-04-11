import { useState, useEffect } from "react";

// ── Job Filter ────────────────────────────────────────────────────────────────
let _jobFilter = "all";
const _filterListeners = new Set<() => void>();

function notifyFilter() {
  _filterListeners.forEach((fn) => fn());
}

export function setJobFilter(v: string) {
  _jobFilter = v;
  notifyFilter();
}

export function useJobFilter(): [string, (v: string) => void] {
  const [filter, setLocal] = useState(_jobFilter);

  useEffect(() => {
    const sync = () => setLocal(_jobFilter);
    _filterListeners.add(sync);
    return () => { _filterListeners.delete(sync); };
  }, []);

  return [filter, setJobFilter];
}

// ── Mobile Search Open/Close ──────────────────────────────────────────────────
let _searchOpen = false;
const _searchListeners = new Set<() => void>();

function notifySearch() {
  _searchListeners.forEach((fn) => fn());
}

export function setDispatchSearchOpen(v: boolean) {
  _searchOpen = v;
  notifySearch();
}

export function useDispatchSearchOpen(): [boolean, (v: boolean) => void] {
  const [open, setLocal] = useState(_searchOpen);

  useEffect(() => {
    const sync = () => setLocal(_searchOpen);
    _searchListeners.add(sync);
    return () => { _searchListeners.delete(sync); };
  }, []);

  return [open, setDispatchSearchOpen];
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const DISPATCH_STATUS_FILTERS = [
  { value: "lead",       label: "Lead" },
  { value: "queue",      label: "Queue" },
  { value: "quote",      label: "Quote" },
  { value: "work_order", label: "W/O" },
  { value: "scheduled",  label: "Scheduled" },
] as const;
