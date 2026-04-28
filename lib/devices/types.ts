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

export interface MasterDeviceRow extends DevicePublic {
  merchantId: string;
  merchantBusinessName: string;
  merchantCity: string | null;
  merchantState: string | null;
}

export interface MasterDeviceListResponse {
  data: MasterDeviceRow[];
  count: number;
  merchantsRepresented: number;
}
