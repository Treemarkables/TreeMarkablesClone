import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, Mic, MicOff, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Simple markdown-to-JSX renderer for basic formatting
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <p key={i} className="font-semibold text-sm">{line.slice(4)}</p>;
        }
        if (line.startsWith("## ")) {
          return <p key={i} className="font-bold text-sm">{line.slice(3)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} className="flex gap-1.5 text-sm"><span className="mt-0.5 shrink-0">•</span><span>{renderInline(line.slice(2))}</span></p>;
        }
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.+)/);
          if (match) return <p key={i} className="flex gap-1.5 text-sm"><span className="shrink-0">{match[1]}.</span><span>{renderInline(match[2])}</span></p>;
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-sm">{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SESSION_KEY = "ai_assistant_session_id";

function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const SUGGESTIONS = [
  "What jobs are coming up this week?",
  "Which completed jobs haven't been invoiced?",
  "Show me pending quotes",
  "Any leads needing follow-up?",
];

export function AIAssistantChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [sessionId] = useState(getSessionId);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Listen for external open trigger (e.g. from header button)
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-ai-assistant', handler);
    return () => window.removeEventListener('open-ai-assistant', handler);
  }, []);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = messages.slice(-10);
      const res = await apiRequest("POST", "/api/assistant/chat", {
        message: trimmed,
        sessionId,
        history,
      });
      const data = await res.json();
      if (data.success && data.data?.reply) {
        setMessages(prev => [...prev, { role: "assistant", content: data.data.reply }]);
      } else {
        throw new Error(data.message || "No response");
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Sorry, I couldn't process that. Please try again.",
      }]);
      toast({ title: "Assistant error", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [messages, sessionId, loading, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        try {
          const res = await fetch("/api/transcribe", { method: "POST", body: formData });
          const data = await res.json();
          if (data.success && data.transcript) {
            setInput(data.transcript);
            textareaRef.current?.focus();
          } else {
            toast({ title: "Transcription failed", variant: "destructive" });
          }
        } catch {
          toast({ title: "Transcription failed", variant: "destructive" });
        }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch {
      toast({ title: "Microphone access denied", variant: "destructive" });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const clearHistory = async () => {
    try {
      await apiRequest("DELETE", `/api/assistant/history/${sessionId}`);
      setMessages([]);
    } catch {
      toast({ title: "Failed to clear history", variant: "destructive" });
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open AI assistant"
          className="fixed bottom-5 right-5 z-[9999] flex items-center gap-2 rounded-full bg-primary text-primary-foreground shadow-lg px-4 py-3 hover-elevate active-elevate-2 transition-transform"
        >
          <Bot className="h-5 w-5" />
          <span className="text-sm font-medium hidden sm:block">Ask AI</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-[9999] flex flex-col rounded-xl border border-border bg-background shadow-xl"
          style={{ width: "min(420px, calc(100vw - 2.5rem))", height: "min(580px, calc(100dvh - 5rem))" }}>

          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border rounded-t-xl bg-primary text-primary-foreground">
            <Bot className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Treemarkables Assistant</p>
              <p className="text-xs opacity-75 leading-tight">Ask about jobs, quotes, leads &amp; more</p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
              onClick={clearHistory}
              title="Clear conversation"
              aria-label="Clear conversation"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-primary-foreground hover:bg-primary/80"
              onClick={() => setOpen(false)}
              aria-label="Minimize chat"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-2">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2 py-4">
                <p className="text-xs text-muted-foreground text-center mb-2">Try asking:</p>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left text-sm rounded-lg border border-border px-3 py-2 hover-elevate active-elevate-2 text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-3 pb-2">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && (
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 mt-1">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </span>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <SimpleMarkdown text={msg.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-2 mt-1">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="px-3 py-3 border-t border-border">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about your business..."
                className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm"
                disabled={loading}
                rows={1}
              />
              <Button
                size="icon"
                variant={recording ? "destructive" : "ghost"}
                onClick={recording ? stopRecording : startRecording}
                disabled={loading}
                title={recording ? "Stop recording" : "Voice input"}
                aria-label={recording ? "Stop recording" : "Voice input"}
                className="shrink-0"
              >
                {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                title="Send"
                aria-label="Send message"
                className="shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-center">
              Enter to send &bull; Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
