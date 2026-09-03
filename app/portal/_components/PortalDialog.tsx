"use client";

import { useEffect, useRef, type ReactNode } from "react";

type PortalDialogProps = {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  dismissOnBackdrop?: boolean;
  className?: string;
};

const focusable = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function PortalDialog({ open, onClose, eyebrow, title, description, children, footer, dismissOnBackdrop = true, className = "" }: PortalDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const dialog = dialogRef.current;
    window.requestAnimationFrame(() => { const first = dialog?.querySelector<HTMLElement>(focusable); (first ?? dialog)?.focus(); });

    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== "Tab" || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(focusable)).filter((item) => !item.hasAttribute("disabled"));
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      window.requestAnimationFrame(() => previousFocus.current?.focus());
    };
  }, [open]);

  if (!open) return null;
  return <div className="portal-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (dismissOnBackdrop && event.currentTarget === event.target) onClose(); }}><section ref={dialogRef} className={`portal-dialog ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby="portal-dialog-title" tabIndex={-1}><header><div>{eyebrow ? <span>{eyebrow}</span> : null}<h2 id="portal-dialog-title">{title}</h2>{description ? <p>{description}</p> : null}</div><button type="button" onClick={onClose} aria-label="Close dialog">×</button></header><div className="portal-dialog__body">{children}</div>{footer ? <footer>{footer}</footer> : null}</section></div>;
}
