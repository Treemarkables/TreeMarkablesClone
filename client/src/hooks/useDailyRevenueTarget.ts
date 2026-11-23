import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { parseDailyRevenueTarget } from "@shared/dailyRevenueTarget";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Per-business Despatch daily revenue target
 * (`business_settings.daily_revenue_target`, NZD exc. GST).
 *
 * The upcoming bundling page must use this hook. Do not hardcode a target.
 */
export function useDailyRevenueTarget() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery<{
    success?: boolean;
    data?: { dailyRevenueTarget?: string | number | null };
  }>({
    queryKey: ["/api/business-settings"],
  });

  const target = parseDailyRevenueTarget(query.data?.data?.dailyRevenueTarget);

  const mutation = useMutation({
    mutationFn: async (amount: number) => {
      const response = await apiRequest("PUT", "/api/business-settings", {
        dailyRevenueTarget: amount,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-settings"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update the daily revenue target. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    target,
    isLoading: query.isLoading,
    save: mutation.mutate,
    isSaving: mutation.isPending,
  };
}
