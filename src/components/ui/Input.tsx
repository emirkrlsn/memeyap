"use client";

import { useId, type InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  /** Doluysa alanın altında hata olarak gösterilir. */
  error?: string;
  hint?: string;
};

export function Input({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-extrabold text-ink">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(
          "min-h-12 rounded-2xl border-[3px] bg-white px-4 text-lg font-bold text-ink",
          "placeholder:font-semibold placeholder:text-ink-soft/60",
          "transition-colors outline-none focus:border-grape",
          error ? "border-coral" : "border-ink/15",
          className,
        )}
        {...props}
      />
      {message && (
        <p
          id={messageId}
          className={cn(
            "text-sm font-bold",
            error ? "text-coral-dark" : "text-ink-soft",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
