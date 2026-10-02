import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Opt = z.object({
  college: z.string().max(200),
  branch: z.string().max(120),
  bucket: z.string().max(20),
  r1: z.number().nullable(),
  r2: z.number().nullable(),
});

export const explainPrediction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      rank: z.number().int().positive().max(300000),
      category: z.string().max(10),
      branches: z.array(z.string().max(120)).max(20),
      options: z.array(Opt).max(30),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const { explainOptions, AiError } = await import("./ai-explain.server");
    const lines = data.options.map((o, i) =>
      `${i + 1}. [${o.bucket}] ${o.college} — ${o.branch} (R1: ${o.r1 ?? "—"}, R2: ${o.r2 ?? "—"})`).join("\n");
    const prompt = `Student KCET rank: ${data.rank}\nCategory: ${data.category}\nPreferred courses (in order): ${data.branches.join(", ") || "Any"}\n\nPredicted options (closing cutoff ranks for this category):\n${lines || "No options found."}`;
    try {
      return { ok: true as const, text: await explainOptions(prompt) };
    } catch (e) {
      if (e instanceof AiError) return { ok: false as const, error: e.message };
      return { ok: false as const, error: "The AI explanation could not be generated." };
    }
  });
