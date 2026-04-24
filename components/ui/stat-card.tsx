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
  iconBg?: string;
  iconColor?: string;
};

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  iconBg = "#E6F4F8",
  iconColor = "#017ea7",
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div className="stat-card-icon" style={{ background: iconBg }}>
          <Icon size={18} strokeWidth={1.5} style={{ color: iconColor }} />
        </div>
        <span className="stat-card-label">{title}</span>
      </div>
      <p className="stat-card-value">{value}</p>
      {(trend || subtitle) && (
        <div className="flex items-center gap-2">
          {trend && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: trend.positive ? "#166534" : "#991B1B",
              }}
            >
              {trend.positive ? "+" : ""}
              {trend.value}
            </span>
          )}
          {subtitle && (
            <span style={{ fontSize: 12, color: "#878787" }}>{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}
