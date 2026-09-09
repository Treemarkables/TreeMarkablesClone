/**
 * Hazard tree pins — P0 spike page.
 * Hidden WIP route (no sidebar). Field capture of GPS + risk + work type
 * for a customer site. Dark unless HAZARD_TREE_PINS=true. See HAZARD_TREE_PINS_PLAN.md.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Loader2 } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Customer, TreePin } from "@shared/schema";
import type { TreePinRiskRating } from "@shared/treePins";

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

  const { data: enabledResp } = useQuery<EnabledPayload>({
    queryKey: ["/api/hazard-pins/enabled"],
  });
  const enabled = enabledResp?.data?.enabled === true;
  const riskRatings = enabledResp?.data?.riskRatings ?? ["low", "medium", "high", "critical"];
  const workTypes = enabledResp?.data?.workTypes ?? [];

  const { data: customersResp } = useQuery<ApiList<Customer>>({
    queryKey: ["/api/customers"],
  });
  const customers = customersResp?.data ?? [];

  const { data: pinsResp, isFetching: pinsLoading, isError: pinsError } = useQuery<ApiList<TreePin>>({
    queryKey: ["/api/customers", customerId, "tree-pins"],
    enabled: enabled && !!customerId,
  });
  const pins = pinsResp?.data ?? [];

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
      return (await res.json()) as PinCreated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "tree-pins"] });
      setNotes("");
      setCoords(null);
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

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hazard trees</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Drop a GPS pin at a tree, then take it through quote and job. This page is a
          spike — not in the sidebar yet.
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
              until field photos and quoting are ready.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger aria-label="Customer">
              <SelectValue placeholder="Select a customer" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                {pins.map((pin) => (
                  <li
                    key={pin.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3 text-sm"
                  >
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium">{pin.recommendedWorkType}</span>
                    <Badge variant="secondary">{pin.riskRating}</Badge>
                    <Badge variant="outline">{pin.status}</Badge>
                    <span className="text-muted-foreground">
                      {Number(pin.latitude).toFixed(5)}, {Number(pin.longitude).toFixed(5)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
