import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface CountResponse {
  success: boolean;
  data?: { count?: number; quotes?: number; invoicesNotInXero?: number };
}

export function QuoteFollowUpBanner({ testId }: { testId: string }) {
  const { data } = useQuery<CountResponse>({
    queryKey: ["/api/quote-follow-ups/count"],
    refetchInterval: 60_000,
  });
  const quotes = data?.data?.quotes ?? 0;
  const invoices = data?.data?.invoicesNotInXero ?? 0;
  const count = data?.data?.count ?? quotes + invoices;
  if (count <= 0) return null;
  const onlyXero = quotes === 0 && invoices > 0;
  const onlyQuotes = invoices === 0 && quotes > 0;
  const label = onlyXero
    ? (invoices === 1 ? "1 invoice not in Xero" : `${invoices} invoices not in Xero`)
    : (onlyQuotes
      ? (quotes === 1 ? "1 quote follow-up waiting" : `${quotes} quote follow-ups waiting`)
      : `${count} follow-ups waiting`);
  const note = onlyXero
    ? "Nothing has been synced yet."
    : (onlyQuotes ? "Nothing has been sent yet." : "Nothing has been sent or synced yet.");
  const href = onlyXero ? "/quote-follow-ups?tab=xero" : "/quote-follow-ups";

  return (
    <Link href={href}>
      <div
        className="mx-2 mt-2 mb-1 rounded-2xl border border-border bg-card px-4 py-2 text-sm flex items-center justify-between gap-3"
        data-testid={testId}
      >
        <span>{label}. {note}</span>
        <span className="font-medium shrink-0">Review</span>
      </div>
    </Link>
  );
}
