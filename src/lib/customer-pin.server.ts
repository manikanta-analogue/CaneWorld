/** Server-only helpers for the customer 4-digit PIN. */

const PEPPER = "sweet-rewards-pin-v1";

/** Salted SHA-256 digest; the raw PIN is never stored. */
export async function hashPin(mobile: string, pin: string) {
  const bytes = new TextEncoder().encode(`${PEPPER}:${mobile}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function pinMatches(mobile: string, pin: string, hash: string) {
  if (!hash) return false;
  const candidate = await hashPin(mobile, pin);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

/** Demo OTP delivery: the shop uses a fixed code until an SMS gateway is connected. */
export const DEMO_OTP = "123456";
export const otpValid = (otp: string) => otp === DEMO_OTP;
