/**
 * Hazard tree pins — field capture of GPS + risk + photos + work type
 * for a customer site. Dark unless HAZARD_TREE_PINS=true. See HAZARD_TREE_PINS_PLAN.md.
 */
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { HazardPinCapture } from "@/components/HazardPinCapture";
import { cn } from "@/lib/utils";
import type { Customer } from "@shared/schema";
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
  const [customerId, setCustomerId] = useState("");

  const { data: enabledResp } = useQuery<EnabledPayload>({
    queryKey: ["/api/hazard-pins/enabled"],
  });
  const enabled = enabledResp?.data?.enabled === true;
  const riskRatings = enabledResp?.data?.riskRatings ?? ["low", "medium", "high", "critical"];
  const workTypes = enabledResp?.data?.workTypes ?? [];

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

      {customerId && (
        <HazardPinCapture
          customerId={customerId}
          enabled={enabled}
          riskRatings={riskRatings}
          workTypes={workTypes}
          variant="cards"
        />
      )}
    </div>
  );
}
