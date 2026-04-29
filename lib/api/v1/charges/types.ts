export type V1ChargeStatus = "succeeded" | "failed" | "requires_capture";

export interface V1ChargeSource {
  type: "saved_card" | "single_use_token";
  id: string;
}

export interface V1ChargeItem {
  name: string;
  amount_cents: number;
}

export interface V1ChargeCreateInput {
  amount_cents: number;
  currency?: string;
  description?: string;
  source: V1ChargeSource;
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  capture?: boolean;
  stylist_id?: string;
  booking_id?: string;
  tip_amount_cents?: number;
  items?: V1ChargeItem[];
  metadata?: Record<string, unknown>;
}

export interface V1ChargeResponse {
  id: string;
  object: "charge";
  status: V1ChargeStatus;
  amount_cents: number;
  currency: string;
  captured: boolean;
  captured_at: string | null;
  description: string | null;
  source: {
    type: "saved_card" | "single_use_token";
    id: string | null;
    last4: string | null;
    brand: string | null;
  };
  customer_id: string | null;
  stylist_id: string | null;
  booking_id: string | null;
  tip_amount_cents: number;
  items: V1ChargeItem[] | null;
  metadata: Record<string, unknown> | null;
  approval_code: string | null;
  decline_reason: string | null;
  created_at: string;
  payroc: { payment_id: string | null };
}

export interface V1ChargeListResponse {
  data: V1ChargeResponse[];
  has_more: boolean;
  next_cursor: string | null;
}
