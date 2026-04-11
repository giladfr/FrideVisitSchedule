import { createHash, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "visit-admin-session";

function hashValue(value: string) {
  return createHash("sha256").update(`fride-visit:${value}`).digest("hex");
}

export function hasAdminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function createAdminCookieValue() {
  const password = process.env.ADMIN_PASSWORD?.trim();

  if (!password) {
    return null;
  }

  return hashValue(password);
}

export function isAdminSessionValid(cookieValue?: string) {
  const expected = createAdminCookieValue();

  if (!expected || !cookieValue) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(cookieValue);

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export function matchesAdminPassword(password: string) {
  const configured = process.env.ADMIN_PASSWORD?.trim();

  if (!configured) {
    return false;
  }

  const expectedBuffer = Buffer.from(hashValue(configured));
  const actualBuffer = Buffer.from(hashValue(password));

  return timingSafeEqual(expectedBuffer, actualBuffer);
}
