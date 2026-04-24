import { requireMerchant } from "@/lib/session";
import { FileText } from "lucide-react";

export default async function LogsPage() {
  await requireMerchant();

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313" }}
      >
        Activity Logs
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        API requests and system events
      </p>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="flex flex-col items-center justify-center py-20">
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#F3F4F6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 16,
            }}
          >
            <FileText
              size={20}
              strokeWidth={1.5}
              style={{ color: "#878787" }}
            />
          </div>
          <p
            style={{
              fontSize: 16,
              fontWeight: 500,
              color: "#1A1313",
              marginBottom: 4,
            }}
          >
            No logs yet
          </p>
          <p style={{ fontSize: 14, color: "#878787", marginBottom: 8 }}>
            API activity will appear here
          </p>
          <p style={{ fontSize: 12, color: "#ABABAB" }}>
            Logs are retained for 90 days
          </p>
        </div>
      </div>
    </div>
  );
}
