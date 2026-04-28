/**
 * Webhook subscription types.
 *
 * Subscription = an outbound HTTP endpoint where we POST events when they
 * occur (charge succeeded, refund created, dispute opened, etc.).
 *
 * The 'secret' is used to HMAC-sign the body of every webhook request so
 * receivers can verify it actually came from SalonTransact.
 *
 * lastTriggeredAt remains null until Phase 10 firing infrastructure ships.
 */

export interface WebhookPublic {
  id: string;
  merchantId: string;
  url: string;
  description: string | null;
  events: string[];
  active: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Returned ONCE on POST — full secret is shown to user one time and never again.
 */
export interface WebhookCreatedResponse extends WebhookPublic {
  secret: string;
}

export interface WebhookListResponse {
  data: WebhookPublic[];
  count: number;
  activeCount: number;
}

export interface MasterWebhookRow extends WebhookPublic {
  merchantBusinessName: string;
}

export interface MasterWebhookListResponse {
  data: MasterWebhookRow[];
  count: number;
  activeCount: number;
  merchantsRepresented: number;
}
