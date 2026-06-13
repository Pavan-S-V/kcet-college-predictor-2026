import { createFileRoute } from "@tanstack/react-router";
import { Mail, GraduationCap, MapPin } from "lucide-react";
import { PublicNav, SiteFooter } from "@/components/layout/PublicNav";
import pavanPhoto from "@/assets/pavan.jpeg.asset.json";

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
          <img
            src={pavanPhoto.url}
            alt="Pavan S V"
            className="mx-auto h-36 w-36 rounded-full object-cover ring-4 ring-white/40 shadow-2xl sm:h-40 sm:w-40"
          />
          <h1 className="mt-6 text-3xl font-medium sm:text-4xl">Hi, I'm Pavan S V</h1>
          <p className="mt-2 text-base text-white/85 sm:text-lg">
            Founder & Developer of KCET Counselling 2026
          </p>
          <p className="mt-1 text-base text-emerald-200 font-medium sm:text-lg">
            Get Your Dream College and Course
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
            you spot top picks, expected matches and sure-shot fallbacks — instantly.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <GraduationCap className="h-4 w-4" /> Studying at
              </div>
              <div className="mt-1 font-semibold">Channabasaveshwara Institute of Technology (CIT)</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <MapPin className="h-3 w-3" /> Gubbi, Tumakuru
              </div>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Mail className="h-4 w-4" /> Contact
              </div>
              <a href="mailto:pavansv122@gmail.com" className="mt-1 block font-semibold hover:underline">
                pavansv122@gmail.com
              </a>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
