import { useEffect, useRef } from "react";

/** Barra de progreso arriba y una moto que recorre la carretera de abajo según avanzas en la página. */
export function ScrollRider() {
  const barRef = useRef<HTMLDivElement>(null);
  const bikeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      if (bikeRef.current) bikeRef.current.style.transform = `translate3d(${p * (window.innerWidth - 120)}px, 0, 0)`;
      raf = 0;
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div
        aria-hidden
        ref={barRef}
        className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px] origin-left bg-gradient-to-r from-motor via-amber to-motor"
        style={{ transform: "scaleX(0)" }}
      />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-12">
        <div className="absolute inset-x-0 bottom-2 h-[3px] bg-[repeating-linear-gradient(90deg,rgba(148,163,184,.45)_0_18px,transparent_18px_34px)]" />
        <div ref={bikeRef} className="absolute bottom-1 left-0 w-[104px] will-change-transform">
          <svg viewBox="0 0 120 60" className="h-auto w-full overflow-visible">
            <circle className="fx-puff" cx="6" cy="30" r="5" fill="#e2e8f0" />
            <circle className="fx-puff" cx="6" cy="30" r="5" fill="#e2e8f0" style={{ animationDelay: "0.6s" }} />
            <path d="M30 38 L60 22 L92 22 L104 36" fill="none" stroke="#F0611A" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M58 22 Q66 12 82 14 L84 22 Z" fill="#F0611A" />
            <circle cx="98" cy="30" r="5" fill="#FDE68A" />
            {[24, 96].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="42" r="12" fill="#0b0f19" />
                <g className="fx-spin">
                  <circle cx={cx} cy="42" r="7" fill="none" stroke="#cbd5e1" strokeWidth="2" />
                  <line x1={cx - 7} y1="42" x2={cx + 7} y2="42" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1={cx} y1="35" x2={cx} y2="49" stroke="#94a3b8" strokeWidth="1.5" />
                </g>
              </g>
            ))}
          </svg>
        </div>
      </div>
    </>
  );
}
