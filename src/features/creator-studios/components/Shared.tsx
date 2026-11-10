import type { ReactNode, ButtonHTMLAttributes } from "react";

export function Brand() {
  return (
    <span className="brand" aria-label="VELORI">
      <span className="brand-mark" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      VELORI<span className="brand-period">.</span>
    </span>
  );
}

export function Button({
  children,
  variant = "outline",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "primary" | "outline" | "soft" | "quiet" | "dark";
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
