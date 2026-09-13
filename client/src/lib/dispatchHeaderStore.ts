import { useState, useEffect } from "react";

// ── Job Filter ────────────────────────────────────────────────────────────────
// Multi-select: an empty array means "All". Multiple values are OR-combined by
// the Dispatch Board (e.g. ["work_order", "scheduled"] shows both tabs' jobs at
// once — needed when rescheduling, so booked and bookable jobs sit side by side).
let _jobFilters: string[] = [];
const _filterListeners = new Set<() => void>();

function notifyFilter() {
  _filterListeners.forEach((fn) => fn());
}

export function setJobFilters(v: string[]) {
  _jobFilters = v;
  notifyFilter();
}

export function toggleJobFilter(v: string) {
  _jobFilters = _jobFilters.includes(v)
    ? _jobFilters.filter((f) => f !== v)
    : [..._jobFilters, v];
  notifyFilter();
}

export function useJobFilters(): [string[], (v: string[]) => void] {
  const [filters, setLocal] = useState(_jobFilters);

  useEffect(() => {
    const sync = () => setLocal(_jobFilters);
    _filterListeners.add(sync);
    return () => { _filterListeners.delete(sync); };
  }, []);

  return [filters, setJobFilters];
}

// ── Lane Filter ───────────────────────────────────────────────────────────────
// Orthogonal to the status filter above. "all" = no lane filtering; otherwise a lane id.
// When set, the Dispatch Board shows every active job in that lane regardless of status tab.
let _laneFilter = "all";
const _laneListeners = new Set<() => void>();

function notifyLane() {
  _laneListeners.forEach((fn) => fn());
}

export function setLaneFilter(v: string) {
  _laneFilter = v;
  notifyLane();
}

export function useLaneFilter(): [string, (v: string) => void] {
  const [filter, setLocal] = useState(_laneFilter);

  useEffect(() => {
    const sync = () => setLocal(_laneFilter);
    _laneListeners.add(sync);
    return () => { _laneListeners.delete(sync); };
  }, []);

  return [filter, setLaneFilter];
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
// status `'scheduled'` was retired 2026-05 — the "Scheduled" chip filters
// for work_orders with a current-or-future booking, and "Unscheduled"
// (value kept as `work_order`) is its complement: work_orders that still
// need a calendar slot, including ones whose booking is entirely past.
// The Dispatch Queue "Queue" chip was removed 2026-07 — queue-style holds are
// modelled as Lanes now (e.g. a "Queue work order" lane via the Lanes filter),
// and queued jobs must stay visible under All / Unscheduled / Scheduled.
// "Work Order" (`work_order_all`) is the union of Unscheduled + Scheduled:
// every job with status work_order regardless of booking state. Because the
// board excludes completed/invoiced jobs, this chip is the review view for
// accepted work that hasn't been invoiced yet.
export const DISPATCH_STATUS_FILTERS = [
  { value: "lead",           label: "Lead" },
  { value: "quote",          label: "Quote" },
  { value: "mulch",          label: "Mulch" },
  { value: "work_order_all", label: "Work Order" },
  { value: "work_order",     label: "Unscheduled" },
  { value: "scheduled",      label: "Scheduled" },
] as const;
