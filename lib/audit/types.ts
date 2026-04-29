export type AuditAction =
  | "merchant.suspend"
  | "merchant.reactivate"
  | "merchant.plan_change"
  | "merchant.update"
  | "saved_card.revoke"
  | "device.charge.initiated"
  | "device.charge.failed"
  | "device.retire"
  | "transaction.refund"
  | "transaction.reverse";

export interface AuditLogPublic {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  merchantId: string | null;
  merchantBusinessName: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogListResponse {
  data: AuditLogPublic[];
  count: number;
  uniqueActors: number;
  uniqueMerchants: number;
  availableActions: string[];
  availableTargetTypes: string[];
}
