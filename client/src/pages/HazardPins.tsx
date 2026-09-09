/**
 * Hazard tree pins — field capture of GPS + risk + photos + work type
 * for a customer site. Dark unless HAZARD_TREE_PINS=true. See HAZARD_TREE_PINS_PLAN.md.
 */
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronsUpDown, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PhotoCaptureModal } from "@/components/PhotoCaptureModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { compressImages } from "@/lib/imageCompression";
import { cn } from "@/lib/utils";
import type { Customer, TreePin } from "@shared/schema";
import type { TreePinRiskRating } from "@shared/treePins";
import { TREE_PIN_MAX_PHOTOS } from "@shared/treePins";

interface ApiList<T> {
  success: boolean;
  data: T[];
}

interface EnabledPayload {
  success: boolean;
  data: {
    enabled: boolean;
    riskRatings: TreePinRiskRating[];
    workTypes: string[];
  };
}

interface PinCreated {
  success: boolean;
  data: TreePin;
}

const RISK_LABELS: Record<TreePinRiskRating, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

async function uploadPinPhotos(pinId: string, files: File[]): Promise<void> {
  const prepared = await compressImages(files);
  const formData = new FormData();
  for (const file of prepared) formData.append("photos", file);
  const res = await fetch(`/api/hazard-pins/${pinId}/photos`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Photo upload failed";
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
}

/**
 * Search-as-you-type customer picker for field use.
 * Reuses GET /api/customers?search= (same as job-card deep search in GlobalJobCard)
 * and the Popover + Command combobox used on job create and SupplierInvoices JobCombobox.
 * Does not dump the full customer list into a Select.
 */
function CustomerCombobox({
  value,
  onChange,
}: {
  value: string;
  onChange: (customerId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [selectedName, setSelectedName] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching, isError } = useQuery<ApiList<Customer>>({
    queryKey: ["/api/customers", "search", debounced],
    queryFn: async () => {
      const r = await fetch(
        `/api/customers?search=${encodeURIComponent(debounced)}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error("Search failed");
      return r.json();
    },
    enabled: open && debounced.length >= 2,
    staleTime: 30_000,
  });

  const hits = debounced.length >= 2 ? (data?.data ?? []).slice(0, 20) : [];
  const label = value && selectedName ? selectedName : "Search for a customer…";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQ("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Customer"
          className="w-full min-h-11 justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-4 w-4 ml-2 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[min(92vw,420px)]"
        align="start"
        onWheel={(e) => e.stopPropagation()}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a customer name…"
            value={q}
            onValueChange={setQ}
          />
          <CommandList>
            {debounced.length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Type at least 2 letters to search
              </div>
            ) : isFetching && hits.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : isError ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Could not search customers
              </div>
            ) : (
              <>
                <CommandEmpty>No customers match.</CommandEmpty>
                <CommandGroup>
                  {hits.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onChange(c.id);
                        setSelectedName(c.name);
                        setOpen(false);
                        setQ("");
                      }}
                      className="py-3"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0",
                          c.id === value ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium truncate">{c.name}</span>
                        {c.address ? (
                          <span className="text-xs text-muted-foreground truncate">
                            {c.address}
                          </span>
                        ) : null}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default function HazardPins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customerId, setCustomerId] = useState("");
  const [riskRating, setRiskRating] = useState<TreePinRiskRating>("medium");
  const [workType, setWorkType] = useState("Remove");
  const [notes, setNotes] = useState("");
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    gpsAccuracy?: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<{ file: File; url: string }[]>([]);
  const [cameraFor, setCameraFor] = useState<"new" | string | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
  const pendingPhotosRef = useRef(pendingPhotos);
  pendingPhotosRef.current = pendingPhotos;

  const { data: enabledResp } = useQuery<EnabledPayload>({
    queryKey: ["/api/hazard-pins/enabled"],
  });
  const enabled = enabledResp?.data?.enabled === true;
  const riskRatings = enabledResp?.data?.riskRatings ?? ["low", "medium", "high", "critical"];
  const workTypes = enabledResp?.data?.workTypes ?? [];

  const { data: pinsResp, isFetching: pinsLoading, isError: pinsError } = useQuery<ApiList<TreePin>>({
    queryKey: ["/api/customers", customerId, "tree-pins"],
    enabled: enabled && !!customerId,
  });
  const pins = pinsResp?.data ?? [];

  useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const clearPendingPhotos = () => {
    setPendingPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
  };

  const createPin = useMutation({
    mutationFn: async () => {
      if (!coords) throw new Error("Location is required");
      const res = await apiRequest("POST", `/api/customers/${customerId}/tree-pins`, {
        latitude: coords.latitude,
        longitude: coords.longitude,
        gpsAccuracy: coords.gpsAccuracy,
        riskRating,
        recommendedWorkType: workType,
        notes: notes.trim() || undefined,
      });
      const created = (await res.json()) as PinCreated;
      let photoError: string | undefined;
      if (pendingPhotos.length > 0) {
        try {
          await uploadPinPhotos(created.data.id, pendingPhotos.map((p) => p.file));
        } catch (err) {
          photoError = err instanceof Error ? err.message : "Photo upload failed";
        }
      }
      return { created, photoError };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "tree-pins"] });
      setNotes("");
      setCoords(null);
      clearPendingPhotos();
      if (result.photoError) {
        toast({
          variant: "destructive",
          title: "Pin saved, photos failed",
          description: result.photoError,
        });
      }
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Could not save pin", description: err.message });
    },
  });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      toast({
        variant: "destructive",
        title: "Location not available",
        description: "This device does not support GPS.",
      });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gpsAccuracy: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        toast({
          variant: "destructive",
          title: "Could not read GPS",
          description: err.message || "Try again in the open, away from buildings.",
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };

  const handlePendingPhotos = (files: File[]) => {
    const room = TREE_PIN_MAX_PHOTOS - pendingPhotos.length;
    const toAdd = files.slice(0, Math.max(0, room));
    if (toAdd.length < files.length) {
      toast({
        variant: "destructive",
        title: "Photo limit",
        description: `A pin can hold at most ${TREE_PIN_MAX_PHOTOS} photos.`,
      });
    }
    setPendingPhotos((prev) => [
      ...prev,
      ...toAdd.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  };

  const removePendingPhoto = (index: number) => {
    setPendingPhotos((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      return next;
    });
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hazard trees</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a GPS pin at a tree, take photos, then take it through quote and job.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Work in progress</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            Pins belong to the customer/site (e.g. a golf course) so they stay findable
            after the job is done. They are not the job-card site map markers.
          </p>
          {!enabled && (
            <p>
              Capture is off. Set the server env <code className="text-foreground">HAZARD_TREE_PINS=true</code>{" "}
              on a non-production instance to try dropping a pin. Do not enable on production
              until quoting is ready.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerCombobox value={customerId} onChange={setCustomerId} />
        </CardContent>
      </Card>

      {enabled && customerId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Drop pin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <Button type="button" variant="outline" onClick={useMyLocation} disabled={locating}>
                {locating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4 mr-2" />
                )}
                Use my location
              </Button>
              {coords && (
                <p className="text-sm text-muted-foreground">
                  {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  {coords.gpsAccuracy != null && ` (±${Math.round(coords.gpsAccuracy)} m)`}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-2 block">Risk rating</Label>
              <div className="flex flex-wrap gap-2">
                {riskRatings.map((rating) => (
                  <Button
                    key={rating}
                    type="button"
                    size="sm"
                    variant={riskRating === rating ? "default" : "outline"}
                    onClick={() => setRiskRating(rating)}
                  >
                    {RISK_LABELS[rating]}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Photos</Label>
              {pendingPhotos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {pendingPhotos.map((photo, index) => (
                    <div key={photo.url} className="relative h-20 w-20 rounded-md overflow-hidden border border-border">
                      <img
                        src={photo.url}
                        alt={`Pending photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-0.5 right-0.5 h-6 w-6"
                        onClick={() => removePendingPhoto(index)}
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setCameraFor("new")}
                disabled={pendingPhotos.length >= TREE_PIN_MAX_PHOTOS}
              >
                <Camera className="h-4 w-4 mr-2" />
                Add photos
              </Button>
            </div>

            <div>
              <Label htmlFor="work-type" className="mb-2 block">Recommended work</Label>
              <Select value={workType} onValueChange={setWorkType}>
                <SelectTrigger id="work-type" aria-label="Recommended work">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pin-notes" className="mb-2 block">Notes (optional)</Label>
              <Textarea
                id="pin-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Access, species, anything the crew will need"
                rows={3}
              />
            </div>

            <Button
              type="button"
              disabled={!coords || createPin.isPending}
              onClick={() => createPin.mutate()}
            >
              {createPin.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save pin
            </Button>
          </CardContent>
        </Card>
      )}

      {customerId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pins on this customer</CardTitle>
          </CardHeader>
          <CardContent>
            {!enabled && (
              <p className="text-sm text-muted-foreground">List is hidden while the feature flag is off.</p>
            )}
            {enabled && pinsError && (
              <p className="text-sm text-muted-foreground">
                Could not load pins. If this is a fresh environment, the tables may not exist yet.
              </p>
            )}
            {enabled && !pinsLoading && pins.length === 0 && (
              <p className="text-sm text-muted-foreground">No pins on this site yet.</p>
            )}
            {enabled && pins.length > 0 && (
              <ul className="space-y-2">
                {pins.map((pin) => {
                  const photos = pin.photoUrls ?? [];
                  return (
                    <li
                      key={pin.id}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="font-medium">{pin.recommendedWorkType}</span>
                        <Badge variant="secondary">{pin.riskRating}</Badge>
                        <Badge variant="outline">{pin.status}</Badge>
                        <span className="text-muted-foreground">
                          {Number(pin.latitude).toFixed(5)}, {Number(pin.longitude).toFixed(5)}
                        </span>
                      </div>
                      {photos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {photos.map((url, i) => (
                            <button
                              key={`${url}-${i}`}
                              type="button"
                              className="h-16 w-16 overflow-hidden rounded-md border border-border"
                              onClick={() => setLightbox({ src: url, alt: `Pin photo ${i + 1}` })}
                              aria-label={`View photo ${i + 1}`}
                            >
                              <img src={url} alt="" className="h-full w-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                      <div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setCameraFor(pin.id)}
                          disabled={photos.length >= TREE_PIN_MAX_PHOTOS}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Add photos
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      <PhotoCaptureModal
        isOpen={cameraFor !== null}
        onClose={() => setCameraFor(null)}
        acceptImagesOnly
        onPendingPhotos={cameraFor === "new" ? handlePendingPhotos : undefined}
        uploadUrl={
          cameraFor && cameraFor !== "new" ? `/api/hazard-pins/${cameraFor}/photos` : undefined
        }
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "tree-pins"] });
        }}
      />

      <Dialog open={lightbox !== null} onOpenChange={(open) => { if (!open) setLightbox(null); }}>
        <DialogContent className="max-w-lg p-2">
          <DialogTitle className="sr-only">{lightbox?.alt ?? "Pin photo"}</DialogTitle>
          {lightbox && (
            <img
              src={lightbox.src}
              alt={lightbox.alt}
              className="w-full h-auto rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
