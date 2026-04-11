import { useMemo } from "react";

interface CustomerAvatarProps {
  customerName: string;
  status?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Generate soft pastel colors based on job status
const getStatusColors = (status?: string): { bg: string; text: string } => {
  if (!status) return { bg: "bg-purple-100", text: "text-purple-700" };

  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');

  switch (normalizedStatus) {
    case 'completed':
      return { bg: "bg-green-100", text: "text-green-700" };
    case 'work_order':
    case 'scheduled':
      return { bg: "bg-blue-100", text: "text-blue-700" };
    case 'quote':
      return { bg: "bg-orange-100", text: "text-orange-700" };
    case 'lead':
    case 'inquiry':
      return { bg: "bg-cyan-100", text: "text-cyan-700" };
    case 'unsuccessful':
      return { bg: "bg-red-100", text: "text-red-700" };
    default:
      return { bg: "bg-purple-100", text: "text-purple-700" };
  }
};

// Extract initials from customer name
const getInitials = (name: string): string => {
  if (!name) return "?";

  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].charAt(0).toUpperCase();
  } else {
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  }
};

export function CustomerAvatar({ customerName, status, size = "md", className = "" }: CustomerAvatarProps) {
  const initials = useMemo(() => getInitials(customerName), [customerName]);
  const { bg, text } = useMemo(() => getStatusColors(status), [status]);

  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base"
  };

  return (
    <div
      className={`${bg} ${text} ${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      data-testid={`avatar-${customerName.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {initials}
    </div>
  );
}
