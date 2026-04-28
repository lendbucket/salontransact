"use client";

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorText?: string;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    helperText,
    errorText,
    leadingIcon,
    trailingIcon,
    className,
    containerClassName,
    style,
    id: idProp,
    type = "text",
    ...rest
  },
  ref
) {
  const reactId = useId();
  const inputId = idProp ?? `input-${reactId}`;
  const hasError = Boolean(errorText);

  return (
    <div className={containerClassName}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            display: "block",
            fontSize: 13,
            fontWeight: 500,
            color: "#1A1313",
            marginBottom: 6,
            letterSpacing: "-0.31px",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        {leadingIcon && (
          <span
            style={{
              position: "absolute",
              left: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#878787",
              pointerEvents: "none",
              display: "flex",
              alignItems: "center",
            }}
          >
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type={type}
          aria-invalid={hasError || undefined}
          aria-describedby={
            errorText
              ? `${inputId}-error`
              : helperText
                ? `${inputId}-helper`
                : undefined
          }
          className={`st-input ${className ?? ""}`.trim()}
          style={{
            width: "100%",
            height: 40,
            paddingLeft: leadingIcon ? 36 : 12,
            paddingRight: trailingIcon ? 36 : 12,
            background: "#F4F5F7",
            border: `1px solid ${hasError ? "#FCA5A5" : "#E8EAED"}`,
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 400,
            color: "#1A1313",
            outline: "none",
            transition: "all 150ms ease",
            ...style,
          }}
          {...rest}
        />
        {trailingIcon && (
          <span
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#878787",
              display: "flex",
              alignItems: "center",
            }}
          >
            {trailingIcon}
          </span>
        )}
      </div>
      {errorText ? (
        <p
          id={`${inputId}-error`}
          style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}
          aria-live="polite"
        >
          {errorText}
        </p>
      ) : helperText ? (
        <p
          id={`${inputId}-helper`}
          style={{ fontSize: 12, color: "#878787", marginTop: 4 }}
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
