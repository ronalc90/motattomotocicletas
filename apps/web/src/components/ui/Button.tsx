import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  full?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-motor text-white hover:bg-motor-dark active:bg-motor-dark shadow-sm",
  secondary: "bg-slate-100 text-ink hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  ghost: "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800",
  danger: "bg-bad text-white hover:bg-red-800",
  dark: "bg-ink text-white hover:bg-ink-2 dark:bg-slate-100 dark:text-ink dark:hover:bg-white",
  outline: "border bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-[15px] gap-2",
  lg: "h-13 min-h-[52px] px-6 text-base gap-2.5",
  icon: "h-11 w-11 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, icon, full, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-btn font-semibold transition-colors select-none disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        variant === "outline" && "line",
        sizes[size],
        full && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
});
