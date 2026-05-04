import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Compass, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/portfolio", icon: LayoutDashboard, label: "Portfolio" },
  { to: "/pools", icon: Compass, label: "Discover" },
  { to: "/chat", icon: MessageSquare, label: "AI Copilot" },
];

export function SideNav() {
  const { pathname } = useLocation();
  return (
    <aside className="hidden md:flex flex-col w-[68px] border-r border-border bg-sidebar shrink-0">
      <div className="h-14 flex items-center justify-center border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-1 p-2">
        {items.map((it) => {
          const active = pathname.startsWith(it.to);
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-md py-2.5 text-[10px] font-medium transition-colors",
                active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
              title={it.label}
            >
              {active && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary" />}
              <it.icon className="h-5 w-5" />
              <span>{it.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
