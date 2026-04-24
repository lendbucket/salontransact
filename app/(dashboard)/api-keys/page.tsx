import { requireMerchant } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";
import { KeyRound, AlertTriangle, Plus } from "lucide-react";
import { ApiKeyTable } from "./api-key-table";

export default async function ApiKeysPage() {
  const { merchant } = await requireMerchant();

  const keys = await prisma.apiKey.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-foreground mb-1">
            API Keys
          </h1>
          <p className="text-sm text-secondary">
            Authenticate API requests to SalonTransact
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 whitespace-nowrap shadow-sm hover:shadow-md hover:-translate-y-px active:translate-y-0 cursor-pointer">
          <Plus size={16} strokeWidth={1.5} />
          Create Key
        </button>
      </div>

      {/* Warning banner */}
      <div
        className="flex items-start gap-3 p-4 rounded-lg mb-6"
        style={{
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.15)",
        }}
      >
        <AlertTriangle
          className="w-4 h-4 flex-shrink-0 mt-0.5"
          style={{ color: "#f59e0b" }}
        />
        <p className="text-sm" style={{ color: "#f59e0b" }}>
          Keep your API keys secret. Never expose them in client-side code or
          public repositories.
        </p>
      </div>

      <div className="st-card p-6">
        {keys.length === 0 ? (
          <div className="py-12 text-center">
            <KeyRound className="w-8 h-8 mx-auto mb-3 text-muted" />
            <p className="text-sm text-muted">
              No API keys yet. Create one to start integrating SalonTransact.
            </p>
          </div>
        ) : (
          <ApiKeyTable
            keys={keys.map(
              (k: {
                id: string;
                name: string;
                key: string;
                active: boolean;
                createdAt: Date;
                lastUsed: Date | null;
              }) => ({
                id: k.id,
                name: k.name,
                key: k.key,
                active: k.active,
                createdAt: format(k.createdAt, "MMM d, yyyy"),
                lastUsed: k.lastUsed
                  ? format(k.lastUsed, "MMM d, yyyy")
                  : "Never",
              })
            )}
          />
        )}
      </div>
    </div>
  );
}
