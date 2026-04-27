"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ChartData = { date: string; amount: number };

function formatMoney(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E8EAED",
        boxShadow:
          "0 0 0 1px rgba(0,0,0,0.25), 0 4px 8px rgba(0,0,0,0.2)",
      }}
    >
      <p className="text-muted mb-1">{label}</p>
      <p className="text-foreground font-medium">
        ${payload[0].value.toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
}

export function DashboardCharts({ chartData }: { chartData: ChartData[] }) {
  return (
    <div className="st-card p-6">
      <h2 className="text-base font-semibold text-foreground mb-1">
        Revenue
      </h2>
      <p className="text-xs text-muted mb-6">30-day transaction volume</p>
      <div className="h-64 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#017ea7" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#017ea7" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#E8EAED"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#878787" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#878787" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatMoney}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#017ea7"
              strokeWidth={2}
              fill="url(#areaGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
