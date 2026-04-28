"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "primary-cta"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    height: 36,
    padding: "0 16px",
    fontSize: 14,
    background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
    border: "1px solid #015f80",
    color: "#FFFFFF",
    borderRadius: 8,
    boxShadow:
      "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  "primary-cta": {
    height: 52,
    padding: "0 24px",
    fontSize: 16,
    background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
    border: "1px solid #015f80",
    color: "#FFFFFF",
    borderRadius: 10,
    boxShadow:
      "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  secondary: {
    height: 36,
    padding: "0 16px",
    fontSize: 14,
    background: "#FFFFFF",
    border: "1px solid #D1D5DB",
    color: "#1A1313",
    borderRadius: 8,
  },
  ghost: {
    height: 36,
    padding: "0 12px",
    fontSize: 14,
    background: "transparent",
    border: "1px solid transparent",
    color: "#4A4A4A",
    borderRadius: 8,
  },
  danger: {
    height: 36,
    padding: "0 16px",
    fontSize: 14,
    background: "#FFFFFF",
    border: "1px solid #FCA5A5",
    color: "#DC2626",
    borderRadius: 8,
  },
  icon: {
    width: 32,
    height: 32,
    padding: 0,
    fontSize: 14,
    background: "transparent",
    border: "1px solid transparent",
    color: "#878787",
    borderRadius: 6,
  },
};

const hoverClass: Record<ButtonVariant, string> = {
  primary: "btn-primary-hover",
  "primary-cta": "btn-primary-hover",
  secondary: "btn-secondary-hover",
  ghost: "btn-ghost-hover",
  danger: "btn-danger-hover",
  icon: "btn-icon-hover",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      loading = false,
      disabled,
      leadingIcon,
      trailingIcon,
      children,
      className,
      style,
      type,
      ...rest
    },
    ref
  ) {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`${hoverClass[variant]} ${className ?? ""}`.trim()}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          fontWeight: 500,
          cursor: isDisabled ? "not-allowed" : "pointer",
          transition: "all 150ms ease",
          outline: "none",
          whiteSpace: "nowrap",
          opacity: isDisabled ? 0.55 : 1,
          ...variantStyles[variant],
          ...style,
        }}
        {...rest}
      >
        {loading ? (
          <Loader2
            size={variant === "primary-cta" ? 18 : 14}
            className="animate-spin"
          />
        ) : leadingIcon ? (
          leadingIcon
        ) : null}
        {variant !== "icon" && children}
        {!loading && trailingIcon}
        {variant === "icon" && children}
      </button>
    );
  }
);
