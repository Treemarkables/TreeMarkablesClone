import { useSidebar } from "@/components/ui/sidebar";

interface LogoSidebarTriggerProps {
  className?: string;
  size?: number;
}

export function LogoSidebarTrigger({ className = "", size = 44 }: LogoSidebarTriggerProps) {
  const { openMobile, setOpenMobile, open, setOpen, isMobile } = useSidebar();

  const handleClick = () => {
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
      className={`rounded-full flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/inflow-icon-192.png?v=6)",
        backgroundSize: "100%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
      }}
    />
  );
}
