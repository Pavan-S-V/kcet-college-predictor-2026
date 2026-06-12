import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Loader2,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  head: () => ({ meta: [{ title: "Chat — KCET Counselor" }] }),
  component: ChatThread,
});

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}
interface SpeechRecog {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start(): void;
  stop(): void;
}

function ChatThread() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const recogRef = useRef<unknown>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase
      .from("chat_messages")
      .select("id,role,content")
      .eq("thread_id", threadId)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setMessages((data ?? []) as Msg[]);
      });
  }, [threadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    taRef.current?.focus();
  }, [threadId, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setMessages((m) => [...m, { id: "u-" + Date.now(), role: "user", content: text }]);
    setInput("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({ threadId, message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMessages((m) => [...m, { id: "a-" + Date.now(), role: "assistant", content: data.reply }]);
      if (voiceOn && typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(data.reply);
        window.speechSynthesis.speak(u);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setSending(false);
    }
  }

  function toggleMic() {
    if (typeof window === "undefined") return;
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecog;
      webkitSpeechRecognition?: new () => SpeechRecog;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) return toast.error("Voice recognition not supported in this browser");
    if (listening && recogRef.current) {
      (recogRef.current as SpeechRecog).stop();
      return;
    }
    const r = new SR();
    r.lang = "en-IN";
    r.continuous = false;
    r.interimResults = false;
    r.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      setInput((prev) => (prev ? prev + " " : "") + e.results[0][0].transcript);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    r.start();
    recogRef.current = r;
    setListening(true);
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-3xl flex-col px-4 py-4 sm:px-6">
      <div className="mb-3 flex items-center gap-2">
        <Link to="/chat">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Threads
          </Button>
        </Link>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => setVoiceOn((v) => !v)}>
            {voiceOn ? <Volume2 className="h-4 w-4 mr-1" /> : <VolumeX className="h-4 w-4 mr-1" />}
            Voice {voiceOn ? "on" : "off"}
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border bg-surface p-4"
      >
        {messages.length === 0 && !sending && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-lg font-semibold">Ask your KCET counselor</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                e.g. "What documents do I need for round 1?"
              </p>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                Thinking<span className="animate-pulse">...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-border bg-surface p-2">
        <div className="flex items-end gap-2">
          <Textarea
            ref={taRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about colleges, branches, cutoffs..."
            rows={2}
            className="min-h-0 resize-none border-0 focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            variant={listening ? "default" : "outline"}
            onClick={toggleMic}
            title={listening ? "Stop listening" : "Voice input"}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="button" size="icon" onClick={send} disabled={sending || !input.trim()}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
