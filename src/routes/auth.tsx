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
            <div className="text-sm leading-snug">
              <label htmlFor="terms" className="cursor-pointer">
                I have read and agree to the{" "}
              </label>
              <TermsDialog />
              <label htmlFor="terms" className="cursor-pointer">.</label>
            </div>
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
        >
          Terms &amp; Conditions
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Terms &amp; Conditions</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-foreground">
          <section>
            <h3 className="font-semibold text-foreground">Welcome</h3>
            <p className="mt-1 text-muted-foreground">
              Welcome to KCET – College &amp; Course Predictor Platform. By accessing or using
              this platform, you agree to comply with and be bound by these Terms &amp; Conditions.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">1. Acceptance of Terms</h3>
            <p className="mt-1 text-muted-foreground">
              By using this platform, creating an account, or accessing any features of the
              website, you acknowledge that you have read, understood, and agreed to these
              Terms &amp; Conditions. If you do not agree with these terms, please do not use the platform.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">2. Purpose of the Platform</h3>
            <p className="mt-1 text-muted-foreground">
              KCET – College &amp; Course Predictor is an informational and guidance platform
              designed to assist students during KCET counseling by providing:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>College prediction analysis</li>
              <li>Branch prediction analysis</li>
              <li>Cutoff trend analysis</li>
              <li>College and branch admission probability estimates</li>
              <li>Counseling support information</li>
              <li>PDF reports and recommendation lists</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              The platform is intended solely as a guidance tool and should not be considered
              an official counseling authority.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">3. No Guarantee of Admission</h3>
            <p className="mt-1 text-muted-foreground">
              The platform does not guarantee admission, seat allotment, college selection,
              branch allocation, or counseling outcomes. Admission results may vary based on:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>KCET Rank</li>
              <li>Category</li>
              <li>Reservation Policies</li>
              <li>Seat Availability</li>
              <li>Counseling Rounds</li>
              <li>Newly Introduced Seats</li>
              <li>Government Regulations</li>
              <li>Official KEA Decisions</li>
              <li>Candidate Preferences</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Predictions generated by the platform are estimates based on historical data
              and available information.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">4. Accuracy of Information</h3>
            <p className="mt-1 text-muted-foreground">
              We strive to provide accurate and updated information. However, we do not warrant
              that all data, cutoff ranks, seat matrices, predictions, or reports are free from
              errors, omissions, delays, or future changes. Official notifications released by
              KEA, Government authorities, VTU, AICTE, universities, or colleges shall always
              take precedence over information displayed on this platform.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">5. User Responsibility</h3>
            <p className="mt-1 text-muted-foreground">Users are solely responsible for:</p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Verifying official counseling information</li>
              <li>Reviewing official cutoff data</li>
              <li>Confirming eligibility requirements</li>
              <li>Making option entry decisions</li>
              <li>Choosing colleges and branches</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Users should not rely exclusively on the platform when making admission-related decisions.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">6. Limitation of Liability</h3>
            <p className="mt-1 text-muted-foreground">
              To the maximum extent permitted by law, KCET – College &amp; Course Predictor and
              its developer shall not be liable for:
            </p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Admission outcomes</li>
              <li>Counseling results</li>
              <li>Seat allotments</li>
              <li>Rejected applications</li>
              <li>Incorrect option entry decisions</li>
              <li>Financial losses</li>
              <li>Educational losses</li>
              <li>Missed opportunities</li>
              <li>Any direct or indirect damages arising from use of the platform</li>
            </ul>
            <p className="mt-2 text-muted-foreground">
              Use of the platform is entirely at the user's own discretion and responsibility.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">7. Third-Party Information</h3>
            <p className="mt-1 text-muted-foreground">
              The platform may reference data obtained from publicly available sources,
              educational institutions, government portals, and counseling records. Ownership
              of such information remains with the respective organizations.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">8. Service Availability</h3>
            <p className="mt-1 text-muted-foreground">We reserve the right to:</p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground">
              <li>Modify features</li>
              <li>Update prediction algorithms</li>
              <li>Correct data</li>
              <li>Suspend services</li>
              <li>Restrict access</li>
              <li>Improve functionality</li>
            </ul>
            <p className="mt-2 text-muted-foreground">without prior notice.</p>
          </section>

          <section>
            <h3 className="font-semibold">9. Privacy</h3>
            <p className="mt-1 text-muted-foreground">
              The platform may store basic account information necessary for authentication
              and service functionality. User information will be handled in accordance with
              applicable privacy standards.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">10. Changes to Terms</h3>
            <p className="mt-1 text-muted-foreground">
              These Terms &amp; Conditions may be updated periodically. Continued use of the
              platform after modifications constitutes acceptance of the revised terms.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">11. Contact</h3>
            <p className="mt-1 text-muted-foreground">
              For questions, feedback, or reporting issues related to the platform, users may
              contact the developer through the official channels provided on the website.
            </p>
          </section>

          <section className="rounded-md border border-primary/30 bg-primary/5 p-3">
            <h3 className="font-semibold text-primary">📌 Important Notice</h3>
            <p className="mt-1 text-muted-foreground">
              KCET – College &amp; Course Predictor is an independent educational guidance
              platform created to assist students during KCET counseling. All final counseling
              decisions should be made only after reviewing official KEA notifications, cutoff
              lists, seat matrices, eligibility requirements, and counseling guidelines.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
