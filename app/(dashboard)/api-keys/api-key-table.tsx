"use client";

import { useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type ApiKeyRow = {
  id: string;
  name: string;
  key: string;
  active: boolean;
  createdAt: string;
  lastUsed: string;
};

export function ApiKeyTable({ keys }: { keys: ApiKeyRow[] }) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-3 font-medium">Name</th>
            <th className="pb-3 font-medium">Key</th>
            <th className="pb-3 font-medium">Created</th>
            <th className="pb-3 font-medium">Last Used</th>
            <th className="pb-3 font-medium">Status</th>
            <th className="pb-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr
              key={k.id}
              className="border-t"
              style={{ borderColor: "#E8EAED" }}
            >
              <td className="py-3 text-foreground font-medium">{k.name}</td>
              <td className="py-3 font-mono text-xs text-muted">
                <div className="flex items-center gap-2">
                  <span>
                    {revealed.has(k.id)
                      ? k.key
                      : k.key.slice(0, 12) + "..." + k.key.slice(-4)}
                  </span>
                  <button
                    onClick={() => toggle(k.id)}
                    className="text-muted cursor-pointer"
                    aria-label={
                      revealed.has(k.id) ? "Hide key" : "Show key"
                    }
                  >
                    {revealed.has(k.id) ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </td>
              <td className="py-3 text-muted">{k.createdAt}</td>
              <td className="py-3 text-muted">{k.lastUsed}</td>
              <td className="py-3">
                <Badge status={k.active ? "active" : "inactive"} />
              </td>
              <td className="py-3 text-right">
                <button
                  className="text-muted cursor-pointer"
                  aria-label="Delete key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
