// Option A · Field first — inner content for despatch board day-Gantt job cards.
// Hierarchy: pin + address (bold) → time range ("to") → muted job name → price chip.
import type { ReactNode } from "react";
import { Check, MapPin, MessageSquare } from "lucide-react";
import { ganttStreetAddress, type JobIdentityColor } from "./calendarMath";

interface DispatchGanttJobCardContentProps {
  address?: string | null;
  timeLabel: string;
  jobName: string;
  priceLabel: string | null;
  color: JobIdentityColor;
  customerConfirmed?: boolean;
  customerReplyReceived?: boolean;
  showDetails: boolean;
  footer?: ReactNode;
}

export function DispatchGanttJobCardContent({
  address,
  timeLabel,
  jobName,
  priceLabel,
  color,
  customerConfirmed,
  customerReplyReceived,
  showDetails,
  footer,
}: DispatchGanttJobCardContentProps) {
  const street = ganttStreetAddress(address);
  const title = jobName.trim();

  return (
    <div
      className="px-2 py-1 h-full flex flex-col justify-start overflow-hidden"
      data-testid="dispatch-gantt-job-card"
    >
      <div className="flex items-start gap-1 min-w-0">
        {street ? (
          <span
            className="text-[10px] font-semibold leading-tight flex items-start gap-0.5 flex-1 min-w-0"
            style={{ color: color.text }}
          >
            <MapPin className="w-2.5 h-2.5 shrink-0 mt-px" aria-hidden="true" />
            <span className="min-w-0 whitespace-normal break-words">{street}</span>
          </span>
        ) : title ? (
          <span
            className="text-[10px] font-semibold leading-tight flex-1 min-w-0 whitespace-normal break-words"
            style={{ color: color.text }}
          >
            {title}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {customerConfirmed && (
          <Check className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={3} style={{ color: color.border }} />
        )}
        {!customerConfirmed && customerReplyReceived && (
          <MessageSquare className="h-3.5 w-3.5 shrink-0 mt-0.5" strokeWidth={2.5} style={{ color: color.border }} />
        )}
      </div>
      {showDetails && timeLabel ? (
        <span
          className="text-[9px] leading-tight block truncate"
          style={{ color: color.text, opacity: 0.8 }}
        >
          {timeLabel}
        </span>
      ) : null}
      {showDetails && street && title && title !== street ? (
        <span
          className="text-[9px] leading-tight block truncate"
          style={{ color: color.text, opacity: 0.55 }}
        >
          {title}
        </span>
      ) : null}
      {priceLabel ? (
        <span
          className="inline-flex w-fit max-w-full items-center rounded-full px-1.5 py-0.5 mt-0.5 text-[9px] font-semibold leading-none truncate"
          style={{
            backgroundColor: `${color.border}24`,
            color: color.text,
          }}
        >
          {priceLabel}
        </span>
      ) : null}
      {showDetails ? footer : null}
    </div>
  );
}
