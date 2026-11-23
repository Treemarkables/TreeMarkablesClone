import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Loader2,
  MapPin,
  MapPinOff,
} from 'lucide-react';
import type { Job } from '@shared/schema';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type RiskLevel = 'none' | 'elevated' | 'high';

interface DayMapJob {
  id: string;
  jobNumber: string | null;
  title: string | null;
  customerId: string | null;
  address: string | null;
  status: string;
  priority: string | null;
  scheduledStartTime: string | null;
  scheduledEndTime: string | null;
  assignedTeam: string[];
  lat: number | null;
  lng: number | null;
  risk: { level: RiskLevel; reasons: string[]; urgent: boolean };
}

interface IdentityColor { bg: string; border: string; text: string }

interface ScheduleDayMapProps {
  dateStr: string;
  /** The roster's jobs for the day — pin numbers follow this order. */
  jobs: Job[];
  jobColorMap: Map<string, IdentityColor>;
  customerMap: Map<string, string>;
  onOpenJob: (job: Job) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RISK_COLOR: Record<RiskLevel, string> = {
  high: '#dc2626',     // red-600
  elevated: '#f59e0b', // amber-500
  none: '#2563eb',     // fallback only — unflagged pins use the job identity colour
};
const RISK_LABEL: Record<RiskLevel, string> = {
  high: 'High risk',
  elevated: 'Watch',
  none: '',
};
const STORAGE_KEY = 'staff-schedule-map-open';
// Only used while the map has nothing to fit to — never visible once pins load.
const NZ_FALLBACK_CENTER: [number, number] = [-40.9, 174.9];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

// Numbered pin. Risky pins get a pulsing halo + warning badge so they read
// from across the room; unflagged pins carry the job's roster colour.
function createPinIcon(n: number, color: string, level: RiskLevel, urgent: boolean): L.DivIcon {
  const size = level === 'none' ? 28 : 34;
  const badge = level !== 'none' || urgent
    ? `<div style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:#111827;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;line-height:1;font-family:sans-serif">!</div>`
    : '';
  const pulse = level === 'high'
    ? `<div class="roster-pin-pulse" style="border-color:${color}"></div>`
    : '';
  return L.divIcon({
    className: 'roster-day-pin',
    html: `<div style="position:relative;width:${size}px;height:${size}px">
      ${pulse}
      <div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${n > 9 ? '12px' : '14px'};font-family:sans-serif;line-height:1">${escapeHtml(String(n))}</div>
      ${badge}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function FitToPins({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  const key = points.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 15);
      return;
    }
    // Keep pins clear of the zoom control (top-left) and the one-line legend
    // (bottom-left).
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: [48, 24],
      paddingBottomRight: [24, 44],
      maxZoom: 15,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

// Renders as a column to the right of the day Gantt on desktop (collapsing to
// a thin rail) and as a collapsible strip under it on phones.
export function ScheduleDayMap({ dateStr, jobs, jobColorMap, customerMap, onOpenJob }: ScheduleDayMapProps) {
  // Open by default on desktop; collapsed on phones where the roster needs the
  // height. Either way the user's last choice sticks.
  const [open, setOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === '1') return true;
      if (saved === '0') return false;
    } catch { /* private mode */ }
    return typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true;
  });
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, open ? '1' : '0'); } catch { /* private mode */ }
  }, [open]);

  // Risk counts are worth fetching even while collapsed — the rail shows them.
  const { data, isLoading, isError } = useQuery<{ success: boolean; data: DayMapJob[] }>({
    queryKey: ['/api/schedule/day-map', dateStr],
    queryFn: () => fetch(`/api/schedule/day-map?date=${dateStr}`).then((r) => r.json()),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const rosterOrder = useMemo(() => {
    const m = new Map<string, number>();
    jobs.forEach((j, i) => m.set(j.id, i + 1));
    return m;
  }, [jobs]);
  const rosterJobs = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  const mapJobs = useMemo(() => {
    const rows = Array.isArray(data?.data) ? data.data : [];
    return [...rows].sort((a, b) => (rosterOrder.get(a.id) ?? 999) - (rosterOrder.get(b.id) ?? 999));
  }, [data, rosterOrder]);

  const located = mapJobs.filter((j) => j.lat != null && j.lng != null);
  const unlocated = mapJobs.filter((j) => j.address && (j.lat == null || j.lng == null));
  const noAddress = mapJobs.filter((j) => !j.address);
  const flagged = mapJobs.filter((j) => j.risk.level !== 'none' || j.risk.urgent);
  const highCount = mapJobs.filter((j) => j.risk.level === 'high').length;
  const watchCount = mapJobs.filter((j) => j.risk.level === 'elevated').length;

  const labelFor = (j: DayMapJob) =>
    (j.customerId ? customerMap.get(j.customerId) : '') || j.title || (j.jobNumber ? `#${j.jobNumber}` : 'Job');
  const pinNumber = (j: DayMapJob) => rosterOrder.get(j.id) ?? (mapJobs.indexOf(j) + 1);
  const pinColor = (j: DayMapJob) =>
    j.risk.level !== 'none' ? RISK_COLOR[j.risk.level] : (jobColorMap.get(j.id)?.border ?? RISK_COLOR.none);
  const openById = (id: string) => {
    const job = rosterJobs.get(id);
    if (job) onOpenJob(job);
  };

  const points = located.map((j): [number, number] => [j.lat as number, j.lng as number]);

  const riskChips = !isLoading && mapJobs.length > 0 && (
    <>
      {highCount > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
          <AlertTriangle className="h-3 w-3" />
          {highCount} high risk
        </span>
      )}
      {watchCount > 0 && (
        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap">
          {watchCount} to watch
        </span>
      )}
    </>
  );

  // ── Collapsed: a thin rail on desktop, a one-line bar on phones ──
  if (!open) {
    return (
      <aside className="shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 md:w-10 md:h-full">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full h-full flex md:flex-col items-center gap-2 md:gap-3 px-4 md:px-0 py-1.5 md:py-3 text-left"
          aria-expanded={false}
          title="Show job map"
        >
          <ChevronUp className="md:hidden h-4 w-4 text-gray-400 shrink-0" />
          <ChevronLeft className="hidden md:block h-4 w-4 text-gray-400 shrink-0" />
          <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          <span className="text-xs font-semibold text-gray-800 md:[writing-mode:vertical-rl] md:rotate-180 whitespace-nowrap">
            Job map
          </span>
          {highCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold"
              title={`${highCount} high-risk job${highCount === 1 ? '' : 's'}`}
            >
              {highCount}
            </span>
          )}
          {watchCount > 0 && (
            <span
              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold"
              title={`${watchCount} job${watchCount === 1 ? '' : 's'} to watch`}
            >
              {watchCount}
            </span>
          )}
          <span className="md:hidden ml-auto text-[10px] text-gray-500">
            {highCount === 0 && watchCount === 0 && !isLoading && mapJobs.length > 0 ? 'No risk flags' : ''}
          </span>
        </button>
      </aside>
    );
  }

  // ── Open: right-hand column (desktop) / stacked strip (phones) ──
  return (
    <aside className="shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col min-h-0 md:h-full md:w-80 lg:w-96 max-h-[60vh] md:max-h-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-100 shrink-0">
        <span className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <MapPin className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          <span className="text-xs font-semibold text-gray-800">Job map</span>
          {riskChips}
          {!isLoading && mapJobs.length > 0 && highCount === 0 && watchCount === 0 && (
            <span className="text-[10px] text-gray-500">No risk flags</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 p-0.5 rounded text-gray-400"
          aria-expanded
          title="Hide job map"
        >
          <ChevronDown className="md:hidden h-4 w-4" />
          <ChevronRight className="hidden md:block h-4 w-4" />
        </button>
      </div>

      {/* Map */}
      <div className={`relative isolate z-0 shrink-0 bg-gray-100 ${located.length > 0 || isLoading ? 'h-48 md:h-64' : 'h-20'}`}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-xs text-gray-500 z-[1000] bg-gray-100/80">
            <Loader2 className="h-4 w-4 animate-spin" />
            Locating the day's jobs…
          </div>
        )}
        {isError && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-red-600 z-[1000] bg-gray-100">
            Couldn't load the job map.
          </div>
        )}
        {!isLoading && !isError && located.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-3 text-center text-xs text-gray-500 z-[1000] bg-gray-100">
            <MapPinOff className="h-5 w-5 text-gray-400" />
            {mapJobs.length === 0 ? 'No jobs booked on this day' : "None of the day's jobs could be placed on the map"}
          </div>
        )}
        {located.length > 0 && (
          <MapContainer
            center={NZ_FALLBACK_CENTER}
            zoom={5}
            scrollWheelZoom
            className="h-full w-full"
            attributionControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToPins points={points} />
            {located.map((j) => (
              <Marker
                key={j.id}
                position={[j.lat as number, j.lng as number]}
                icon={createPinIcon(pinNumber(j), pinColor(j), j.risk.level, j.risk.urgent)}
                zIndexOffset={j.risk.level === 'high' ? 1000 : j.risk.level === 'elevated' ? 500 : 0}
              >
                <Popup>
                  <div className="min-w-[180px] max-w-[240px] text-xs space-y-1.5">
                    <div>
                      <p className="font-semibold text-gray-900 leading-tight">
                        {pinNumber(j)}. {labelFor(j)}
                      </p>
                      {j.jobNumber && <p className="text-[10px] text-gray-500">#{j.jobNumber}</p>}
                    </div>
                    <p className="text-gray-600">{j.address}</p>
                    {(j.scheduledStartTime || j.scheduledEndTime) && (
                      <p className="text-gray-600">
                        {formatTime(j.scheduledStartTime)}{j.scheduledEndTime ? ` – ${formatTime(j.scheduledEndTime)}` : ''}
                      </p>
                    )}
                    {(j.risk.level !== 'none' || j.risk.urgent) && (
                      <div
                        className="rounded-md px-2 py-1.5"
                        style={{ backgroundColor: j.risk.level === 'high' ? '#fef2f2' : '#fffbeb', border: `1px solid ${j.risk.level === 'high' ? '#fca5a5' : '#fcd34d'}` }}
                      >
                        <p className="font-semibold flex items-center gap-1" style={{ color: j.risk.level === 'high' ? '#991b1b' : '#92400e' }}>
                          <AlertTriangle className="h-3 w-3" />
                          {j.risk.level !== 'none' ? RISK_LABEL[j.risk.level] : 'Priority'}
                          {j.risk.urgent && j.risk.level !== 'none' ? ' · urgent' : ''}
                        </p>
                        {j.risk.reasons.length > 0 && (
                          <ul className="mt-1 space-y-0.5 list-disc pl-4 text-gray-700">
                            {j.risk.reasons.map((r) => <li key={r}>{r}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                    <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => openById(j.id)}>
                      Open job
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}

        {/* One-line legend */}
        {located.length > 0 && (
          <div className="absolute bottom-1.5 left-1.5 z-[500] flex items-center gap-2 rounded-md bg-white/95 shadow px-2 py-1 text-[10px] text-gray-700 pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLOR.high }} />
              High risk
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_COLOR.elevated }} />
              Watch
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Job
            </span>
          </div>
        )}
      </div>

      {/* Risk rundown */}
      <div className="flex-1 min-h-0 overflow-auto">
        {!isLoading && !isError && mapJobs.length > 0 && (
          <div className="px-3 py-2 space-y-2">
            {flagged.length > 0 ? (
              <>
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Risks on this run</p>
                <ul className="space-y-1.5">
                  {flagged.map((j) => {
                    const high = j.risk.level === 'high';
                    return (
                      <li key={j.id}>
                        <button
                          type="button"
                          onClick={() => openById(j.id)}
                          className="w-full text-left rounded-md px-2 py-1.5 border"
                          style={{
                            backgroundColor: high ? '#fef2f2' : '#fffbeb',
                            borderColor: high ? '#fca5a5' : '#fcd34d',
                          }}
                        >
                          <div className="flex items-start gap-2">
                            <span
                              className="mt-0.5 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                              style={{ backgroundColor: pinColor(j) }}
                            >
                              {pinNumber(j)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-gray-900 truncate">{labelFor(j)}</p>
                              <p className="text-[10px] font-semibold" style={{ color: high ? '#991b1b' : '#92400e' }}>
                                {j.risk.level !== 'none' ? RISK_LABEL[j.risk.level] : 'Priority'}
                                {j.risk.urgent ? ' · urgent' : ''}
                                {j.lat == null ? ' · not on map' : ''}
                              </p>
                              {j.risk.reasons.length > 0 && (
                                <p className="text-[10px] text-gray-700 leading-snug">{j.risk.reasons.join(' · ')}</p>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <p className="text-xs text-gray-500">No risk assessments, hazard pins or hazard notes flagged on this day's jobs.</p>
            )}

            {(unlocated.length > 0 || noAddress.length > 0) && (
              <div className="pt-1 border-t border-gray-100 space-y-1">
                <p className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">Not on the map</p>
                {unlocated.map((j) => (
                  <button key={j.id} type="button" onClick={() => openById(j.id)} className="w-full text-left text-[11px] text-gray-600 truncate">
                    {pinNumber(j)}. {labelFor(j)} — address not found
                  </button>
                ))}
                {noAddress.map((j) => (
                  <button key={j.id} type="button" onClick={() => openById(j.id)} className="w-full text-left text-[11px] text-gray-600 truncate">
                    {pinNumber(j)}. {labelFor(j)} — no address on job
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
