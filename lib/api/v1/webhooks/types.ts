export interface V1WebhookDelivery {
  id: string;
  object: "webhook_delivery";
  webhook_id: string;
  event_id: string;
  event_type: string;
  status: "pending" | "succeeded" | "failed" | "exhausted";
  attempt_count: number;
  response_status: number | null;
  response_body: string | null;
  error_message: string | null;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface V1WebhookDeliveryListResponse {
  data: V1WebhookDelivery[];
  has_more: boolean;
  next_cursor: string | null;
}
