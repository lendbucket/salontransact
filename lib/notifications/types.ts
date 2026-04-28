export type NotificationCategory =
  | "charge"
  | "refund"
  | "dispute"
  | "payout"
  | "merchant"
  | "platform"
  | "system";

export type NotificationSeverity = "info" | "warning" | "error" | "success";

export interface NotificationPublic {
  id: string;
  userId: string;
  merchantId: string | null;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link: string | null;
  metadata: Record<string, unknown> | null;
  auditLogId: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationPublic[];
  count: number;
  unreadCount: number;
}

export interface NotificationCountResponse {
  unreadCount: number;
}

export interface AuditLogPreview {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  merchantId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationDetailResponse {
  notification: NotificationPublic;
  auditLog: AuditLogPreview | null;
}
