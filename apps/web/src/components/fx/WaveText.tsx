/**
 * Texto que entra letra por letra y ondula suavemente.
 * Cada palabra va en su propio bloque sin saltos, así nunca se corta una palabra a la mitad.
 * Un lector de pantalla lo lee como una sola frase.
 */
export function WaveText({ text, className = "" }: { text: string; className?: string }) {
  let index = 0;
  const words = text.split(" ");
  return (
    <span aria-label={text} className={className}>
      {words.map((word, w) => (
        <span key={w} aria-hidden className="inline-block whitespace-nowrap">
          {Array.from(word).map((ch) => {
            const i = index++;
            return (
              <span key={i} className="wave-ch" style={{ ["--i" as string]: i }}>
                {ch}
              </span>
            );
          })}
          {w < words.length - 1 && <span>&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}
