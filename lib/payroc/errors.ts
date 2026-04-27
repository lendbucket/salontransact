import type { PayrocApiErrorBody } from "./types";

export class PayrocApiError extends Error {
  public readonly status: number;
  public readonly path: string;
  public readonly body: PayrocApiErrorBody | string | null;

  constructor(
    status: number,
    path: string,
    body: PayrocApiErrorBody | string | null,
    message?: string
  ) {
    super(
      message ??
        `Payroc API error: ${status} ${path}${
          typeof body === "string"
            ? ` ${body}`
            : body && "message" in body
              ? ` ${body.message}`
              : ""
        }`
    );
    this.name = "PayrocApiError";
    this.status = status;
    this.path = path;
    this.body = body;
  }
}

export function isPayrocApiError(err: unknown): err is PayrocApiError {
  return err instanceof PayrocApiError;
}
