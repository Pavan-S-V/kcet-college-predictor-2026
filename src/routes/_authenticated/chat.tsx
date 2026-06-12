import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, MessageCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "AI Counselor — KCET" }] }),
  component: ChatList,
});

interface Thread { id: string; title: string; updated_at: string }

function ChatList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("chat_threads").select("id,title,updated_at").order("updated_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setThreads(data ?? []);
      });
  }, [user]);

  async function newChat() {
    if (!user) return;
    setCreating(true);
    const { data, error } = await supabase.from("chat_threads").insert({ user_id: user.id, title: "New Chat" }).select("id").single();
    setCreating(false);
    if (error || !data) return toast.error(error?.message ?? "Failed");
    navigate({ to: "/chat/$threadId", params: { threadId: data.id } });
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI Counselor</h1>
          <p className="text-sm text-muted-foreground">Ask anything about KCET counseling, cutoffs, colleges and strategy.</p>
        </div>
        <Button onClick={newChat} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <MessageSquarePlus className="h-4 w-4 mr-2" />}
          New chat
        </Button>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface">
        {threads === null ? (
          <div className="p-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : threads.length === 0 ? (
          <div className="p-10 text-center">
            <MessageCircle className="mx-auto h-10 w-10 text-primary/60" />
            <p className="mt-3 font-medium">No conversations yet</p>
            <p className="text-sm text-muted-foreground">Start your first chat with the AI counselor.</p>
            <Button className="mt-4" onClick={newChat}>Start chatting</Button>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map(t => (
              <li key={t.id}>
                <Link to="/chat/$threadId" params={{ threadId: t.id }} className="flex items-center justify-between p-4 hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
