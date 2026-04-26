// CloudEvents 1.0 envelope format used by Payroc

export interface CloudEvent<TData = unknown> {
  specversion: string;
  type: string;
  version?: string;
  source: string;
  id: string;
  time: string;
  datacontenttype?: string;
  data: TData;
}

// Payload data shapes — tolerant types since Payroc may add fields

export interface ProcessingAccountStatusChangedData {
  processingAccountId?: string;
  oldStatus?: string;
  newStatus?: string;
  changedAt?: string;
  [key: string]: unknown;
}

export interface TerminalOrderStatusChangedData {
  terminalOrderId?: string;
  oldStatus?: string;
  newStatus?: string;
  changedAt?: string;
  [key: string]: unknown;
}
