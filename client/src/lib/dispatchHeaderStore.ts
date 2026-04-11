import { useState, useEffect } from "react";

let _jobFilter = "all";
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

export function getJobFilter() {
  return _jobFilter;
}

export function setJobFilter(v: string) {
  _jobFilter = v;
  notify();
}

export function useJobFilter(): [string, (v: string) => void] {
  const [filter, setLocal] = useState(_jobFilter);

  useEffect(() => {
    const sync = () => setLocal(_jobFilter);
    _listeners.add(sync);
    return () => { _listeners.delete(sync); };
  }, []);

  const set = (v: string) => setJobFilter(v);
  return [filter, set];
}

export const DISPATCH_STATUS_FILTERS = [
  { value: "lead",       label: "Lead" },
  { value: "queue",      label: "Queue" },
  { value: "quote",      label: "Quote" },
  { value: "work_order", label: "W/O" },
  { value: "scheduled",  label: "Scheduled" },
] as const;
