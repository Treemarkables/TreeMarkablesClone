import { forwardRef } from "react";
import type { LucideIcon } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Big, labeled action button for the document-builder toolbars
 * (proposal / quote / invoice). On mobile the buttons stretch to fill
 * the toolbar width with the icon stacked above an always-visible
 * label; on sm+ they collapse to the compact inline icon+label pill.
 */
interface BuilderToolbarButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  label: string;
  loading?: boolean;
}

export const BuilderToolbarButton = forwardRef<
  HTMLButtonElement,
  BuilderToolbarButtonProps
>(({ icon: Icon, label, loading, className, disabled, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled || loading}
    className={cn(
      "flex flex-1 sm:flex-none min-w-0 flex-col sm:flex-row items-center justify-center",
      "gap-1 sm:gap-1.5 px-1 sm:px-3 py-2 sm:py-1.5 min-h-[54px] sm:min-h-0",
      "rounded-lg sm:rounded-md text-white shadow-sm transition-colors disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {loading ? (
      <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0 animate-spin" />
    ) : (
      <Icon className="w-5 h-5 sm:w-4 sm:h-4 flex-shrink-0" />
    )}
    {/* Two-word labels ("Email quote") wrap on mobile's narrow stacked buttons; sm+ has room to stay one line */}
    <span className="text-[11px] sm:text-sm font-medium leading-tight sm:leading-none text-center sm:truncate max-w-full">
      {label}
    </span>
  </button>
));

BuilderToolbarButton.displayName = "BuilderToolbarButton";
