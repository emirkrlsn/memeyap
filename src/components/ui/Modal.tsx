"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { strings } from "@/lib/strings";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Yerel <dialog> üzerine kurulu modal: odak tuzağı ve Esc ile kapanma tarayıcıdan gelir. */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Arka plana tıklayınca kapat.
        if (event.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-3xl border-[3px] border-ink bg-white p-0 text-ink shadow-[8px_8px_0_0_var(--color-ink)] backdrop:bg-ink/50 open:animate-pop-in"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-2xl font-black">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={strings.common.close}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/10 text-xl font-black hover:bg-ink/20"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
