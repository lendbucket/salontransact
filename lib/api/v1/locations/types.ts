// API v1 Location types — public contract surface
//
// Engine model is Location in prisma/schema.prisma. This file exposes
// the v1 wire format consumers (Kasse, third-party integrations) see.

export interface LocationV1 {
  id: string;                      // loc_<cuid>
  object: "location";
  name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  timezone: string;
  status: "active" | "inactive";
  is_primary: boolean;
  created_at: string;              // ISO 8601
  updated_at: string;
}

export interface CreateLocationV1Request {
  name: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  timezone?: string;
  is_primary?: boolean;
}
