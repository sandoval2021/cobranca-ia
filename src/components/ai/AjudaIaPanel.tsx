import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Sparkles, Trash2, LifeBuoy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askDonoHelp } from "@/lib/ai-help.functions";
import { recordAiUsage, getAiUsageToday } from "@/lib/ai-usage";

type Msg = { role: "user" | "ia"; text: string };

export function AjudaIaPanel() {
  const ask = useServerFn(askDonoHelp);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ia",
      text: "Oi! Eu sou a Ajuda com IA do CobraEasy. Posso explicar como usar clientes, cobranças, importação, mensagens, backup e mais. O que você precisa?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(getAiUsageToday());
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  async function send() {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setLoading(true);
    try {
      const r = await ask({ data: { question: q } });
      setMsgs((m) => [...m, { role: "ia", text: r.answer }]);
      recordAiUsage({
        scope: "dono",
        model: r.model || "",
        tokens_in: r.usage?.prompt_tokens ?? 0,
        tokens_out: r.usage?.completion_tokens ?? 0,
        ok: r.ok,
      });
      setUsage(getAiUsageToday());
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "ia",
          text: "Estou com instabilidade agora. Tente de novo em instantes ou fale com o suporte humano.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMsgs([
      {
        role: "ia",
        text: "Conversa limpa. Pode me perguntar de novo quando quiser.",
      },
    ]);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-primary-soft/40 px-3 py-2 text-xs text-primary">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span className="leading-snug">
          Tire dúvidas sobre como usar o CobraEasy. Respostas curtas e em português.
        </span>
      </div>

      <div className="flex min-h-[55vh] flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-snug ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                pensando…
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escreva sua dúvida…"
            rows={2}
            className="resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={clearChat} className="gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Limpar
              </Button>
              <a
                href="/ajuda"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <LifeBuoy className="h-3.5 w-3.5" /> Suporte humano
              </a>
            </div>
            <Button size="sm" onClick={send} disabled={loading || !input.trim()} className="gap-1">
              <Send className="h-3.5 w-3.5" /> Enviar
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Hoje você usou {usage.count} {usage.count === 1 ? "pergunta" : "perguntas"}.
      </p>
    </div>
  );
}
