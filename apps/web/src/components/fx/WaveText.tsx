/** Texto que entra letra por letra y ondula suavemente. Lo lee un lector de pantalla como una sola frase. */
export function WaveText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span aria-label={text} className={className}>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden className="wave-ch" style={{ ["--i" as string]: i }}>
          {ch === " " ? " " : ch}
        </span>
      ))}
    </span>
  );
}
