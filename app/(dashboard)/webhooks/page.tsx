import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { Webhook as WebhookIcon, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function WebhooksPage() {
  const { merchant } = await requireMerchant();

  const hooks = await prisma.webhook.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            Webhooks
          </h1>
          <p className="text-sm text-secondary">
            Receive event notifications at your endpoints
          </p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Endpoint
        </button>
      </div>

      <div className="st-card p-6">
        {hooks.length === 0 ? (
          <div className="py-12 text-center">
            <WebhookIcon className="w-8 h-8 mx-auto mb-3 text-muted" />
            <p className="text-sm text-muted">
              No webhook endpoints yet. Add one to receive event notifications.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th className="pb-3 font-medium">URL</th>
                  <th className="pb-3 font-medium">Events</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Created</th>
                  <th className="pb-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {hooks.map(
                  (h: {
                    id: string;
                    url: string;
                    events: string[];
                    active: boolean;
                    createdAt: Date;
                  }) => (
                    <tr
                      key={h.id}
                      className="border-t"
                      style={{ borderColor: "rgba(255,255,255,0.06)" }}
                    >
                      <td className="py-3 text-foreground font-mono text-xs max-w-[250px] truncate">
                        {h.url}
                      </td>
                      <td className="py-3 text-secondary">
                        {h.events.length} event
                        {h.events.length !== 1 ? "s" : ""}
                      </td>
                      <td className="py-3">
                        <Badge status={h.active ? "active" : "inactive"} />
                      </td>
                      <td className="py-3 text-muted whitespace-nowrap">
                        {format(h.createdAt, "MMM d, yyyy")}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          className="text-muted cursor-pointer"
                          aria-label="Delete webhook"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
