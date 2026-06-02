import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  ArrowLeft,
  TrendingUp,
  Percent,
  FileText,
  Banknote,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function SettingsPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [metricsStartDate, setMetricsStartDate] = useState<Date | undefined>(
    undefined,
  );
  const [defaultGrossMarginPct, setDefaultGrossMarginPct] =
    useState<string>("");
  const [invoicePaymentDays, setInvoicePaymentDays] = useState<string>("7");
  const [dailyRevenueTarget, setDailyRevenueTarget] = useState<string>("3500");
  const [defaultDepositType, setDefaultDepositType] = useState<"none" | "percent" | "fixed">("none");
  const [defaultDepositValue, setDefaultDepositValue] = useState<string>("");

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/business-settings"],
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings?.data?.metricsStartDate) {
      setMetricsStartDate(new Date(settings.data.metricsStartDate));
    }
    const pct = parseFloat(settings?.data?.defaultGrossMarginPct || "0") || 0;
    setDefaultGrossMarginPct(pct > 0 ? String(pct) : "");
    const days = settings?.data?.invoicePaymentDays ?? 7;
    setInvoicePaymentDays(String(days));
    const target = parseFloat(settings?.data?.dailyRevenueTarget || "3500") || 3500;
    setDailyRevenueTarget(String(target));
    const depType = settings?.data?.defaultDepositType;
    if (depType === "percent" || depType === "fixed" || depType === "none") {
      setDefaultDepositType(depType);
    }
    const depValue = parseFloat(settings?.data?.defaultDepositValue || "0") || 0;
    setDefaultDepositValue(depValue > 0 ? String(depValue) : "");
  }, [settings]);

  // Mutation to update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", "/api/business-settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/analytics/lead-source"],
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const marginValue = parseFloat(defaultGrossMarginPct) || 0;
    const daysValue = parseInt(invoicePaymentDays, 10);
    const targetValue = parseFloat(dailyRevenueTarget) || 3500;
    const depositValueNum = parseFloat(defaultDepositValue) || 0;
    updateSettingsMutation.mutate({
      metricsStartDate: metricsStartDate
        ? metricsStartDate.toISOString()
        : null,
      defaultGrossMarginPct:
        marginValue >= 0 && marginValue <= 100 ? marginValue : 0,
      invoicePaymentDays:
        !isNaN(daysValue) && daysValue >= 1 && daysValue <= 365 ? daysValue : 7,
      dailyRevenueTarget: targetValue > 0 ? targetValue : 3500,
      defaultDepositType,
      defaultDepositValue:
        defaultDepositType === "none" || depositValueNum < 0 ? 0 : depositValueNum,
    });
  };

  const handleClearDate = () => {
    setMetricsStartDate(undefined);
  };

  const handleSetToday = () => {
    setMetricsStartDate(new Date());
  };

  const marginNum = parseFloat(defaultGrossMarginPct) || 0;
  const marginValid = marginNum >= 0 && marginNum <= 100;

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
          data-testid="button-back-to-settings"
        >
          <Link href="/settings" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      {/* Main content */}
      <div className="max-w-2xl space-y-6">
        <div>
          <h1
            className="text-3xl font-bold text-gray-900"
            data-testid="text-page-title"
          >
            Preferences
          </h1>
          <p className="text-gray-600 mt-2">
            Configure your business preferences and data tracking settings
          </p>
        </div>

        {/* Metrics Tracking Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Metrics Tracking
            </CardTitle>
            <CardDescription>
              Control which jobs are included in your business analytics and
              reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label
                htmlFor="metrics-start-date"
                className="text-base font-medium"
              >
                Metrics Start Date
              </Label>
              <p className="text-sm text-muted-foreground">
                Only jobs created on or after this date will be included in
                analytics, revenue reports, and performance metrics. Leave blank
                to include all jobs.
              </p>

              <div className="flex items-center gap-3 mt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="metrics-start-date"
                      variant="outline"
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !metricsStartDate && "text-muted-foreground",
                      )}
                      data-testid="button-select-metrics-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {metricsStartDate ? (
                        format(metricsStartDate, "PPP")
                      ) : (
                        <span>Select a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={metricsStartDate}
                      onSelect={setMetricsStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {metricsStartDate && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearDate}
                    data-testid="button-clear-metrics-date"
                  >
                    Clear
                  </Button>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSetToday}
                  data-testid="button-set-today"
                >
                  Set to Today
                </Button>
              </div>
            </div>

            {metricsStartDate && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Jobs created before{" "}
                  <strong>{format(metricsStartDate, "MMMM d, yyyy")}</strong>{" "}
                  will be excluded from all analytics and reports. This helps
                  ensure your metrics only reflect actual business operations,
                  not imported historical data.
                </p>
              </div>
            )}

            {/* Invoice Payment Terms */}
            <div className="space-y-2 pt-2 border-t">
              <Label
                htmlFor="invoice-payment-days"
                className="text-base font-medium flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Invoice Payment Terms
              </Label>
              <p className="text-sm text-muted-foreground">
                Number of days from invoice issue date until payment is due.
                This applies to all new invoices generated from job cards.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="relative w-40">
                  <Input
                    id="invoice-payment-days"
                    type="number"
                    min="1"
                    max="365"
                    step="1"
                    value={invoicePaymentDays}
                    onChange={(e) => setInvoicePaymentDays(e.target.value)}
                    placeholder="7"
                    data-testid="input-invoice-payment-days"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    days
                  </span>
                </div>
                {parseInt(invoicePaymentDays, 10) > 0 && !isNaN(parseInt(invoicePaymentDays, 10)) && (
                  <p className="text-sm text-muted-foreground">
                    Due {parseInt(invoicePaymentDays, 10) === 1 ? "1 day" : `${parseInt(invoicePaymentDays, 10)} days`} after issue
                  </p>
                )}
              </div>
            </div>

            {/* Default Gross Margin */}
            <div className="space-y-2 pt-2 border-t">
              <Label
                htmlFor="default-gross-margin"
                className="text-base font-medium flex items-center gap-2"
              >
                <Percent className="w-4 h-4" />
                Default Gross Margin
              </Label>
              <p className="text-sm text-muted-foreground">
                Used as a fallback gross margin in the Lead Source analytics
                when a job has no individual cost data entered. Set to your
                typical gross margin (e.g. 40 for 40%). Leave at 0 to show "—"
                for jobs without cost data.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="relative w-40">
                  <Input
                    id="default-gross-margin"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={defaultGrossMarginPct}
                    onChange={(e) => setDefaultGrossMarginPct(e.target.value)}
                    placeholder="0"
                    className={cn(
                      !marginValid &&
                        defaultGrossMarginPct !== "" &&
                        "border-destructive",
                    )}
                    data-testid="input-default-gross-margin"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    %
                  </span>
                </div>
                {!marginValid && defaultGrossMarginPct !== "" && (
                  <p className="text-sm text-destructive">
                    Enter a value between 0 and 100
                  </p>
                )}
              </div>
              {marginNum > 0 && marginValid && (
                <p className="text-sm text-muted-foreground mt-1">
                  Jobs without specific cost data will show approximately{" "}
                  <strong>{marginNum}%</strong> gross margin in analytics.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="daily-revenue-target"
                className="text-base font-medium flex items-center gap-2"
              >
                Daily Revenue Target (NZD)
              </Label>
              <p className="text-sm text-muted-foreground">
                Used by AI Smart Dispatch and the Dispatch Board revenue progress bar. Set to your typical daily revenue goal.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="daily-revenue-target"
                    type="number"
                    min="0"
                    step="100"
                    value={dailyRevenueTarget}
                    onChange={(e) => setDailyRevenueTarget(e.target.value)}
                    placeholder="3500"
                    className="pl-7"
                    data-testid="input-daily-revenue-target"
                  />
                </div>
                <span className="text-sm text-muted-foreground">NZD per day</span>
              </div>
            </div>

            {/* Default Deposit on Proposal Acceptance */}
            <div className="space-y-2 pt-2 border-t">
              <Label
                htmlFor="default-deposit-type"
                className="text-base font-medium flex items-center gap-2"
              >
                <Banknote className="w-4 h-4" />
                Default Deposit on Proposal Acceptance
              </Label>
              <p className="text-sm text-muted-foreground">
                Pre-fills the deposit setting on every new proposal. When set,
                customers must complete a Stripe Checkout payment before their
                acceptance is finalized and a work order is created. You can
                still override per proposal in the proposal builder.
              </p>
              <div className="flex items-center gap-3 mt-3">
                <Select
                  value={defaultDepositType}
                  onValueChange={(v) => setDefaultDepositType(v as "none" | "percent" | "fixed")}
                >
                  <SelectTrigger
                    id="default-deposit-type"
                    className="w-40"
                    data-testid="select-default-deposit-type"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No deposit</SelectItem>
                    <SelectItem value="percent">% Percent of total</SelectItem>
                    <SelectItem value="fixed">$ Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
                {defaultDepositType !== "none" && (
                  <div className="relative w-40">
                    {defaultDepositType === "fixed" && (
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    )}
                    <Input
                      type="number"
                      min="0"
                      step={defaultDepositType === "percent" ? "1" : "0.01"}
                      value={defaultDepositValue}
                      onChange={(e) => setDefaultDepositValue(e.target.value)}
                      placeholder={defaultDepositType === "percent" ? "50" : "0.00"}
                      className={cn(defaultDepositType === "fixed" && "pl-7")}
                      data-testid="input-default-deposit-value"
                    />
                    {defaultDepositType === "percent" && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Requires Stripe to be configured on the server
                (<code className="bg-muted px-1 rounded">STRIPE_SECRET_KEY</code>,
                <code className="bg-muted px-1 rounded ml-1">STRIPE_WEBHOOK_SECRET</code>).
                Until then, customers will see a "contact us" message in place of the deposit flow.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={
                  updateSettingsMutation.isPending ||
                  isLoading ||
                  (!marginValid && defaultGrossMarginPct !== "")
                }
                data-testid="button-save-preferences"
              >
                {updateSettingsMutation.isPending
                  ? "Saving..."
                  : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
