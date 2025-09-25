import { useMemo } from "react";

interface CustomerAvatarProps {
  customerName: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Generate consistent colors based on customer name
const generateAvatarColor = (name: string): string => {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500", 
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-amber-500",
    "bg-red-500",
    "bg-green-500",
    "bg-cyan-500",
    "bg-yellow-500"
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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

export function CustomerAvatar({ customerName, size = "md", className = "" }: CustomerAvatarProps) {
  const initials = useMemo(() => getInitials(customerName), [customerName]);
  const bgColor = useMemo(() => generateAvatarColor(customerName), [customerName]);
  
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