export interface V1Card {
  id: string;
  object: "card";
  customer_id: string | null;
  customer_email: string;
  last4: string | null;
  brand: string | null;
  expiry_month: string | null;
  expiry_year: string | null;
  cardholder_name: string | null;
  label: string | null;
  status: string;
  last_used_at: string | null;
  created_at: string;
}

export interface V1CardListResponse {
  data: V1Card[];
  has_more: boolean;
  next_cursor: string | null;
}
