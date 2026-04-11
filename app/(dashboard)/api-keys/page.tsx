import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { KeyRound } from "lucide-react";

export default async function ApiKeysPage() {
  const { merchant } = await requireMerchant();

  const keys = await prisma.apiKey.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-white mb-1">API Keys</h1>
      <p className="text-sm text-muted mb-8">
        Use these to authenticate API requests
      </p>

      <div className="card p-6">
        {keys.length === 0 ? (
          <div className="py-12 text-center">
            <KeyRound
              className="w-8 h-8 mx-auto mb-3"
              style={{ color: "#606E74" }}
            />
            <p className="text-sm text-muted">
              No API keys yet. Create one to start integrating SalonTransact.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Key</th>
                  <th className="pb-3 font-medium">Last used</th>
                  <th className="pb-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b last:border-0">
                    <td className="py-3 text-white">{k.name}</td>
                    <td className="py-3 text-muted font-mono text-xs">
                      {k.key.slice(0, 12)}…
                    </td>
                    <td className="py-3 text-muted">
                      {k.lastUsed ? format(k.lastUsed, "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="py-3 text-muted">
                      {format(k.createdAt, "MMM d, yyyy")}
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
