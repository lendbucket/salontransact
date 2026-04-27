/**
 * UI/API contract types for paired card-present devices.
 * Mirrors Prisma's Device model with select fields safe to expose to clients.
 */
export interface DevicePublic {
  id: string;
  serialNumber: string;
  model: string | null;
  label: string | null;
  status: string;
  pairedAt: string;
  lastSeenAt: string | null;
  lastChargeAt: string | null;
}

export interface DeviceListResponse {
  data: DevicePublic[];
  count: number;
}
