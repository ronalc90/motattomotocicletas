import { useEffect, useRef } from "react";

const COLORS = ["#F0611A", "#F5A524", "#FFFFFF", "#FDE68A"];
const REPEL_RADIUS = 150;

type Particle = { x: number; y: number; vx: number; vy: number; bx: number; by: number; r: number; c: string };

/**
 * Campo de partículas que se conectan entre sí y huyen del cursor.
 * Se monta dentro de un contenedor `relative` y ocupa todo su tamaño.
 * Con prefers-reduced-motion dibuja un solo fotograma estático.
 */
export function ParticleField({ linkDist = 120, className = "" }: { linkDist?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !canvas.parentElement) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const parent = canvas.parentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let parts: Particle[] = [];
    const mouse = { x: -9999, y: -9999, active: false };
    let raf = 0;

    function build() {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(30, Math.min(110, Math.floor((w * h) / 12000)));
      parts = Array.from({ length: n }, () => {
        const x = Math.random() * w;
        const y = Math.random() * h;
        return { x, y, vx: 0, vy: 0, bx: x, by: y, r: Math.random() * 1.8 + 0.6, c: COLORS[Math.floor(Math.random() * COLORS.length)] };
      });
    }

    function draw() {
      ctx!.clearRect(0, 0, w, h);
      // Links between nearby particles
      ctx!.lineWidth = 1;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < linkDist * linkDist) {
            ctx!.strokeStyle = `rgba(240,97,26,${(1 - Math.sqrt(d2) / linkDist) * 0.28})`;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }
      for (const p of parts) {
        ctx!.globalAlpha = 0.85;
        ctx!.fillStyle = p.c;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
    }

    function step() {
      for (const p of parts) {
        // Spring back toward home position
        p.vx += (p.bx - p.x) * 0.012;
        p.vy += (p.by - p.y) * 0.012;
        // Repel from the cursor
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < REPEL_RADIUS * REPEL_RADIUS) {
            const d = Math.sqrt(d2) || 1;
            const f = ((REPEL_RADIUS - d) / REPEL_RADIUS) * 0.9;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }
        p.vx *= 0.9;
        p.vy *= 0.9;
        p.x += p.vx;
        p.y += p.vy;
      }
    }

    function loop() {
      step();
      draw();
      raf = requestAnimationFrame(loop);
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
      mouse.active = mouse.x >= 0 && mouse.y >= 0 && mouse.x <= w && mouse.y <= h;
    };
    const onLeave = () => { mouse.active = false; };

    build();
    if (reduce) {
      draw();
    } else {
      loop();
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }
    const ro = new ResizeObserver(() => {
      build();
      if (reduce) draw();
    });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [linkDist]);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`} />;
}
