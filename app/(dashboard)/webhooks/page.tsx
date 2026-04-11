import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Webhook } from "lucide-react";

export default async function WebhooksPage() {
  const { merchant } = await requireMerchant();

  const hooks = await prisma.webhook.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">Webhooks</h1>
      <p className="text-sm text-muted mb-8">
        Receive event notifications at your endpoints
      </p>

      <div className="card p-6">
        {hooks.length === 0 ? (
          <div className="py-12 text-center">
            <Webhook
              className="w-8 h-8 mx-auto mb-3"
              style={{ color: "#606E74" }}
            />
            <p className="text-sm text-muted">No webhook endpoints yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hooks.map((h) => (
              <div
                key={h.id}
                className="flex items-center justify-between border rounded-lg px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {h.url}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {h.events.length} events · created{" "}
                    {format(h.createdAt, "MMM d, yyyy")}
                  </p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{
                    color: h.active ? "#22c55e" : "#8b949e",
                    background: h.active
                      ? "rgba(34,197,94,0.1)"
                      : "rgba(139,148,158,0.1)",
                  }}
                >
                  {h.active ? "active" : "disabled"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
