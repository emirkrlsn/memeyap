import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "success" | "danger" | "ghost";
type Size = "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary: "bg-grape text-white shadow-[0_5px_0_0_var(--color-grape-dark)]",
  secondary: "bg-sun text-ink shadow-[0_5px_0_0_var(--color-sun-dark)]",
  success: "bg-mint text-white shadow-[0_5px_0_0_var(--color-mint-dark)]",
  danger: "bg-coral text-white shadow-[0_5px_0_0_var(--color-coral-dark)]",
  ghost: "bg-white/70 text-ink shadow-[0_5px_0_0_rgb(36_22_58/0.15)]",
};

const sizeClasses: Record<Size, string> = {
  md: "min-h-11 px-5 text-base",
  lg: "min-h-14 px-7 text-lg",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-extrabold tracking-wide",
        "transition-[transform,box-shadow,filter] duration-100 select-none",
        "hover:brightness-105 active:translate-y-[5px] active:shadow-none",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
