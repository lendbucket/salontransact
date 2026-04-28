import type { HTMLAttributes, ReactNode } from "react";

const SHADOW_2 =
  "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: number | string;
  noPadding?: boolean;
}

export function Card({
  children,
  padding = 24,
  noPadding,
  className,
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8EAED",
        borderRadius: 12,
        boxShadow: SHADOW_2,
        padding: noPadding ? 0 : padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardSectionProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title?: ReactNode;
  icon?: ReactNode;
  children: ReactNode;
}

export function CardSection({
  title,
  icon,
  children,
  ...rest
}: CardSectionProps) {
  return (
    <Card {...rest}>
      {(title || icon) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}
        >
          {icon}
          {title && (
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#1A1313",
                letterSpacing: "-0.31px",
              }}
            >
              {title}
            </span>
          )}
        </div>
      )}
      {children}
    </Card>
  );
}
