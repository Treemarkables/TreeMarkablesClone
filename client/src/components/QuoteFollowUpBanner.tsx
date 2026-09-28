import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface CountResponse {
  success: boolean;
  data?: { count?: number };
}

export function QuoteFollowUpBanner({ testId }: { testId: string }) {
  const { data } = useQuery<CountResponse>({
    queryKey: ["/api/quote-follow-ups/count"],
    refetchInterval: 60_000,
  });
  const count = data?.data?.count ?? 0;
  if (count <= 0) return null;
  const label = count === 1
    ? "1 quote follow-up waiting"
    : `${count} quote follow-ups waiting`;

  return (
    <Link href="/quote-follow-ups">
      <div
        className="mx-2 mt-2 mb-1 rounded-2xl border border-border bg-card px-4 py-2 text-sm flex items-center justify-between gap-3"
        data-testid={testId}
      >
        <span>{label}. Nothing has been sent yet.</span>
        <span className="font-medium shrink-0">Review</span>
      </div>
    </Link>
  );
}
