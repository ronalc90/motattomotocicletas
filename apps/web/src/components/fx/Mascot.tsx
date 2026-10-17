import { useEffect, useRef, useState } from "react";

/**
 * Motito: scooter-robot que mira al cursor, parpadea, hace caballito al hacer clic
 * y tiene un globo de texto. Es decorativo; el botón solo añade un gesto.
 */
export function Mascot({ message }: { message?: string }) {
  const rootRef = useRef<HTMLButtonElement>(null);
  const [wheelie, setWheelie] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: PointerEvent) => {
      const r = root.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = Math.max(-1, Math.min(1, (e.clientX - cx) / 160)) * 4;
      const dy = Math.max(-1, Math.min(1, (e.clientY - cy) / 160)) * 3;
      root.style.setProperty("--px", `${dx.toFixed(2)}px`);
      root.style.setProperty("--py", `${dy.toFixed(2)}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const doWheelie = () => {
    setWheelie(true);
    window.setTimeout(() => setWheelie(false), 1400);
  };

  return (
    <div className="inline-flex items-center gap-3">
      <button
        ref={rootRef}
        type="button"
        onClick={doWheelie}
        aria-label="Motito, la mascota de Motatto. Haz clic para hacer un caballito"
        className={`fx-mascot ${wheelie ? "wheelie" : ""} shrink-0 rounded-2xl focus-visible:outline-offset-4`}
      >
        <svg viewBox="0 0 220 180" className="h-28 w-auto overflow-visible" aria-hidden focusable="false">
          {/* Humo del escape */}
          {[0, 0.6, 1.2].map((d) => (
            <circle key={d} cx="34" cy="140" r="9" fill="#e2e8f0" className="fx-puff" style={{ animationDelay: `${d}s` }} />
          ))}
          <g className="m-body" style={{ transformBox: "view-box", transformOrigin: "62px 150px" }}>
            {/* Escape */}
            <rect x="30" y="126" width="30" height="10" rx="5" fill="#475569" />
            {/* Carrocería */}
            <path d="M40 110 Q40 84 70 84 L140 84 Q168 84 168 110 L166 132 Q164 140 150 140 L60 140 Q42 140 40 124 Z" fill="#F0611A" />
            <path d="M70 84 Q96 70 124 80 L120 90 L72 90 Z" fill="#0F172A" />
            {/* Cabeza y visor */}
            <circle cx="158" cy="70" r="34" fill="#F0611A" />
            <path d="M138 66 Q160 40 184 62 L178 80 Q158 88 138 80 Z" fill="#0F172A" />
            {/* Ojos: la pupila sigue el cursor */}
            <circle cx="156" cy="66" r="11" fill="#ffffff" />
            <circle cx="174" cy="66" r="11" fill="#ffffff" />
            <g style={{ transform: "translate(var(--px, 0px), var(--py, 0px))" }}>
              <circle cx="158" cy="67" r="5" fill="#0F172A" />
              <circle cx="176" cy="67" r="5" fill="#0F172A" />
            </g>
            <rect className="m-blink" x="142" y="54" width="48" height="26" fill="#0F172A" />
            <path d="M152 88 Q162 95 172 88" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
            {/* Antena con foco */}
            <line x1="168" y1="36" x2="178" y2="14" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
            <circle className="m-bulb" cx="179" cy="12" r="6" fill="#FDE68A" />
            {/* Ruedas */}
            {[62, 160].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="150" r="24" fill="#0b0f19" />
                <g className="fx-spin">
                  <circle cx={cx} cy="150" r="16" fill="none" stroke="#cbd5e1" strokeWidth="3" />
                  <line x1={cx - 16} y1="150" x2={cx + 16} y2="150" stroke="#94a3b8" strokeWidth="2.5" />
                  <line x1={cx} y1="134" x2={cx} y2="166" stroke="#94a3b8" strokeWidth="2.5" />
                  <circle cx={cx} cy="150" r="4" fill="#F5A524" />
                </g>
              </g>
            ))}
          </g>
        </svg>
      </button>
      {message && (
        <div className="fx-bubble relative rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-float dark:bg-ink-2 dark:text-slate-100">
          {message}
          <span aria-hidden className="absolute -left-1.5 bottom-3 h-3 w-3 rotate-45 bg-white dark:bg-ink-2" />
        </div>
      )}
    </div>
  );
}
