export const MCC_CODES = [
  { code: "7230", label: "Beauty Shops & Barber Shops" },
  { code: "7298", label: "Health & Beauty Spas" },
  { code: "7297", label: "Massage Parlors" },
  { code: "5977", label: "Cosmetic Stores" },
  { code: "7299", label: "Miscellaneous Personal Services" },
  { code: "8099", label: "Health Services (Med Spas)" },
  { code: "8011", label: "Doctors & Physicians (Med Spas with MD)" },
  { code: "5732", label: "Electronics Sales (Premium Tools)" },
  { code: "5621", label: "Women's Ready-to-Wear (Boutique Salons)" },
] as const;

export type MccCode = (typeof MCC_CODES)[number]["code"];

export const VALID_MCC_CODES = MCC_CODES.map((c) => c.code);
