import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, ArrowLeft, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function SettingsPreferences() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [metricsStartDate, setMetricsStartDate] = useState<Date | undefined>(undefined);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/business-settings'],
  });

  // Update local state when settings are loaded
  useEffect(() => {
    if (settings?.data?.metricsStartDate) {
      setMetricsStartDate(new Date(settings.data.metricsStartDate));
    }
  }, [settings]);

  // Mutation to update settings
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('PUT', '/api/business-settings', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/business-settings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/overview'] });
      toast({
        title: "Settings Updated",
        description: "Your preferences have been saved successfully.",
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
    updateSettingsMutation.mutate({
      metricsStartDate: metricsStartDate ? metricsStartDate.toISOString() : null,
    });
  };

  const handleClearDate = () => {
    setMetricsStartDate(undefined);
  };

  const handleSetToday = () => {
    setMetricsStartDate(new Date());
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild data-testid="button-back-to-settings">
          <Link href="/settings" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Link>
        </Button>
      </div>

      {/* Main content */}
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" data-testid="text-page-title">
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
              Control which jobs are included in your business analytics and reports
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="metrics-start-date" className="text-base font-medium">
                Metrics Start Date
              </Label>
              <p className="text-sm text-muted-foreground">
                Only jobs created on or after this date will be included in analytics, revenue reports, and performance metrics. 
                Leave blank to include all jobs.
              </p>
              
              <div className="flex items-center gap-3 mt-4">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="metrics-start-date"
                      variant="outline"
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !metricsStartDate && "text-muted-foreground"
                      )}
                      data-testid="button-select-metrics-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {metricsStartDate ? format(metricsStartDate, "PPP") : <span>Select a date</span>}
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
                  <strong>{format(metricsStartDate, "MMMM d, yyyy")}</strong> will be 
                  excluded from all analytics and reports. This helps ensure your metrics 
                  only reflect actual business operations, not imported historical data.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending || isLoading}
                data-testid="button-save-preferences"
              >
                {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
