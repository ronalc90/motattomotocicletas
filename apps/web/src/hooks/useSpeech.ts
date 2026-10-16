import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all targets). */
interface SRResultAlt { transcript: string }
interface SRResult { isFinal: boolean; 0: SRResultAlt; length: number }
interface SREvent extends Event { resultIndex: number; results: ArrayLike<SRResult> }
interface SRErrorEvent extends Event { error: string }
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SRCtor = new () => SpeechRecognitionLike;

function getCtor(): SRCtor | null {
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeech(opts: { lang?: string; onFinal?: (text: string) => void } = {}) {
  const { lang = "es-CO", onFinal } = opts;
  const supported = typeof window !== "undefined" && getCtor() !== null;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    finalRef.current = "";
    setInterim("");
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim(finalRef.current + interimText);
    };
    rec.onerror = (e) => {
      const map: Record<string, string> = {
        "not-allowed": "Permite el acceso al micrófono en el navegador.",
        "no-speech": "No se escuchó nada. Intenta de nuevo.",
        network: "El dictado necesita conexión a internet.",
        "audio-capture": "No se encontró micrófono.",
      };
      setError(map[e.error] ?? `Error de dictado: ${e.error}`);
    };
    rec.onend = () => {
      setListening(false);
      const text = finalRef.current.trim();
      if (text) onFinalRef.current?.(text);
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setError("No se pudo iniciar el micrófono");
    }
  }, [lang]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}

export function speak(text: string, lang = "es-CO") {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  const voices = window.speechSynthesis.getVoices();
  const v = voices.find((x) => x.lang.toLowerCase().startsWith("es-co")) ?? voices.find((x) => x.lang.toLowerCase().startsWith("es"));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}
