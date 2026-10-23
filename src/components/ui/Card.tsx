import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border-[3px] border-ink bg-white p-5 shadow-[6px_6px_0_0_var(--color-ink)] sm:p-7",
        className,
      )}
      {...props}
    />
  );
}
