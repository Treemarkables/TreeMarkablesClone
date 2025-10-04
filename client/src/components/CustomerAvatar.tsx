import { useMemo } from "react";

interface CustomerAvatarProps {
  customerName: string;
  status?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Generate colors based on job status (matching desktop dispatch board)
const getStatusColor = (status?: string): string => {
  if (!status) return "bg-purple-500"; // Default fallback
  
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  
  switch (normalizedStatus) {
    case 'completed':
      return 'bg-green-500';
    case 'work_order':
    case 'scheduled':
      return 'bg-blue-500';
    case 'quote':
      return 'bg-orange-500';
    case 'lead':
    case 'inquiry':
      return 'bg-cyan-500';
    case 'unsuccessful':
      return 'bg-red-500';
    default:
      return 'bg-purple-500';
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
  const bgColor = useMemo(() => getStatusColor(status), [status]);
  
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm", 
    lg: "w-12 h-12 text-base"
  };
  
  return (
    <div 
      className={`${bgColor} ${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${className}`}
      data-testid={`avatar-${customerName.replace(/\s+/g, '-').toLowerCase()}`}
    >
      {initials}
    </div>
  );
}