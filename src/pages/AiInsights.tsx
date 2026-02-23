import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, User, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Which project took the most time?",
  "Compare hours across authoring tools",
  "What's the average time per course type?",
  "Summarize my project data",
];

export default function AiInsights() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/chat`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          message: text.trim(),
          history: newMessages.slice(-10),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                if (text) {
                  assistantContent += text;
                  setMessages((prev) => {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: "assistant", content: assistantContent };
                    return updated;
                  });
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
      }

      if (!assistantContent) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "No response received. Please try again." };
          return updated;
        });
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev.filter((m) => m.content !== ""),
        { role: "assistant", content: `Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">AI Insights</h1>
        <p className="text-muted-foreground">Ask questions about your project data powered by Google Gemini</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Sparkles className="h-12 w-12 mb-4 text-accent" />
              <p className="text-lg font-medium mb-4">Ask me anything about your data</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {SUGGESTIONS.map((s) => (
                  <Button key={s} variant="outline" size="sm" onClick={() => sendMessage(s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
              {msg.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="h-4 w-4 text-accent" />
                </div>
              )}
              <div
                className={`rounded-lg px-4 py-2 max-w-[80%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content || "Thinking…"}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
              </div>
              {msg.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-4 w-4 text-primary" />
                </div>
              )}
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-accent" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <p className="text-sm text-muted-foreground animate-pulse">Thinking…</p>
              </div>
            </div>
          )}
        </div>

        <CardContent className="border-t p-4">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <Input
              placeholder="Ask about your project data…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
