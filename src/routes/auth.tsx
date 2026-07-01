import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — KCET - College & Course Predictor" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setCheckingSession(false);
      }
    });
    // Safety net — if a session appears (Google popup / magic link),
    // route to dashboard immediately without requiring a manual refresh.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session) {
        router.invalidate();
        navigate({ to: "/dashboard", replace: true });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, router]);

  function requireAgreed(): boolean {
    if (!agreed) {
      toast.error("Please accept the Terms & Conditions to continue.");
      return false;
    }
    return true;
  }

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAgreed()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
    router.invalidate();
    navigate({ to: "/dashboard", replace: true });
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    if (!requireAgreed()) return;
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + "/dashboard",
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — you can now sign in.");
  }

  async function google() {
    if (!requireAgreed()) return;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) return toast.error(result.error.message ?? "Google sign-in failed");
    if (result.redirected) return;
    router.invalidate();
    navigate({ to: "/dashboard", replace: true });
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-hero-gradient">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Link to="/" className="inline-flex items-center gap-2 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/20 backdrop-blur">
              <GraduationCap className="h-5 w-5" />
            </span>
            <span className="font-semibold">KCET - College & Course Predictor</span>
          </Link>
        </div>
      </div>

      <div className="mx-auto -mt-12 max-w-md px-4 pb-16">
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-elegant sm:p-8">
          <h1 className="text-2xl font-bold">Welcome, future engineer</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to start predicting your KCET colleges.
          </p>

          <div className="mt-5 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="terms" className="cursor-pointer text-sm leading-snug">
              I have read and agree to the{" "}
              <TermsDialog />
              .
            </label>
          </div>

          <Button
            variant="outline"
            className="mt-4 w-full"
            onClick={google}
            disabled={!agreed}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue="login">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={login} className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="le">Email</Label>
                  <Input id="le" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="lp">Password</Label>
                  <Input id="lp" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !agreed}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form onSubmit={register} className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="rn">Full name</Label>
                  <Input id="rn" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="re">Email</Label>
                  <Input id="re" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="rp">Password</Label>
                  <Input id="rp" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !agreed}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

function TermsDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          onClick={(e) => e.preventDefault()}
        >
          Terms &amp; Conditions
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Terms &amp; Conditions</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-foreground">
          <p>
            This platform provides prediction and counseling guidance using Round 1,
            Round 2, and Seat Matrix analysis.
          </p>
          <p>Predictions are estimates intended to assist students.</p>
          <p>
            Admission outcomes may vary due to category competition, counseling rounds,
            seat availability, newly added seats, and official KEA decisions.
          </p>
          <p>
            Students must verify all information through official KEA sources before
            final option entry.
          </p>
          <p>
            <strong>KCET College &amp; Course Predictor</strong> and its developer are
            not responsible for final allotment outcomes or counseling decisions.
          </p>
          <p>
            This platform should be used as a guidance tool and not as the sole basis
            for admission decisions.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
