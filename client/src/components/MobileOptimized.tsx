import React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface MobileOptimizedProps {
  children: React.ReactNode;
  className?: string;
}

// Mobile-optimized container component
export function MobileContainer({ children, className }: MobileOptimizedProps) {
  return (
    <div className={cn(
      "p-4 sm:p-6 lg:p-8", // Progressive padding scaling
      className
    )}>
      {children}
    </div>
  );
}

// Mobile-optimized grid component with fixed Tailwind classes
interface MobileGridProps {
  children: React.ReactNode;
  variant?: 'stats' | 'cards' | 'table' | 'analytics';
  className?: string;
}

export function MobileGrid({ 
  children, 
  variant = 'cards',
  className 
}: MobileGridProps) {
  const gridClasses = {
    stats: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4",
    cards: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", 
    table: "grid grid-cols-1 gap-4",
    analytics: "grid grid-cols-1 lg:grid-cols-2 gap-6"
  };
  
  return (
    <div className={cn(
      gridClasses[variant],
      className
    )}>
      {children}
    </div>
  );
}

// Mobile-optimized table wrapper
interface MobileTableProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileTable({ children, className }: MobileTableProps) {
  return (
    <div className={cn(
      "overflow-x-auto -mx-4 sm:mx-0", // Full width on mobile, normal on larger screens
      "mobile-scroll", // Use custom scrollbar from mobile.css
      className
    )}>
      <div className="min-w-full inline-block align-middle">
        <div className="shadow overflow-hidden border-b border-gray-200 sm:rounded-lg">
          {children}
        </div>
      </div>
    </div>
  );
}

// Mobile-optimized button group
interface MobileButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export function MobileButtonGroup({ 
  children, 
  orientation = 'horizontal',
  className 
}: MobileButtonGroupProps) {
  const flexDirection = orientation === 'vertical' 
    ? "flex-col" 
    : "flex-col sm:flex-row";
    
  return (
    <div className={cn(
      "flex",
      flexDirection,
      "gap-2 sm:gap-3",
      "w-full sm:w-auto",
      className
    )}>
      {children}
    </div>
  );
}

// Mobile-optimized card wrapper (uses shadcn Card)

interface MobileCardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MobileCard({ 
  children, 
  padding = 'md',
  className 
}: MobileCardProps) {
  const paddingClasses = {
    sm: "p-3 sm:p-4",
    md: "p-4 sm:p-6", 
    lg: "p-6 sm:p-8"
  };
  
  return (
    <Card className={cn(
      paddingClasses[padding],
      "mobile-card", // Custom mobile styles
      className
    )}>
      {children}
    </Card>
  );
}

// Mobile-optimized form field wrapper
interface MobileFormFieldProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileFormField({ children, className }: MobileFormFieldProps) {
  return (
    <div className={cn(
      "space-y-2 touch-manipulation", // Improves touch responsiveness
      className
    )}>
      {children}
    </div>
  );
}

// Mobile-optimized stats grid
interface MobileStatsGridProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileStatsGrid({ children, className }: MobileStatsGridProps) {
  return (
    <div className={cn(
      "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6",
      className
    )}>
      {children}
    </div>
  );
}

// Mobile-optimized analytics container
interface MobileAnalyticsProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileAnalytics({ children, className }: MobileAnalyticsProps) {
  return (
    <div className={cn(
      "w-full overflow-hidden", // Prevent chart overflow
      "touch-manipulation", // Better touch handling for charts
      className
    )}>
      {children}
    </div>
  );
}

// Mobile touch-friendly button sizes
export const mobileTouchSizes = {
  button: "min-h-[44px] min-w-[44px]", // Apple's recommended minimum touch target
  icon: "h-10 w-10 sm:h-8 sm:w-8", // Larger on mobile, normal on desktop
  input: "h-12 sm:h-10", // Larger input height on mobile
  padding: "p-3 sm:p-2", // More padding on mobile
  gap: "gap-3 sm:gap-2", // More spacing on mobile
} as const;

// Mobile utility classes
export const mobileUtils = {
  hideOnMobile: "hidden sm:block",
  showOnMobile: "block sm:hidden", 
  responsiveText: "text-sm sm:text-base",
  responsiveSpacing: "space-y-4 sm:space-y-6",
  mobileFullWidth: "w-full sm:w-auto",
  touchTarget: "min-h-[44px] min-w-[44px]", // Removed unsupported touch-manipulation
} as const;