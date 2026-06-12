import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-semibold tracking-tight">KCET Dream College</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <Link to="/about" className="hover:text-foreground">
            About
          </Link>
          <Link to="/auth" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/auth">
            <Button size="sm" variant="outline">
              Sign in
            </Button>
          </Link>
          <Link to="/auth">
            <Button size="sm" className="bg-primary hover:bg-primary/90">
              Get started
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 text-center text-sm text-muted-foreground">
        Built By — <span className="font-semibold text-foreground">PAVAN S V</span>
      </div>
    </footer>
  );
}
