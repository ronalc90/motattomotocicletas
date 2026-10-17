import { useEffect } from "react";

/**
 * Interacciones con el puntero dentro de <main>:
 * - .card se inclina en 3D y su brillo sigue al cursor.
 * - [data-magnet] se acerca levemente al cursor.
 * Se desactiva en pantallas táctiles y con reducir movimiento.
 */
export function useFxPointer(pathname: string) {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const card = target.closest<HTMLElement>(".card");
      if (card && main.contains(card)) {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        card.style.transform = `perspective(900px) rotateX(${((0.5 - y) * 8).toFixed(2)}deg) rotateY(${((x - 0.5) * 10).toFixed(2)}deg) translateY(-4px)`;
        card.style.setProperty("--gx", `${(x * 100).toFixed(1)}%`);
        card.style.setProperty("--gy", `${(y * 100).toFixed(1)}%`);
        card.style.setProperty("--ga", "1");
      }
      const magnet = target.closest<HTMLElement>("[data-magnet]");
      if (magnet && main.contains(magnet)) {
        const r = magnet.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) * 0.22;
        const dy = (e.clientY - (r.top + r.height / 2)) * 0.22;
        magnet.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      }
    };

    const onOut = (e: PointerEvent) => {
      const from = e.target as HTMLElement;
      const card = from.closest<HTMLElement>(".card");
      if (card && !card.contains(e.relatedTarget as Node | null)) {
        card.style.transform = "";
        card.style.setProperty("--ga", "0");
      }
      const magnet = from.closest<HTMLElement>("[data-magnet]");
      if (magnet && !magnet.contains(e.relatedTarget as Node | null)) magnet.style.transform = "";
    };

    main.addEventListener("pointermove", onMove);
    main.addEventListener("pointerout", onOut);
    return () => {
      main.removeEventListener("pointermove", onMove);
      main.removeEventListener("pointerout", onOut);
    };
  }, [pathname]);
}
