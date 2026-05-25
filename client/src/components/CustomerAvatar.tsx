import { useMemo } from "react";

interface CustomerAvatarProps {
  customerName: string;
  status?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const getStatusColors = (status?: string): { bg: string; text: string } => {
  if (!status) return { bg: "bg-purple-400", text: "text-purple-950" };

  switch (status.toLowerCase().replace(/\s+/g, '_')) {
    case 'completed':   return { bg: "bg-green-400",  text: "text-green-950" };
    case 'work_order':  return { bg: "bg-blue-400",   text: "text-blue-950" };
    case 'quote':       return { bg: "bg-orange-400", text: "text-orange-950" };
    case 'invoiced':    return { bg: "bg-violet-400", text: "text-violet-950" };
    case 'lead':
    case 'inquiry':     return { bg: "bg-yellow-400", text: "text-yellow-950" };
    case 'mulch':       return { bg: "bg-lime-400",   text: "text-lime-950" };
    case 'unsuccessful':return { bg: "bg-red-400",    text: "text-red-950" };
    default:            return { bg: "bg-purple-400", text: "text-purple-950" };
  }
};

const getStatusLabel = (status?: string): string => {
  if (!status) return "?";
  switch (status.toLowerCase().replace(/\s+/g, '_')) {
    case 'lead':
    case 'inquiry':    return "L";
    case 'mulch':      return "M";
    case 'quote':      return "Q";
    case 'work_order': return "W";
    case 'completed':  return "C";
    case 'invoiced':   return "I";
    case 'unsuccessful': return "U";
    default:           return status.charAt(0).toUpperCase();
  }
};

export function CustomerAvatar({ customerName, status, size = "md", className = "" }: CustomerAvatarProps) {
  const label = useMemo(() => getStatusLabel(status), [status]);
  const { bg, text } = useMemo(() => getStatusColors(status), [status]);

  const sizeClasses = {
    sm: "w-6 h-6 text-xs",
    md: "w-8 h-8 text-sm",
    lg: "w-10 h-10 text-base"
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
