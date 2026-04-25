import { payrocRequest } from "./client";

export interface PayrocRefund {
  refundId: string;
  paymentId?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export async function listRefunds(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ refunds: PayrocRefund[] }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return payrocRequest("GET", `/refunds${qs ? `?${qs}` : ""}`);
}

export async function getRefund(refundId: string): Promise<PayrocRefund> {
  return payrocRequest("GET", `/refunds/${refundId}`);
}

export async function adjustRefund(
  refundId: string,
  amount: number
): Promise<PayrocRefund> {
  return payrocRequest("POST", `/refunds/${refundId}/adjust`, { amount });
}

export async function reverseRefund(
  refundId: string
): Promise<PayrocRefund> {
  return payrocRequest("POST", `/refunds/${refundId}/reverse`, {});
}
