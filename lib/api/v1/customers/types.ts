export type V1CustomerTier = "new" | "regular" | "occasional" | "lapsed";

export interface V1Customer {
  id: string;
  object: "customer";
  email: string;
  name: string | null;
  phone: string | null;
  tier: V1CustomerTier;
  total_transactions: number;
  total_spent_cents: number;
  saved_card_count: number;
  days_since_last_visit: number | null;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
}

export interface V1CustomerDetail extends V1Customer {
  saved_cards: Array<{
    id: string;
    last4: string | null;
    brand: string | null;
    expiry_month: string | null;
    expiry_year: string | null;
    cardholder_name: string | null;
    label: string | null;
    status: string;
    created_at: string;
    last_used_at: string | null;
  }>;
  recent_transactions: Array<{
    id: string;
    amount_cents: number;
    tip_amount_cents: number;
    status: string;
    description: string | null;
    stylist_id: string | null;
    booking_id: string | null;
    created_at: string;
  }>;
}

export interface V1CustomerListResponse {
  data: V1Customer[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface V1Ltv {
  customer_id: string;
  total_spent_cents: number;
  total_transactions: number;
  average_ticket_cents: number;
  highest_ticket_cents: number;
  by_year: Array<{ year: number; spent_cents: number; transaction_count: number }>;
  computed_at: string;
}

export interface V1VisitSummary {
  customer_id: string;
  total_visits: number;
  visits_last_30_days: number;
  visits_last_90_days: number;
  visits_last_365_days: number;
  average_days_between_visits: number | null;
  tier: V1CustomerTier;
  first_visit_at: string | null;
  last_visit_at: string | null;
  visits: Array<{
    transaction_id: string;
    visited_at: string;
    amount_cents: number;
    tip_amount_cents: number;
    description: string | null;
    stylist_id: string | null;
    stylist_name: string | null;
  }>;
}
