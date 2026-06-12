import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Brain, Mic, GraduationCap, BarChart3, FileDown, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublicNav, SiteFooter } from "@/components/layout/PublicNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Get Your Dream College and Course — KCET Predictor" },
      { name: "description", content: "AI-powered KCET counseling platform. Predict colleges and branches using previous year cutoffs, seat matrix and category analysis." },
      { property: "og:title", content: "Get Your Dream College and Course" },
      { property: "og:description", content: "AI-Powered KCET Counseling & College Prediction Platform." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: GraduationCap, title: "KCET College Predictor", text: "See colleges where your rank fits — backed by Round 1 & Round 2 cutoff data." },
  { icon: ListChecks, title: "Branch Predictor", text: "Pick your preferred branches and discover where you'll most likely get a seat." },
  { icon: Brain, title: "AI Counselor", text: "Chat with an AI mentor trained on KCET counseling, eligibility and strategy." },
  { icon: Mic, title: "Voice Assistant", text: "Ask questions hands-free — speak naturally and get spoken responses." },
  { icon: BarChart3, title: "College Comparison", text: "Compare cutoffs, expected packages and confidence side-by-side." },
  { icon: FileDown, title: "PDF Reports", text: "Download a personalized counseling shortlist for your family review." },
];

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      <section className="relative overflow-hidden">
        <div className="bg-hero-gradient absolute inset-0 opacity-95" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 text-center text-white">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> AI-Powered KCET Counseling 2025
          </div>
          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            Get Your Dream College <br className="hidden sm:block" />
            <span className="text-emerald-200">and Course</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
            AI-Powered KCET Counseling & College Prediction Platform. Built for Karnataka engineering aspirants — turn your rank into a smart counseling plan in seconds.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                Predict my college <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/about">
              <Button size="lg" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20">
                Meet the developer
              </Button>
            </Link>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {[
              { k: "224+", v: "Colleges in database" },
              { k: "31k+", v: "Cutoff data points" },
              { k: "22", v: "Categories supported" },
            ].map((s) => (
              <div key={s.v} className="rounded-xl bg-white/10 px-5 py-4 backdrop-blur">
                <div className="text-2xl font-bold">{s.k}</div>
                <div className="text-sm text-white/80">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need for <span className="text-gradient">KCET counseling</span>
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            One platform — prediction, comparison, AI mentoring and a shareable PDF report.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group rounded-2xl border border-border bg-surface p-6 transition-all hover:shadow-elegant hover:-translate-y-0.5">
                <div className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-surface border-t border-border">
        <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 text-center">
          <h2 className="text-3xl font-bold">Ready to find your dream college?</h2>
          <p className="mt-3 text-muted-foreground">Create your account in 30 seconds and run your first prediction free.</p>
          <Link to="/auth"><Button size="lg" className="mt-6">Get started free <ArrowRight className="ml-1 h-4 w-4" /></Button></Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
