import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Mic, MicOff, Send, Trash2, Volume2, VolumeX } from "lucide-react";
import { formatMoney, type AssistantProposal, type ItemType } from "@motatto/shared";
import { api, errorMessage } from "@/lib/api";
import { speak, useSpeech } from "@/hooks/useSpeech";
import { Badge, Button, MoneyInput } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ProposedItem { type: ItemType; productId?: string; serviceId?: string; description: string; qty: number; unitPrice: number; confidence: number; matchedName?: string }

interface Props {
  context?: { customerId?: string; vehicleId?: string };
  /** Called when user wants to use the items (import into order / create order) */
  onUseItems?: (items: ProposedItem[], proposal: AssistantProposal) => void;
  useLabel?: string;
  compact?: boolean;
}

interface Turn { role: "user" | "assistant"; text: string; proposal?: AssistantProposal }

export function AssistantPanel({ context, onUseItems, useLabel = "Crear orden con esto", compact }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [items, setItems] = useState<ProposedItem[]>([]);
  const [last, setLast] = useState<AssistantProposal | null>(null);
  const [readAloud, setReadAloud] = useState(() => { try { return localStorage.getItem("motatto.readAloud") === "1"; } catch { return false; } });
  const endRef = useRef<HTMLDivElement>(null);

  const send = useMutation({
    mutationFn: (t: string) => api.post<AssistantProposal>("/assistant", { text: t, context }),
    onSuccess: (p, t) => {
      setTurns((x) => [...x, { role: "user", text: t }, { role: "assistant", text: p.answer, proposal: p }]);
      setLast(p);
      if (p.items.length) setItems(p.items.map((i) => ({ ...i })));
      if (readAloud) speak(p.answer);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const speech = useSpeech({ onFinal: (t) => { setText(""); send.mutate(t); } });
  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [turns.length, send.isPending]);
  useEffect(() => { try { localStorage.setItem("motatto.readAloud", readAloud ? "1" : "0"); } catch { /* ignore */ } }, [readAloud]);

  const total = items.reduce((a, i) => a + i.qty * i.unitPrice, 0);

  return (
    <div className={cn("flex flex-col", compact ? "h-full" : "min-h-[70dvh]")}>
      {!speech.supported && (
        <div className="mb-3 rounded-xl bg-amber-soft text-amber-900 dark:bg-amber/20 dark:text-amber-100 p-3 text-sm flex gap-2"><AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>Tu navegador no tiene dictado por voz. Usa Chrome en Android o en el computador, o escribe abajo.</span></div>
      )}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {turns.length === 0 && (
          <div className="rounded-card bg-slate-50 dark:bg-slate-800 p-4 text-sm space-y-2">
            <p className="font-medium">Prueba a decir:</p>
            <ul className="muted space-y-1 list-disc pl-4">
              <li>“Moto de Ronal, la Gixxer: kit de arrastre, cambio de kit y purga de frenos”</li>
              <li>“¿Cuánto vale la bujía de NS 200?”</li>
              <li>“¿Qué le hicimos a la placa ABC123?”</li>
            </ul>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={cn("max-w-[90%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line", t.role === "user" ? "ml-auto bg-ink text-white rounded-br-md" : "card rounded-bl-md")}>
            {t.text}
            {t.proposal && (t.proposal.customer || t.proposal.vehicle) && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.proposal.customer && <Badge tone={t.proposal.customer.id ? "ok" : "amber"}>Cliente: {t.proposal.customer.name}{!t.proposal.customer.id && " (nuevo)"}</Badge>}
                {t.proposal.vehicle && <Badge tone={t.proposal.vehicle.id ? "ok" : "amber"}>{[t.proposal.vehicle.brand, t.proposal.vehicle.model, t.proposal.vehicle.plate].filter(Boolean).join(" ")}</Badge>}
              </div>
            )}
            {t.proposal && t.proposal.unrecognized.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">{t.proposal.unrecognized.map((u) => <Badge key={u} tone="bad">No entendí: {u}</Badge>)}</div>
            )}
          </div>
        ))}
        {send.isPending && <div className="card rounded-2xl rounded-bl-md px-4 py-2.5 text-sm muted max-w-[60%]">Pensando…</div>}
        {speech.interim && <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-ink/60 text-white px-4 py-2.5 text-[15px] italic">{speech.interim}</div>}
        {items.length > 0 && (
          <div className="card p-3">
            <div className="flex items-center justify-between mb-2"><span className="font-semibold text-sm">Líneas propuestas</span><button className="text-xs muted hover:text-bad" onClick={() => setItems([])}>Limpiar</button></div>
            <ul className="divide-y line">
              {items.map((it, i) => (
                <li key={i} className="py-2 flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <input className="field flex-1 h-10 py-1" value={it.description} onChange={(e) => setItems((a) => a.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
                    <button className="tap flex items-center justify-center rounded-btn text-bad hover:bg-bad-soft" onClick={() => setItems((a) => a.filter((_, j) => j !== i))} aria-label="Quitar"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge tone={it.type === "repuesto" ? "blue" : it.type === "servicio" ? "violet" : "neutral"}>{it.type}</Badge>
                    <ConfidenceBadge c={it.confidence} />
                    {it.matchedName && <span className="text-xs muted truncate">≈ {it.matchedName}</span>}
                    <div className="ml-auto flex items-center gap-1.5">
                      <input type="number" min={1} className="field h-9 w-16 py-1 text-center" value={it.qty} onChange={(e) => setItems((a) => a.map((x, j) => (j === i ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} />
                      <div className="w-32"><MoneyInput value={it.unitPrice} onChange={(n) => setItems((a) => a.map((x, j) => (j === i ? { ...x, unitPrice: n } : x)))} className="h-9 py-1" /></div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between"><span className="muted text-sm">Total</span><span className="font-display font-bold tabular-nums">$ {formatMoney(total)}</span></div>
            {onUseItems && last && <Button full className="mt-3" onClick={() => onUseItems(items, last)}>{useLabel}</Button>}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="sticky bottom-0 pt-2 bg-[var(--bg)]">
        {speech.error && <p className="text-xs text-bad mb-1">{speech.error}</p>}
        <div className="flex items-end gap-2">
          <form className="flex-1 flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = text.trim(); if (t) { setText(""); send.mutate(t); } }}>
            <input className="field" placeholder="Escribe o usa el micrófono" value={text} onChange={(e) => setText(e.target.value)} />
            <Button type="submit" size="icon" variant="dark" aria-label="Enviar" disabled={!text.trim() || send.isPending}><Send className="h-5 w-5" /></Button>
          </form>
          {speech.supported && (
            <button type="button" onClick={speech.listening ? speech.stop : speech.start} aria-pressed={speech.listening} aria-label={speech.listening ? "Detener" : "Hablar"}
              className={cn("h-14 w-14 shrink-0 rounded-full flex items-center justify-center text-white shadow-float transition-transform", speech.listening ? "bg-bad scale-110 animate-pulse" : "bg-motor active:scale-95")}>
              {speech.listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs muted">
          <span>{speech.listening ? "Escuchando… toca para terminar" : speech.supported ? "Toca el micrófono y habla" : ""}</span>
          <button type="button" onClick={() => setReadAloud((v) => !v)} className="inline-flex items-center gap-1 hover:text-motor">{readAloud ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} Leer en voz alta</button>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ c }: { c: number }) {
  const pct = Math.round(c * 100);
  return <Badge tone={c >= 0.8 ? "ok" : c >= 0.5 ? "amber" : "bad"}>{pct}%</Badge>;
}
