import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, GraduationCap, MapPin, ArrowLeft } from "lucide-react";
import { PublicNav, SiteFooter } from "@/components/layout/PublicNav";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About the Developer — KCET Dream College" }] }),
  component: About,
});

function About() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      <section className="bg-hero-gradient">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center text-white">
          <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-white/15 text-4xl font-bold backdrop-blur">
            PS
          </div>
          <h1 className="mt-6 text-4xl font-bold">Hi, I'm Pavan S V</h1>
          <p className="mt-3 text-lg text-white/85">
            Builder of KCET Dream College & Course platform
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-border bg-surface p-8 shadow-elegant">
          <p className="text-lg leading-relaxed text-foreground">
            I built this platform to help KCET students make informed counseling decisions — the
            kind of clarity I wished I had when I was choosing my engineering college.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            By combining previous-year cutoffs, seat matrix data and AI guidance, this tool helps
            you spot dream colleges, expected matches and sure-shot fallbacks — instantly.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <GraduationCap className="h-4 w-4" /> Studying at
              </div>
              <div className="mt-1 font-semibold">
                Channabasaveshwara Institute of Technology (CIT)
              </div>
              <div className="text-sm text-muted-foreground">Gubbi, Tumakuru</div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <MapPin className="h-4 w-4" /> Location
              </div>
              <div className="mt-1 font-semibold">Karnataka, India</div>
            </div>
          </div>

          <a
            href="mailto:pavansv122@gmail.com"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-primary hover:bg-primary/15"
          >
            <Mail className="h-4 w-4" /> pavansv122@gmail.com
          </a>

          <div className="mt-8 flex gap-3">
            <Link to="/auth">
              <Button>Try the predictor</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
