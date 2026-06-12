import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization") ?? "";
          const token = authHeader.replace(/^Bearer\s+/i, "");
          if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

          const body = (await request.json()) as { threadId?: string; message?: string };
          if (!body.threadId || !body.message) {
            return new Response(JSON.stringify({ error: "Missing threadId or message" }), { status: 400 });
          }

          const supabaseUrl = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!supabaseUrl || !supabaseKey) return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 500 });
          if (!apiKey) return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500 });

          const supabase = createClient(supabaseUrl, supabaseKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const { data: userData } = await supabase.auth.getUser();
          const user = userData.user;
          if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

          // Verify thread ownership
          const { data: thread } = await supabase.from("chat_threads").select("id,title").eq("id", body.threadId).single();
          if (!thread) return new Response(JSON.stringify({ error: "Thread not found" }), { status: 404 });

          // Save user message
          await supabase.from("chat_messages").insert({
            thread_id: body.threadId, user_id: user.id, role: "user", content: body.message,
          });

          // Load history
          const { data: history } = await supabase
            .from("chat_messages").select("role,content")
            .eq("thread_id", body.threadId).order("created_at", { ascending: true }).limit(40);

          const systemPrompt = `You are an expert AI counselor for KCET (Karnataka Common Entrance Test) students. Help them with college selection, branch choices, cutoff analysis, documents required, counseling rounds (Mock, Round 1, Round 2, Round 3, Extended Round), seat allotment, fee structure, hostel info, and career guidance for Karnataka engineering colleges. Be warm, clear, and use bullet points when helpful. Always remind students that previous-year cutoffs are guidance, not guarantees.`;

          const messages = [
            { role: "system", content: systemPrompt },
            ...(history ?? []).map(m => ({ role: m.role, content: m.content })),
          ];

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
            body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
          });

          if (!aiRes.ok) {
            const errText = await aiRes.text();
            if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit reached — please try again shortly." }), { status: 429 });
            if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Lovable Cloud." }), { status: 402 });
            return new Response(JSON.stringify({ error: "AI error: " + errText.slice(0, 200) }), { status: 500 });
          }
          const aiJson = await aiRes.json() as { choices?: { message?: { content?: string } }[] };
          const reply = aiJson.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a reply.";

          await supabase.from("chat_messages").insert({
            thread_id: body.threadId, user_id: user.id, role: "assistant", content: reply,
          });

          // Update thread title from first user message if still default
          if (thread.title === "New Chat") {
            const title = body.message.slice(0, 60);
            await supabase.from("chat_threads").update({ title, updated_at: new Date().toISOString() }).eq("id", body.threadId);
          } else {
            await supabase.from("chat_threads").update({ updated_at: new Date().toISOString() }).eq("id", body.threadId);
          }

          return new Response(JSON.stringify({ reply }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500 });
        }
      },
    },
  },
});
