import { useEffect, useState, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ImageOverlay,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  MapPin,
  Plus,
  Trash2,
  Save,
  X,
  TreePine,
  Loader2,
  Upload,
  Image as ImageIcon,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TreeMarker {
  id: string;
  jobId: string;
  latitude: string;
  longitude: string;
  label: string | null;
  notes: string | null;
  markerType: string;
  color: string;
  // 'map' = geographic coords; 'image' = normalized 0..1 coords on the job's
  // uploaded site photo (lat = y from top, lng = x from left).
  surface?: string;
}

// Fixed CRS.Simple height for the uploaded photo; width scales by aspect.
const IMG_PLANE_H = 1000;

interface JobSiteMapProps {
  jobId: string;
  address?: string;
  defaultCenter?: [number, number];
  className?: string;
}

// TODO: source these labels from the trade-preset vocabulary (server/trades/) so
// non-tree trades get fitting marker types.
const MARKER_TYPES = [
  { value: "tree", label: "Tree", color: "#22c55e" },
  { value: "stump", label: "Stump", color: "#854d0e" },
  { value: "hazard", label: "Hazard", color: "#ef4444" },
  { value: "access", label: "Access Point", color: "#3b82f6" },
  { value: "parking", label: "Parking", color: "#8b5cf6" },
];

function createTreeIcon(color: string = "#22c55e"): L.DivIcon {
  return L.divIcon({
    className: "custom-tree-marker",
    html: `<div style="
      background-color: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M12 2L7 10h10L12 2z"/>
        <path d="M12 8L5 18h14L12 8z"/>
        <rect x="10" y="18" width="4" height="4"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function MapClickHandler({
  onMapClick,
  isAddingMarker,
}: {
  onMapClick: (lat: number, lng: number) => void;
  isAddingMarker: boolean;
}) {
  useMapEvents({
    click: (e) => {
      if (isAddingMarker) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function GeocodedCenter({
  address,
  onResult,
}: {
  address: string;
  onResult?: (found: boolean) => void;
}) {
  const map = useMap();
  const [geocoded, setGeocoded] = useState(false);

  useEffect(() => {
    if (!address || geocoded) return;

    const geocodeAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ", New Zealand")}`,
        );
        const data = await response.json();
        if (data && data.length > 0) {
          const { lat, lon, boundingbox } = data[0];
          // For house addresses Nominatim usually matches the building itself
          // and its boundingbox is the parcel/footprint — fit to that so the
          // view frames just the property. maxZoom clamps tiny footprints.
          if (Array.isArray(boundingbox) && boundingbox.length === 4) {
            const [south, north, west, east] = boundingbox.map(Number);
            map.fitBounds(
              [
                [south, west],
                [north, east],
              ],
              { padding: [40, 40], maxZoom: 19 },
            );
          } else {
            map.setView([parseFloat(lat), parseFloat(lon)], 18);
          }
          setGeocoded(true);
          onResult?.(true);
        } else {
          onResult?.(false);
        }
      } catch (error) {
        console.error("Geocoding failed:", error);
        onResult?.(false);
      }
    };

    geocodeAddress();
  }, [address, map, geocoded]);

  return null;
}

function FitImageBounds({ bounds }: { bounds: L.LatLngBoundsExpression }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds);
  }, [map, bounds]);
  return null;
}

export function JobSiteMap({
  jobId,
  address,
  defaultCenter,
  className,
}: JobSiteMapProps) {
  const { toast } = useToast();
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [manualView, setManualView] = useState<"satellite" | "photo" | null>(null);
  const [imgAspect, setImgAspect] = useState<number | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const { data: siteImageUrl } = useQuery<string | null>({
    queryKey: ["/api/jobs", jobId, "site-map-image"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/site-map-image`, {
        credentials: "include",
      });
      const data = await res.json();
      return data.success ? data.data.imageUrl : null;
    },
  });

  // Photo view is the default whenever a site photo exists (council jobs:
  // the card address is the billing address, so the satellite view is moot).
  const view: "satellite" | "photo" =
    manualView ?? (siteImageUrl ? "photo" : "satellite");

  // Natural aspect ratio of the uploaded photo → CRS.Simple plane size.
  useEffect(() => {
    setImgAspect(null);
    if (!siteImageUrl) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setImgAspect(img.naturalWidth / img.naturalHeight);
      }
    };
    img.src = siteImageUrl;
  }, [siteImageUrl]);

  const imgPlaneW = imgAspect ? IMG_PLANE_H * imgAspect : IMG_PLANE_H;
  const imgBounds: L.LatLngBoundsExpression = [
    [0, 0],
    [IMG_PLANE_H, imgPlaneW],
  ];

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await fetch(`/api/jobs/${jobId}/site-map-image`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        // Surface the server's reason — a bare "failed" hides whether it was
        // auth, size, storage, or the DB, which made prod failures undiagnosable.
        const detail = await res
          .json()
          .then((d) => d?.message)
          .catch(() => null);
        throw new Error(detail || `Upload failed (${res.status})`);
      }
      await queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "site-map-image"],
      });
      setManualView("photo");
    } catch (err) {
      toast({
        title: "Upload Error",
        description:
          err instanceof Error && err.message
            ? err.message
            : "Failed to upload the site photo",
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };
  const [editingMarker, setEditingMarker] = useState<TreeMarker | null>(null);
  const [newMarkerPosition, setNewMarkerPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [markerForm, setMarkerForm] = useState({
    label: "",
    notes: "",
    markerType: "tree",
    color: "#22c55e",
  });

  const center = defaultCenter || [-38.6624, 178.0194];

  const { data: markers = [], isLoading } = useQuery<TreeMarker[]>({
    queryKey: ["/api/jobs", jobId, "tree-markers"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/tree-markers`);
      const data = await res.json();
      return data.success ? data.data : [];
    },
  });

  // Each view only shows its own markers — photo markers carry normalized
  // coords that would be nonsense latitudes on the satellite map.
  const visibleMarkers = markers.filter((m) =>
    view === "photo" ? m.surface === "image" : m.surface !== "image",
  );

  // Photo-view positions: stored normalized (y from top, x from left) →
  // CRS.Simple plane (lat grows upward).
  const markerPlanePosition = (m: TreeMarker): [number, number] =>
    view === "photo"
      ? [
          (1 - parseFloat(m.latitude)) * IMG_PLANE_H,
          parseFloat(m.longitude) * imgPlaneW,
        ]
      : [parseFloat(m.latitude), parseFloat(m.longitude)];

  const createMarkerMutation = useMutation({
    mutationFn: async (marker: {
      latitude: number;
      longitude: number;
      label: string;
      notes: string;
      markerType: string;
      color: string;
      surface: string;
    }) => {
      return apiRequest("POST", `/api/jobs/${jobId}/tree-markers`, marker);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "tree-markers"],
      });
      setNewMarkerPosition(null);
      setMarkerForm({
        label: "",
        notes: "",
        markerType: "tree",
        color: "#22c55e",
      });
      setIsAddingMarker(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add marker",
        variant: "destructive",
      });
    },
  });

  const updateMarkerMutation = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: {
      id: string;
      label?: string;
      notes?: string;
      markerType?: string;
      color?: string;
    }) => {
      return apiRequest("PATCH", `/api/tree-markers/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "tree-markers"],
      });
      setEditingMarker(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update marker",
        variant: "destructive",
      });
    },
  });

  const deleteMarkerMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/tree-markers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/jobs", jobId, "tree-markers"],
      });
      setEditingMarker(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete marker",
        variant: "destructive",
      });
    },
  });

  const handleMapClick = (lat: number, lng: number) => {
    setNewMarkerPosition({ lat, lng });
  };

  const handleSaveNewMarker = () => {
    if (!newMarkerPosition) return;
    // Photo view: convert the CRS.Simple click into normalized image coords.
    const latitude =
      view === "photo"
        ? 1 - newMarkerPosition.lat / IMG_PLANE_H
        : newMarkerPosition.lat;
    const longitude =
      view === "photo"
        ? newMarkerPosition.lng / imgPlaneW
        : newMarkerPosition.lng;
    createMarkerMutation.mutate({
      latitude,
      longitude,
      label: markerForm.label,
      notes: markerForm.notes,
      markerType: markerForm.markerType,
      color: markerForm.color,
      surface: view === "photo" ? "image" : "map",
    });
  };

  const handleUpdateMarker = () => {
    if (!editingMarker) return;
    updateMarkerMutation.mutate({
      id: editingMarker.id,
      label: markerForm.label,
      notes: markerForm.notes,
      markerType: markerForm.markerType,
      color: markerForm.color,
    });
  };

  const openEditDialog = (marker: TreeMarker) => {
    setEditingMarker(marker);
    setMarkerForm({
      label: marker.label || "",
      notes: marker.notes || "",
      markerType: marker.markerType || "tree",
      color: marker.color || "#22c55e",
    });
  };

  const handleMarkerTypeChange = (value: string) => {
    const type = MARKER_TYPES.find((t) => t.value === value);
    setMarkerForm({
      ...markerForm,
      markerType: value,
      color: type?.color || "#22c55e",
    });
  };

  if (isLoading) {
    return (
      <div
        className={`flex items-center justify-center h-64 bg-muted rounded-lg ${className}`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const markerPins = (
    <>
      {visibleMarkers.map((marker) => (
        <Marker
          key={marker.id}
          position={markerPlanePosition(marker)}
          icon={createTreeIcon(marker.color)}
          eventHandlers={{
            click: () => openEditDialog(marker),
          }}
        >
          <Popup>
            <div className="min-w-[150px]">
              <p className="font-medium">{marker.label || "Unmarked tree"}</p>
              {marker.notes && (
                <p className="text-sm text-gray-600 mt-1">{marker.notes}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="mt-2 w-full"
                onClick={() => openEditDialog(marker)}
              >
                Edit
              </Button>
            </div>
          </Popup>
        </Marker>
      ))}

      {newMarkerPosition && (
        <Marker
          position={[newMarkerPosition.lat, newMarkerPosition.lng]}
          icon={createTreeIcon(markerForm.color)}
        />
      )}
    </>
  );

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-center gap-1 mb-2">
        {siteImageUrl && (
          <>
            <Button
              size="sm"
              variant={view === "photo" ? "secondary" : "ghost"}
              onClick={() => {
                setManualView("photo");
                setIsAddingMarker(false);
                setNewMarkerPosition(null);
              }}
              className="text-xs"
            >
              <ImageIcon className="h-3 w-3 mr-1" />
              Site Photo
            </Button>
            <Button
              size="sm"
              variant={view === "satellite" ? "secondary" : "ghost"}
              onClick={() => {
                setManualView("satellite");
                setIsAddingMarker(false);
                setNewMarkerPosition(null);
              }}
              className="text-xs"
            >
              <Globe className="h-3 w-3 mr-1" />
              Satellite
            </Button>
          </>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoUpload}
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => photoInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="text-xs text-muted-foreground ml-auto"
          title="For sites the job address doesn't cover (e.g. council jobs) — mark trees on your own aerial or plan photo"
        >
          {uploadingPhoto ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          {siteImageUrl ? "Replace Photo" : "Upload Site Photo"}
        </Button>
      </div>

      <div className="relative">
        <div className="absolute top-2 right-2 z-[1000] flex gap-2">
          {/* Floats over photo/satellite imagery, so it needs a solid fill —
              the theme's outline variant is transparent and primary is near
              black, both of which vanish against dark trees. */}
          <Button
            size="sm"
            variant={isAddingMarker ? "destructive" : "outline"}
            onClick={() => {
              setIsAddingMarker(!isAddingMarker);
              setNewMarkerPosition(null);
            }}
            className={
              isAddingMarker
                ? "shadow-lg"
                : "shadow-lg bg-white text-gray-900 border-gray-300"
            }
          >
            {isAddingMarker ? (
              <>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add Marker
              </>
            )}
          </Button>
        </div>

        {isAddingMarker && (
          <div className="absolute top-2 left-2 z-[1000] bg-white/95 border border-gray-200 px-3 py-2 rounded-lg shadow-lg text-sm text-gray-900">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              <span>Click on the {view === "photo" ? "photo" : "map"} to place a marker</span>
            </div>
          </div>
        )}

        {view === "photo" ? (
          !imgAspect ? (
            <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <MapContainer
              key={`photo-${siteImageUrl}`}
              crs={L.CRS.Simple}
              center={[IMG_PLANE_H / 2, imgPlaneW / 2]}
              zoom={0}
              minZoom={-2}
              maxZoom={4}
              style={{ height: "400px", width: "100%" }}
              className="rounded-lg z-0 bg-muted"
            >
              <FitImageBounds bounds={imgBounds} />
              <ImageOverlay url={siteImageUrl!} bounds={imgBounds} />
              <MapClickHandler
                onMapClick={handleMapClick}
                isAddingMarker={isAddingMarker}
              />
              {markerPins}
            </MapContainer>
          )
        ) : (
          <MapContainer
            key="satellite"
            center={center}
            zoom={18}
            style={{ height: "400px", width: "100%" }}
            className="rounded-lg z-0"
          >
            {/* Esri serves genuine native imagery to z20+ across NZ (LINZ-sourced;
                verified z21 over Gisborne). Native to 20, z21 upscales so thin
                rural coverage degrades to soft imagery instead of blank tiles. */}
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={20}
              maxZoom={21}
            />
            {address && (
              <GeocodedCenter
                address={address}
                onResult={(found) => setGeocodeFailed(!found)}
              />
            )}
            <MapClickHandler
              onMapClick={handleMapClick}
              isAddingMarker={isAddingMarker}
            />
            {markerPins}
          </MapContainer>
        )}
      </div>

      {view === "satellite" && geocodeFailed && (
        <p className="mt-1 text-xs text-muted-foreground">
          Address not found on map — pan/zoom to the property manually.
        </p>
      )}

      {visibleMarkers.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {visibleMarkers.map((marker) => (
            <div
              key={marker.id}
              className="flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs cursor-pointer hover:bg-accent"
              onClick={() => openEditDialog(marker)}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: marker.color }}
              />
              <span>{marker.label || "Unmarked"}</span>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!newMarkerPosition}
        onOpenChange={() => setNewMarkerPosition(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-green-600" />
              Add Tree Marker
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Type</Label>
              <Select
                value={markerForm.markerType}
                onValueChange={handleMarkerTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input
                placeholder="e.g., Large oak - remove"
                value={markerForm.label}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, label: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                placeholder="Additional notes..."
                value={markerForm.notes}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setNewMarkerPosition(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewMarker}
              disabled={createMarkerMutation.isPending}
            >
              {createMarkerMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save Marker
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingMarker}
        onOpenChange={() => setEditingMarker(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TreePine className="h-5 w-5 text-green-600" />
              Edit Marker
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Type</Label>
              <Select
                value={markerForm.markerType}
                onValueChange={handleMarkerTypeChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MARKER_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: type.color }}
                        />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Label</Label>
              <Input
                placeholder="e.g., Large oak - remove"
                value={markerForm.label}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, label: e.target.value })
                }
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                placeholder="Additional notes..."
                value={markerForm.notes}
                onChange={(e) =>
                  setMarkerForm({ ...markerForm, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter className="flex justify-between">
            <Button
              variant="destructive"
              onClick={() =>
                editingMarker && deleteMarkerMutation.mutate(editingMarker.id)
              }
              disabled={deleteMarkerMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingMarker(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleUpdateMarker}
                disabled={updateMarkerMutation.isPending}
              >
                {updateMarkerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
