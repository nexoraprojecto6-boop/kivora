import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  busy?: boolean;
}

export function Button({ variant = "primary", busy = false, disabled, className, children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={["button", `button--${variant}`, className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}
