import { payrocRequest } from "./client";

export interface PayrocAuthorization {
  authorizationId: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

export async function listAuthorizations(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<{ authorizations: PayrocAuthorization[] }> {
  const query = new URLSearchParams();
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const qs = query.toString();
  return payrocRequest("GET", `/authorizations${qs ? `?${qs}` : ""}`);
}

export async function getAuthorization(
  authorizationId: string
): Promise<PayrocAuthorization> {
  return payrocRequest("GET", `/authorizations/${authorizationId}`);
}
