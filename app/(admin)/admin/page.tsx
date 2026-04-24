import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { Store, CheckCircle, Mail, DollarSign } from "lucide-react";
import { format } from "date-fns";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<
    string,
    { bg: string; text: string; border: string }
  > = {
    active: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
    pending: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
    restricted: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
    suspended: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
    incomplete: { bg: "#F9FAFB", text: "#374151", border: "#D1D5DB" },
    pending_review: { bg: "#FFFBEB", text: "#92400E", border: "#FDE68A" },
  };
  const c = colors[status] ?? colors.incomplete;
  return (
    <span
      className="badge"
      style={{
        background: c.bg,
        color: c.text,
        borderColor: c.border,
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [
    totalMerchants,
    activeMerchants,
    pendingInvites,
    volumeAgg,
    recentMerchants,
  ] = await Promise.all([
    prisma.merchant.count(),
    prisma.merchant.count({ where: { status: "active" } }),
    prisma.invite.count({
      where: { used: false, expiresAt: { gt: new Date() } },
    }),
    prisma.merchant.aggregate({ _sum: { totalVolume: true } }),
    prisma.merchant.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
  ]);

  const totalVolume = volumeAgg._sum.totalVolume ?? 0;

  const stats = [
    {
      label: "Total Merchants",
      value: totalMerchants.toString(),
      icon: Store,
      iconBg: "#E6F4F8",
      iconColor: "#017ea7",
    },
    {
      label: "Active Merchants",
      value: activeMerchants.toString(),
      icon: CheckCircle,
      iconBg: "#F0FDF4",
      iconColor: "#166534",
    },
    {
      label: "Pending Invites",
      value: pendingInvites.toString(),
      icon: Mail,
      iconBg: "#FFFBEB",
      iconColor: "#92400E",
    },
    {
      label: "Total Volume",
      value: formatCurrency(totalVolume),
      icon: DollarSign,
      iconBg: "#E6F4F8",
      iconColor: "#017ea7",
    },
  ];

  return (
    <div className="page-container">
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 32,
        }}
      >
        <h2 style={{ color: "#1A1313" }}>Admin Overview</h2>
        <span style={{ fontSize: 13, color: "#878787" }}>
          {format(new Date(), "MMMM d, yyyy")}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  className="stat-card-icon"
                  style={{ background: stat.iconBg }}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.5}
                    style={{ color: stat.iconColor }}
                  />
                </div>
                <span className="stat-card-label">{stat.label}</span>
              </div>
              <p className="stat-card-value">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Recent merchants */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="section-header" style={{ padding: "16px 20px" }}>
          <span className="section-title">Recent Merchants</span>
          <a
            href="/admin/merchants"
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "#017ea7",
              textDecoration: "none",
            }}
          >
            View all
          </a>
        </div>

        {recentMerchants.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "64px 24px",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#E6F4F8",
                marginBottom: 16,
              }}
            >
              <Mail size={20} strokeWidth={1.5} style={{ color: "#017ea7" }} />
            </div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#1A1313",
                marginBottom: 4,
              }}
            >
              No merchants yet
            </p>
            <a
              href="/admin/invites"
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#017ea7",
                textDecoration: "none",
              }}
            >
              Send your first invite
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    "Business Name",
                    "Email",
                    "Status",
                    "Stripe Status",
                    "Volume",
                    "Joined",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentMerchants.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontWeight: 500 }}>{m.businessName}</td>
                    <td style={{ color: "#4A4A4A" }}>{m.user.email}</td>
                    <td>
                      <StatusBadge status={m.status} />
                    </td>
                    <td>
                      <StatusBadge status={m.stripeAccountStatus} />
                    </td>
                    <td
                      style={{ fontFamily: "monospace", fontWeight: 500 }}
                    >
                      {formatCurrency(m.totalVolume)}
                    </td>
                    <td style={{ color: "#878787", fontSize: 13 }}>
                      {format(m.createdAt, "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
