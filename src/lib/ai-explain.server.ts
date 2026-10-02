import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { createLovableAiGatewayRunIdFetch } from "./run-id.server";

const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function explainOptions(prompt: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("AI is not configured", 401);
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  let streamError: unknown = null;
  const result = streamText({
    model: provider.responses(MODEL),
    maxRetries: 0,
    system:
      "You are a friendly, honest KCET (Karnataka engineering) counselling advisor. Explain the student's predicted college options using ONLY the data given. Use simple English and short markdown sections: 1) Quick summary, 2) Top picks (aspirational) and why, 3) Expected options, 4) Safe options, 5) Option-entry tips. Mention cutoffs from Round 1/Round 2. Never invent colleges or cutoffs. Never promise a seat. Keep it under 450 words.",
    prompt,
    onError: ({ error }) => { streamError = error; },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  let text = "";
  try { text = await result.text; } catch (e) { streamError = streamError ?? e; }
  if (streamError) {
    const s = (streamError as { statusCode?: number })?.statusCode ?? 500;
    if (s === 402) throw new AiError("AI credits have run out. Please add credits to keep using AI explanations.", 402);
    if (s === 429) throw new AiError("Too many requests right now. Please wait a minute and try again.", 429);
    if (s === 403) throw new AiError("The AI service declined this request.", 403);
    throw new AiError("The AI explanation could not be generated. Please try again later.", s);
  }
  if (!text.trim()) throw new AiError("The AI returned no explanation for this request.", 502);
  return text;
}
