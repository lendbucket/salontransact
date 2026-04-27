export const MCC_CODES = [
  { code: "7230", label: "Beauty Shops & Barber Shops" },
  { code: "7298", label: "Health & Beauty Spas" },
  { code: "7297", label: "Massage Parlors" },
  { code: "5977", label: "Cosmetic Stores" },
] as const;

export type MccCode = (typeof MCC_CODES)[number]["code"];
