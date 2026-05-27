import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Send, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { askCustomerHelp } from "@/lib/ai-customer.functions";

type Msg = { role: "user" | "ia"; text: string };

export function AtendimentoIaPanel({ token }: { token: string }) {
  const ask = useServerFn(askCustomerHelp);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "ia",
      text: "Olá! Posso te orientar sobre pagamento, renovação e comprovante. Como posso ajudar?",
    },
  ]);
  const [loading, setLoading] = useState(false);
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
      const r = await ask({ data: { token, question: q } });
      setMsgs((m) => [...m, { role: "ia", text: r.answer }]);
    } catch {
      setMsgs((m) => [
        ...m,
        {
          role: "ia",
          text: "Estou com instabilidade agora. Por favor, fale com o suporte da sua revenda.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 py-4">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-primary-soft/40 px-3 py-2 text-xs text-primary">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>Atendimento por IA da sua revenda</span>
      </div>

      <div className="flex min-h-[70vh] flex-col gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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
                <Loader2 className="h-3 w-3 animate-spin" /> pensando…
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
          <Button size="sm" onClick={send} disabled={loading || !input.trim()} className="gap-1 self-end">
            <Send className="h-3.5 w-3.5" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
