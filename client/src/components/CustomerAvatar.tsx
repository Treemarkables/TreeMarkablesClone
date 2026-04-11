import { useMemo } from "react";

interface CustomerAvatarProps {
  customerName: string;
  status?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const getStatusColors = (status?: string): { bg: string; text: string } => {
  if (!status) return { bg: "bg-purple-100", text: "text-purple-700" };

  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');

  switch (normalizedStatus) {
    case 'completed':
      return { bg: "bg-green-100", text: "text-green-700" };
    case 'work_order':
      return { bg: "bg-blue-100", text: "text-blue-700" };
    case 'scheduled':
      return { bg: "bg-green-100", text: "text-green-700" };
    case 'quote':
      return { bg: "bg-orange-100", text: "text-orange-700" };
    case 'invoiced':
      return { bg: "bg-violet-100", text: "text-violet-700" };
    case 'lead':
    case 'inquiry':
      return { bg: "bg-emerald-100", text: "text-emerald-700" };
    case 'unsuccessful':
      return { bg: "bg-red-100", text: "text-red-700" };
    default:
      return { bg: "bg-purple-100", text: "text-purple-700" };
  }
};

const getStatusLabel = (status?: string): string => {
  if (!status) return "?";
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  switch (normalizedStatus) {
    case 'lead':
    case 'inquiry':   return "Lead";
    case 'quote':     return "Quote";
    case 'work_order':return "W/O";
    case 'scheduled': return "Sched";
    case 'completed': return "Done";
    case 'invoiced':  return "Inv";
    case 'unsuccessful': return "Lost";
    default:          return status.charAt(0).toUpperCase() + status.slice(1);
  }
};

export function CustomerAvatar({ customerName, status, size = "md", className = "" }: CustomerAvatarProps) {
  const label = useMemo(() => getStatusLabel(status), [status]);
  const { bg, text } = useMemo(() => getStatusColors(status), [status]);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-xs",
    lg: "w-12 h-12 text-sm"
  };

  return (
    <div
      className={`${bg} ${text} ${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      data-testid={`avatar-${customerName.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {label}
    </div>
  );
}
