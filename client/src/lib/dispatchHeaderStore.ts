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

// ── Only Unconfirmed Toggle ───────────────────────────────────────────────────
let _onlyUnconfirmed = false;
const _onlyUnconfirmedListeners = new Set<() => void>();

function notifyOnlyUnconfirmed() {
  _onlyUnconfirmedListeners.forEach((fn) => fn());
}

export function setOnlyUnconfirmed(v: boolean) {
  _onlyUnconfirmed = v;
  notifyOnlyUnconfirmed();
}

export function useOnlyUnconfirmed(): [boolean, (v: boolean) => void] {
  const [v, setLocal] = useState(_onlyUnconfirmed);

  useEffect(() => {
    const sync = () => setLocal(_onlyUnconfirmed);
    _onlyUnconfirmedListeners.add(sync);
    return () => { _onlyUnconfirmedListeners.delete(sync); };
  }, []);

  return [v, setOnlyUnconfirmed];
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Note: `"scheduled"` here is a FILTER value, not a job status. The job
// status `'scheduled'` was retired 2026-05 — the "Scheduled" chip now
// filters for work_orders that have a scheduledDate set on the calendar.
export const DISPATCH_STATUS_FILTERS = [
  { value: "lead",       label: "Lead" },
  { value: "queue",      label: "Queue" },
  { value: "quote",      label: "Quote" },
  { value: "mulch",      label: "Mulch" },
  { value: "work_order", label: "W/O" },
  { value: "scheduled",  label: "Scheduled" },
] as const;
