// Library — unified media search across all photos + videos. Users can filter by
// keyword (q), date range, and tag, then switch between a grid view and a Leaflet
// map view that pins anything with GPS coords. Powered by POST /api/photos/search
// and POST /api/videos/search.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Image as ImageIcon, Video as VideoIcon, MapPin, Grid3x3, Map as MapIcon, Search } from "lucide-react";
import { formatNZTime } from "@shared/dateUtils";

type MediaItem = {
  id: string;
  kind: "photo" | "video";
  url: string;
  thumbnailUrl?: string | null;
  title?: string | null;
  description?: string | null;
  notes?: string | null;
  filename?: string | null;
  capturedAt?: string | null;
  createdAt?: string | null;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAddress?: string | null;
  tags?: string[] | null;
  jobId?: string | null;
};

type View = "grid" | "map";
type Kind = "all" | "photos" | "videos";

function photoIcon(): L.DivIcon {
  return L.divIcon({
    className: "library-photo-marker",
    html: `<div style="background:#22c55e;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

function videoIcon(): L.DivIcon {
  return L.divIcon({
    className: "library-video-marker",
    html: `<div style="background:#3b82f6;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
}

export default function Library() {
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tag, setTag] = useState("");
  const [kindFilter, setKindFilter] = useState<Kind>("all");
  const [view, setView] = useState<View>("grid");
  const [submittedFilters, setSubmittedFilters] = useState({ q: "", dateFrom: "", dateTo: "", tag: "", kindFilter: "all" as Kind });

  const submit = () => setSubmittedFilters({ q, dateFrom, dateTo, tag, kindFilter });

  const photoBody = useMemo(() => {
    const body: Record<string, unknown> = { limit: 100 };
    if (submittedFilters.q) body.q = submittedFilters.q;
    if (submittedFilters.dateFrom) body.dateFrom = new Date(submittedFilters.dateFrom).toISOString();
    if (submittedFilters.dateTo) body.dateTo = new Date(`${submittedFilters.dateTo}T23:59:59`).toISOString();
    if (submittedFilters.tag) body.tags = [submittedFilters.tag];
    return body;
  }, [submittedFilters]);

  const videoBody = useMemo(() => {
    const body: Record<string, unknown> = { limit: 100 };
    if (submittedFilters.q) body.q = submittedFilters.q;
    if (submittedFilters.dateFrom) body.dateFrom = new Date(submittedFilters.dateFrom).toISOString();
    if (submittedFilters.dateTo) body.dateTo = new Date(`${submittedFilters.dateTo}T23:59:59`).toISOString();
    return body;
  }, [submittedFilters]);

  const photosQuery = useQuery({
    queryKey: ["/api/photos/search", photoBody],
    queryFn: async () => {
      const r = await fetch("/api/photos/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photoBody),
        credentials: "include",
      });
      if (!r.ok) return { photos: [] };
      return r.json();
    },
    enabled: submittedFilters.kindFilter !== "videos",
  });

  const videosQuery = useQuery({
    queryKey: ["/api/videos/search", videoBody],
    queryFn: async () => {
      const r = await fetch("/api/videos/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoBody),
        credentials: "include",
      });
      if (!r.ok) return { videos: [] };
      return r.json();
    },
    enabled: submittedFilters.kindFilter !== "photos",
  });

  const items: MediaItem[] = useMemo(() => {
    const photos: MediaItem[] = (photosQuery.data?.photos || []).map((p: any) => ({
      id: p.id,
      kind: "photo" as const,
      url: p.url,
      thumbnailUrl: p.thumbnailUrl,
      title: null,
      description: p.aiDescription,
      notes: p.notes,
      filename: p.filename,
      capturedAt: p.capturedAt,
      createdAt: p.createdAt,
      gpsLatitude: p.gpsLatitude,
      gpsLongitude: p.gpsLongitude,
      gpsAddress: p.gpsAddress,
      tags: p.tags,
      jobId: p.jobId,
    }));
    const videos: MediaItem[] = (videosQuery.data?.videos || []).map((v: any) => ({
      id: v.id,
      kind: "video" as const,
      url: v.url,
      thumbnailUrl: v.thumbnailUrl,
      title: v.title,
      description: v.description,
      notes: null,
      filename: v.filename,
      capturedAt: null,
      createdAt: v.createdAt,
      gpsLatitude: v.gpsLatitude,
      gpsLongitude: v.gpsLongitude,
      gpsAddress: v.gpsAddress,
      tags: null,
      jobId: v.jobId,
    }));
    const merged = [...photos, ...videos];
    merged.sort((a, b) => {
      const aTime = new Date(a.capturedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.capturedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
    return merged;
  }, [photosQuery.data, videosQuery.data]);

  const itemsWithGps = items.filter((i) => i.gpsLatitude != null && i.gpsLongitude != null);
  const mapCenter: [number, number] = itemsWithGps.length > 0
    ? [itemsWithGps[0].gpsLatitude as number, itemsWithGps[0].gpsLongitude as number]
    : [-38.6624, 178.0194]; // Gisborne default

  const isLoading = photosQuery.isLoading || videosQuery.isLoading;

  return (
    <div className="pt-6 px-4 md:px-6 lg:px-8 pb-12">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Media Library</h1>
        <p className="text-sm text-muted-foreground">Search all photos and videos by keyword, date, or tag. Items with GPS can be viewed on the map.</p>
      </div>

      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2">
              <Label htmlFor="library-q">Keyword</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="library-q"
                  placeholder="Search captions, notes, addresses, filenames"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                  className="pl-8"
                  data-testid="input-library-search"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="library-from">From</Label>
              <Input id="library-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="input-library-from" />
            </div>
            <div>
              <Label htmlFor="library-to">To</Label>
              <Input id="library-to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="input-library-to" />
            </div>
            <div>
              <Label htmlFor="library-tag">Tag (photo)</Label>
              <Input id="library-tag" placeholder="e.g. safety" value={tag} onChange={(e) => setTag(e.target.value)} data-testid="input-library-tag" />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Show</Label>
              <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as Kind)}>
                <SelectTrigger className="w-36" data-testid="select-library-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Photos + Videos</SelectItem>
                  <SelectItem value="photos">Photos only</SelectItem>
                  <SelectItem value="videos">Videos only</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex border rounded-md overflow-hidden ml-2">
                <Button variant={view === "grid" ? "default" : "ghost"} size="sm" onClick={() => setView("grid")} data-testid="button-library-grid">
                  <Grid3x3 className="h-4 w-4 mr-1" /> Grid
                </Button>
                <Button variant={view === "map" ? "default" : "ghost"} size="sm" onClick={() => setView("map")} data-testid="button-library-map">
                  <MapIcon className="h-4 w-4 mr-1" /> Map
                </Button>
              </div>
            </div>
            <Button onClick={submit} data-testid="button-library-search">Search</Button>
          </div>
        </CardContent>
      </Card>

      <div className="mb-3 text-sm text-muted-foreground">
        {isLoading
          ? "Searching…"
          : `${items.length} result${items.length === 1 ? "" : "s"}${view === "map" ? ` · ${itemsWithGps.length} with GPS` : ""}`}
      </div>

      {view === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {items.map((item) => (
            <a
              key={`${item.kind}-${item.id}`}
              href={item.kind === "video" ? `/watch/${item.id}` : item.url}
              target={item.kind === "video" ? undefined : "_blank"}
              rel="noreferrer"
              className="block"
              data-testid={`library-item-${item.id}`}
            >
              <Card className="overflow-hidden hover:ring-2 hover:ring-primary transition-shadow">
                <div className="aspect-square bg-muted relative">
                  {item.thumbnailUrl || item.kind === "photo" ? (
                    <img
                      src={item.thumbnailUrl || item.url}
                      alt={item.notes || item.title || item.filename || ""}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <VideoIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  <Badge variant="secondary" className="absolute top-1 left-1">
                    {item.kind === "photo" ? <ImageIcon className="h-3 w-3 mr-1" /> : <VideoIcon className="h-3 w-3 mr-1" />}
                    {item.kind}
                  </Badge>
                  {item.gpsLatitude != null && item.gpsLongitude != null && (
                    <Badge variant="secondary" className="absolute top-1 right-1">
                      <MapPin className="h-3 w-3" />
                    </Badge>
                  )}
                </div>
                <CardContent className="p-2">
                  <div className="text-xs font-medium truncate">{item.title || item.notes || item.description || item.filename || "Untitled"}</div>
                  <div className="text-xs text-muted-foreground">{item.capturedAt || item.createdAt ? formatNZTime(new Date(item.capturedAt || item.createdAt!), "datetime") : ""}</div>
                </CardContent>
              </Card>
            </a>
          ))}
          {!isLoading && items.length === 0 && (
            <div className="col-span-full text-center text-sm text-muted-foreground py-12">
              No media found. Try a different keyword or date range.
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <MapContainer center={mapCenter} zoom={itemsWithGps.length > 0 ? 13 : 6} style={{ height: "calc(100vh - 320px)", minHeight: "400px", width: "100%" }} className="rounded-lg">
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {itemsWithGps.map((item) => (
                <Marker
                  key={`${item.kind}-${item.id}`}
                  position={[item.gpsLatitude as number, item.gpsLongitude as number]}
                  icon={item.kind === "photo" ? photoIcon() : videoIcon()}
                >
                  <Popup>
                    <div className="min-w-[200px]">
                      {item.kind === "photo" ? (
                        <img src={item.thumbnailUrl || item.url} alt="" className="w-full h-24 object-cover rounded mb-2" />
                      ) : (
                        <div className="w-full h-24 bg-muted rounded mb-2 flex items-center justify-center">
                          <VideoIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="text-sm font-medium">{item.title || item.notes || item.filename || "Untitled"}</div>
                      {item.gpsAddress && <div className="text-xs text-muted-foreground">{item.gpsAddress}</div>}
                      <div className="text-xs text-muted-foreground">{item.capturedAt || item.createdAt ? formatNZTime(new Date(item.capturedAt || item.createdAt!), "datetime") : ""}</div>
                      <a
                        href={item.kind === "video" ? `/watch/${item.id}` : item.url}
                        target={item.kind === "video" ? undefined : "_blank"}
                        rel="noreferrer"
                        className="text-xs text-primary underline mt-1 inline-block"
                      >
                        Open
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
            {!isLoading && itemsWithGps.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-6">
                No results have GPS coordinates yet. New uploads will start capturing GPS once that's wired in (Phase 2).
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
