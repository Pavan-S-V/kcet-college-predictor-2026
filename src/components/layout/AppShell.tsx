import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  GraduationCap, Home, LayoutDashboard, Target, User as UserIcon, LogOut, History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";
import { ShieldCheck, Sparkles } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Predict College", icon: LayoutDashboard },
  { to: "/college-chances", label: "College & Branch Chances", icon: Target },
  { to: "/history", label: "History", icon: History },
  { to: "/ai-advisor", label: "AI Advisor", icon: Sparkles },
  { to: "/about", label: "About", icon: UserIcon },
] as const;

export function AppShell() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdminFn = useServerFn(checkIsAdmin);
  const { data: adminData } = useQuery({ queryKey: ["is-admin", user?.id], queryFn: () => isAdminFn(), enabled: !!user });
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-semibold tracking-tight">KCET - College & Course Predictor</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            <Link
              to="/"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Home className="h-4 w-4" /> Home
            </Link>
            {NAV.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {adminData?.isAdmin && (
              <Link to="/admin" className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-muted">
                <ShieldCheck className="h-4 w-4" /> Admin
              </Link>
            )}
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {user?.user_metadata?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2 md:hidden">
          <Link to="/" className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <Home className="h-4 w-4" /> Home
          </Link>
          {NAV.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link key={n.to} to={n.to} className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                active ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              )}>
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 text-center text-sm text-muted-foreground">
          Developed by — <span className="font-semibold text-foreground">PAVAN S V</span>
        </div>
      </footer>
    </div>
  );
}
