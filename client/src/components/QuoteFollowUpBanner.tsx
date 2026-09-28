import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface CountResponse {
  success: boolean;
  data?: { count?: number; quotes?: number; invoicesNotInXero?: number; jobsNotBilled?: number; notBilledJobId?: string | null };
}

export function QuoteFollowUpBanner({ testId }: { testId: string }) {
  const { data } = useQuery<CountResponse>({
    queryKey: ["/api/quote-follow-ups/count"],
    refetchInterval: 60_000,
  });
  const quotes = data?.data?.quotes ?? 0;
  const invoices = data?.data?.invoicesNotInXero ?? 0;
  const jobs = data?.data?.jobsNotBilled ?? 0;
  const count = data?.data?.count ?? quotes + invoices + jobs;
  if (count <= 0) return null;
  const onlyXero = quotes === 0 && jobs === 0 && invoices > 0;
  const onlyQuotes = invoices === 0 && jobs === 0 && quotes > 0;
  const onlyJobs = quotes === 0 && invoices === 0 && jobs > 0;
  const label = onlyJobs
    ? (jobs === 1 ? "1 completed job not billed" : `${jobs} completed jobs not billed`)
    : (onlyXero
      ? (invoices === 1 ? "1 invoice not in Xero" : `${invoices} invoices not in Xero`)
      : (onlyQuotes
        ? (quotes === 1 ? "1 quote follow-up waiting" : `${quotes} quote follow-ups waiting`)
        : `${count} follow-ups waiting`));
  const note = onlyJobs
    ? "Nothing has been created or sent yet."
    : (onlyXero
      ? "Nothing has been synced yet."
      : (onlyQuotes ? "Nothing has been sent yet." : "Nothing has been approved yet."));
  const jobId = data?.data?.notBilledJobId;
  const href = onlyJobs
    ? (jobs === 1 && jobId ? `/dispatch?job=${jobId}` : "/quote-follow-ups?tab=billed")
    : (onlyXero ? "/quote-follow-ups?tab=xero" : "/quote-follow-ups");

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
