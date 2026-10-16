import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldWrapProps {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
  required?: boolean;
}
export function Field({ label, hint, error, className, children, required }: FieldWrapProps) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-sm font-medium">
          {label}
          {required && <span className="text-motor"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint ? <span className="mt-1 block text-xs muted">{hint}</span> : null}
    </label>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClass?: string;
  prefix?: ReactNode;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, hint, error, wrapClass, prefix, className, ...rest }, ref) {
  const input = (
    <input ref={ref} className={cn("field", prefix ? "pl-9" : "", error && "border-bad", className)} aria-invalid={!!error} {...rest} />
  );
  return (
    <Field label={label} hint={hint} error={error} className={wrapClass} required={rest.required}>
      {prefix ? (
        <span className="relative block">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 muted">{prefix}</span>
          {input}
        </span>
      ) : (
        input
      )}
    </Field>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClass?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, hint, error, wrapClass, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapClass} required={rest.required}>
      <textarea ref={ref} className={cn("field min-h-[96px]", error && "border-bad", className)} {...rest} />
    </Field>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClass?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, hint, error, wrapClass, options, placeholder, className, ...rest }, ref) {
  return (
    <Field label={label} hint={hint} error={error} className={wrapClass} required={rest.required}>
      <select ref={ref} className={cn("field appearance-none bg-no-repeat pr-9", error && "border-bad", className)}
        style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")", backgroundPosition: "right 0.75rem center" }}
        {...rest}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
});

/** Integer COP input; shows thousands separators while typing. */
export interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  label?: string;
  hint?: string;
  error?: string;
  wrapClass?: string;
  value: number;
  onChange: (n: number) => void;
}
export function MoneyInput({ label, hint, error, wrapClass, value, onChange, className, ...rest }: MoneyInputProps) {
  const shown = value ? value.toLocaleString("es-CO") : "";
  return (
    <Field label={label} hint={hint} error={error} className={wrapClass} required={rest.required}>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm muted">$</span>
        <input
          inputMode="numeric"
          className={cn("field pl-7 text-right font-medium tabular-nums", error && "border-bad", className)}
          value={shown}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits ? Math.min(Number(digits), 999_999_999) : 0);
          }}
          placeholder="0"
          {...rest}
        />
      </span>
    </Field>
  );
}

export function Checkbox({ label, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }) {
  return (
    <label className={cn("flex items-start gap-3 cursor-pointer min-h-[44px] py-2", className)}>
      <input type="checkbox" className="mt-0.5 h-5 w-5 rounded border-slate-300 accent-motor" {...rest} />
      <span className="text-[15px] leading-6">{label}</span>
    </label>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-2 text-left min-h-[44px]">
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-xs muted">{hint}</span>}
      </span>
      <span className={cn("relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-motor" : "bg-slate-300 dark:bg-slate-600")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  );
}
