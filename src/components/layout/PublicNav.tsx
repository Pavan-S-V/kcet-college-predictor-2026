import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { GraduationCap, Home, LayoutDashboard, Target, User as UserIcon, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const AUTHED_NAV = [
  { to: "/dashboard", label: "Predict College", icon: LayoutDashboard },
  { to: "/college-chances", label: "College & Branch Chances", icon: Target },
  { to: "/about", label: "About", icon: UserIcon },
] as const;

export function PublicNav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const isAuthed = !!user && !loading;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to={isAuthed ? "/dashboard" : "/"} className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">KCET - College & Course Predictor</span>
        </Link>

        {isAuthed ? (
          <>
            <nav className="hidden items-center gap-1 md:flex">
              <Link to="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted">
                <Home className="h-4 w-4" /> Home
              </Link>
              {AUTHED_NAV.map((n) => {
                const Icon = n.icon;
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                return (
                  <Link key={n.to} to={n.to} className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}>
                    <Icon className="h-4 w-4" /> {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {user?.user_metadata?.full_name || user?.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-1" /> Sign out
              </Button>
            </div>
          </>
        ) : (
          <>
            <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <Link to="/about" className="hover:text-foreground">About</Link>
              <Link to="/auth" className="hover:text-foreground">Sign in</Link>
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/auth"><Button size="sm" variant="outline">Sign in</Button></Link>
              <Link to="/auth"><Button size="sm" className="bg-primary hover:bg-primary/90">Get started</Button></Link>
            </div>
          </>
        )}
      </div>

      {isAuthed && (
        <div className="flex gap-1 overflow-x-auto border-t border-border px-2 py-2 md:hidden">
          <Link to="/" className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <Home className="h-4 w-4" /> Home
          </Link>
          {AUTHED_NAV.map((n) => {
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
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 text-center text-sm text-muted-foreground">
        Developed by — <span className="font-semibold text-foreground">PAVAN S V</span>
      </div>
    </footer>
  );
}
