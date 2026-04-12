import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: string;
    positive: boolean;
  };
  icon: LucideIcon;
};

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="st-card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-secondary font-medium">
          {title}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(99,91,255,0.1)" }}
        >
          <Icon className="w-4 h-4" style={{ color: "#635bff" }} />
        </div>
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {(trend || subtitle) && (
        <div className="flex items-center gap-2 mt-1.5">
          {trend && (
            <span
              className="text-xs font-medium"
              style={{ color: trend.positive ? "#22c55e" : "#ef4444" }}
            >
              {trend.positive ? "+" : ""}
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
