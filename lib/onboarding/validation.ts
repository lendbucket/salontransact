export function validateEIN(ein: string): boolean {
  return /^\d{2}-\d{7}$/.test(ein);
}

export function validateUSPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits[0] === "1");
}

export function validateZIP(zip: string): boolean {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

export const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export function validateStateCode(state: string): boolean {
  return US_STATES.includes(state.toUpperCase());
}

export function validateRoutingNumber(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) return false;
  const digits = routing.split("").map(Number);
  const checksum =
    (3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      1 * (digits[2] + digits[5] + digits[8])) %
    10;
  return checksum === 0;
}

export function validateAccountNumber(account: string): boolean {
  return /^\d{4,17}$/.test(account);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateWebsite(url: string): boolean {
  if (!url) return true;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return !!u.hostname;
  } catch {
    return false;
  }
}
