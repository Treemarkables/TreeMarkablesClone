import { useSidebar } from "@/components/ui/sidebar";

interface LogoSidebarTriggerProps {
  className?: string;
  size?: number;
}

export function LogoSidebarTrigger({ className = "", size = 44 }: LogoSidebarTriggerProps) {
  const { openMobile, setOpenMobile, open, setOpen, isMobile } = useSidebar();

  const handleClick = () => {
    // Escape hatch: if the page is stuck behind a leaked Radix
    // `body { pointer-events: none }` lock (no dialog actually open), the menu
    // button is the first thing staff reach for when everything looks "jammed".
    // Clear the stale lock here so the very tap that reaches us also unjams the
    // rest of the page, without waiting on the global watchdog in App.tsx.
    if (typeof document !== "undefined" && document.body.style.pointerEvents === "none") {
      const hasOpenDialog = document.querySelector(
        '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]',
      );
      if (!hasOpenDialog) {
        document.body.style.pointerEvents = "";
      }
    }

    if (isMobile) {
      setOpenMobile(!openMobile);
    } else {
      setOpen(!open);
    }
  };

  return (
    <button
      onClick={handleClick}
      data-testid="button-sidebar-toggle"
      aria-label="Toggle sidebar"
      className={`rounded-full flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/inflow-icon-192.png?v=8)",
        backgroundSize: "100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
        // Stay clickable even if a leaked body pointer-events:none lock is
        // deadening the rest of the page, so this button can self-heal it.
        pointerEvents: "auto",
      }}
    />
  );
}
