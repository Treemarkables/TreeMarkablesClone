/**
 * Shared hazard-tree drop-pin form + pin list.
 * Used by /hazard-pins and the job-card Hazard trees section.
 * Same APIs: POST /api/customers/:id/tree-pins + POST /api/hazard-pins/:id/photos.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { PhotoCaptureModal } from "@/components/PhotoCaptureModal";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { compressImages } from "@/lib/imageCompression";
import type { TreePin } from "@shared/schema";
import type { TreePinRiskRating } from "@shared/treePins";
import { TREE_PIN_MAX_PHOTOS } from "@shared/treePins";

interface ApiList<T> {
  success: boolean;
  data: T[];
}

interface PinCreated {
  success: boolean;
  data: TreePin;
}

export const RISK_LABELS: Record<TreePinRiskRating, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export async function uploadPinPhotos(pinId: string, files: File[]): Promise<void> {
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

function SectionChrome({
  variant,
  title,
  children,
}: {
  variant: "cards" | "plain";
  title: string;
  children: ReactNode;
}) {
  if (variant === "cards") {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <div className="text-[13px] font-semibold text-foreground">{title}</div>
      {children}
    </div>
  );
}

export function HazardPinCapture({
  customerId,
  jobId,
  enabled,
  riskRatings,
  workTypes,
  variant = "plain",
}: {
  customerId: string;
  /** When set, new pins are linked to this job via tree_pin_work_links. */
  jobId?: string;
  enabled: boolean;
  riskRatings: TreePinRiskRating[];
  workTypes: string[];
  variant?: "cards" | "plain";
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  const { data: pinsResp, isFetching: pinsLoading, isError: pinsError } = useQuery<ApiList<TreePin>>({
    queryKey: ["/api/customers", customerId, "tree-pins"],
    enabled: enabled && !!customerId,
  });
  const pins = pinsResp?.data ?? [];

  const { data: jobPinsResp } = useQuery<ApiList<TreePin>>({
    queryKey: ["/api/jobs", jobId, "tree-pins"],
    enabled: enabled && !!jobId,
  });
  const jobLinkedIds = new Set((jobPinsResp?.data ?? []).map((p) => p.id));

  useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const invalidatePins = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "tree-pins"] });
    if (jobId) {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "tree-pins"] });
    }
  };

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
        ...(jobId ? { jobId } : {}),
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
      invalidatePins();
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

  const linkPin = useMutation({
    mutationFn: async (pinId: string) => {
      if (!jobId) throw new Error("No job to link");
      await apiRequest("POST", `/api/jobs/${jobId}/tree-pins/${pinId}/link`);
    },
    onSuccess: () => {
      invalidatePins();
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Could not link pin", description: err.message });
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

  const dropForm = (
    <div className="space-y-4" data-testid="hazard-pin-drop-form">
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
        <Label htmlFor={`work-type-${customerId}`} className="mb-2 block">Recommended work</Label>
        <Select value={workType} onValueChange={setWorkType}>
          <SelectTrigger id={`work-type-${customerId}`} aria-label="Recommended work">
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
        <Label htmlFor={`pin-notes-${customerId}`} className="mb-2 block">Notes (optional)</Label>
        <Textarea
          id={`pin-notes-${customerId}`}
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
        data-testid="button-save-hazard-pin"
      >
        {createPin.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        Save pin
      </Button>
    </div>
  );

  const pinList = (
    <div data-testid="hazard-pin-list">
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
            const onThisJob = jobId ? jobLinkedIds.has(pin.id) : false;
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
                  {onThisJob && <Badge variant="default">On this job</Badge>}
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
                <div className="flex flex-wrap gap-2">
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
                  {jobId && !onThisJob && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => linkPin.mutate(pin.id)}
                      disabled={linkPin.isPending}
                    >
                      Add to this job
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {enabled && (
        <SectionChrome variant={variant} title="Drop pin">
          {dropForm}
        </SectionChrome>
      )}

      <SectionChrome variant={variant} title="Pins on this customer">
        {pinList}
      </SectionChrome>

      <PhotoCaptureModal
        isOpen={cameraFor !== null}
        onClose={() => setCameraFor(null)}
        acceptImagesOnly
        onPendingPhotos={cameraFor === "new" ? handlePendingPhotos : undefined}
        uploadUrl={
          cameraFor && cameraFor !== "new" ? `/api/hazard-pins/${cameraFor}/photos` : undefined
        }
        onUploaded={() => {
          invalidatePins();
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
