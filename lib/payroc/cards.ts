import { payrocRequest } from "./client";

const TERMINAL_ID = process.env.PAYROC_TERMINAL_ID!;

export async function verifyCard(request: {
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  token?: string;
}): Promise<{
  status: string;
  responseCode: string;
  responseMessage: string;
}> {
  return payrocRequest("POST", "/cards/verify", {
    processingTerminalId: TERMINAL_ID,
    ...request,
  });
}

export async function binLookup(bin: string): Promise<{
  bin: string;
  cardType: string;
  cardBrand: string;
  issuingBank: string;
  country: string;
}> {
  return payrocRequest("POST", "/cards/bin-lookup", { bin });
}
