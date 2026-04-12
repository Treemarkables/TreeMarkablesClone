import { useSidebar } from "@/components/ui/sidebar";

interface LogoSidebarTriggerProps {
  className?: string;
  size?: number;
}

export function LogoSidebarTrigger({ className = "", size = 44 }: LogoSidebarTriggerProps) {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      onClick={toggleSidebar}
      data-testid="button-sidebar-toggle"
      aria-label="Toggle sidebar"
      className={`rounded-full flex-shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-1 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundImage: "url(/logos/treemarkables-logo.png)",
        backgroundSize: "118%",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        overflow: "hidden",
      }}
    />
  );
}
