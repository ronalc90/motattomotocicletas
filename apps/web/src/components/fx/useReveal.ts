import { useEffect } from "react";

/**
 * Anima cada <section> de <main> al entrar en pantalla (fade + subida).
 * Observa también secciones nuevas que aparezcan al cambiar de página.
 */
export function useReveal(pathname: string) {
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const supportsIO = "IntersectionObserver" in window;
    const io = supportsIO
      ? new IntersectionObserver(
          (entries, observer) => {
            for (const en of entries) {
              if (en.isIntersecting) {
                en.target.classList.add("is-in");
                observer.unobserve(en.target);
              }
            }
          },
          { threshold: 0.12 },
        )
      : null;

    const scan = () => {
      main.querySelectorAll<HTMLElement>("section:not([data-rv])").forEach((el) => {
        el.setAttribute("data-rv", "");
        if (io) io.observe(el);
        else el.classList.add("is-in");
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(main, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io?.disconnect();
    };
  }, [pathname]);
}
