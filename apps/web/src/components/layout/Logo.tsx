import { cn } from "@/lib/utils";

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display font-extrabold text-xl tracking-tight", light ? "text-white" : "", className)}>
      <svg viewBox="0 0 512 512" className="h-8 w-8 shrink-0" aria-hidden>
        <rect width="512" height="512" rx="112" fill="#0F172A" />
        <path d="M120 372V140h58l78 132 78-132h58v232h-52V236l-84 138-84-138v136z" fill="#F0611A" />
        <circle cx="256" cy="402" r="18" fill="#F5A524" />
      </svg>
      Motatto
    </span>
  );
}
