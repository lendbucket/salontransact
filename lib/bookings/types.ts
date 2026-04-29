export type BookingStatus = "booked" | "arrived" | "completed" | "cancelled" | "no_show";
export type BookingExternalSource = "vagaro" | "booksy" | "square_appointments" | "kasse" | "manual";

export interface BookingSummary {
  id: string;
  merchantId: string;
  stylistId: string | null;
  stylistName?: string;
  customerId: string | null;
  customerName?: string;
  customerEmail?: string;
  scheduledFor: string;
  durationMinutes: number;
  serviceCode: string | null;
  serviceName: string | null;
  expectedAmountCents: number;
  status: BookingStatus;
  hasCardOnFile: boolean;
  hasAuthHold: boolean;
  externalSource: BookingExternalSource | null;
  externalBookingId: string | null;
  createdAt: string;
}

export interface BookingDetail extends BookingSummary {
  authHoldId: string | null;
  authHoldAmountCents: number | null;
  authHoldExpiresAt: string | null;
  savedPaymentMethodId: string | null;
  notes: string | null;
}

export interface BookingListResponse {
  data: BookingSummary[];
  count: number;
}
