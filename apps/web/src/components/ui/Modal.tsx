import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Drawer slides from the right on desktop, bottom sheet on mobile */
  drawer?: boolean;
}

export function Modal({ open, onClose, title, children, footer, size = "md", drawer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-3xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <button aria-label="Cerrar" className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative flex w-full flex-col card rounded-b-none sm:rounded-card max-h-[92dvh] shadow-float",
          drawer ? "sm:fixed sm:right-0 sm:top-0 sm:h-dvh sm:max-h-dvh sm:rounded-none sm:max-w-md" : widths[size],
        )}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2 sm:px-5">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar" className="-mr-2">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 sm:px-5">{children}</div>
        {footer && <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t line px-4 py-3 sm:px-5">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message, confirmText = "Confirmar", danger, loading,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message?: ReactNode; confirmText?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>{confirmText}</Button>
      </>}>
      {message && <div className="text-[15px] leading-6 muted">{message}</div>}
    </Modal>
  );
}
