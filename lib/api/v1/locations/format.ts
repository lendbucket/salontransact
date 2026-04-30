import type { Location } from "@prisma/client";
import type { LocationV1 } from "./types";

/**
 * Convert internal Location row → v1 wire format.
 */
export function locationToV1(loc: Location): LocationV1 {
  return {
    id: `loc_${loc.id}`,
    object: "location",
    name: loc.name,
    address_line1: loc.addressLine1,
    address_line2: loc.addressLine2,
    city: loc.city,
    state: loc.state,
    zip: loc.zip,
    phone: loc.phone,
    timezone: loc.timezone,
    status: loc.status === "active" ? "active" : "inactive",
    is_primary: loc.isPrimary,
    created_at: loc.createdAt.toISOString(),
    updated_at: loc.updatedAt.toISOString(),
  };
}
