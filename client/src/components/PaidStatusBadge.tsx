/**
 * Green paid pill used on the job card header and invoice screens.
 * Label is "PAID" on the job card and "Paid" on invoices.
 */
export function PaidStatusBadge({
  label = "PAID",
  testId = "badge-invoice-paid",
  className = "",
}: {
  label?: string;
  testId?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-600 text-white whitespace-nowrap flex-shrink-0 ${className}`}
      data-testid={testId}
    >
      {label}
    </span>
  );
}
