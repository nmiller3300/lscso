import { createHash, timingSafeEqual } from "node:crypto";

export type FiveMIntegrationAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

const AEGIS_MOBILE_TOKEN_SHA256 = "b3df6d480ecdcdf3be9e5dae91e782a05fbbaefb926a0292067cb5e4217768df";
const AEGIS_MOBILE_ALLOWED_PATHS = new Set([
  "/api/integrations/fivem/government-auth",
  "/api/integrations/fivem/myhr",
  "/api/integrations/fivem/pair",
  "/api/integrations/fivem/mobile/pairing",
]);

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function authorizeFiveMIntegration(request: Request): FiveMIntegrationAuthResult {
  const expected = process.env.LSCSO_FIVEM_API_TOKEN?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const supplied = match?.[1]?.trim() ?? "";

  if (!supplied) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized.",
    };
  }

  if (expected.length >= 32 && constantTimeEqual(supplied, expected)) {
    return { ok: true };
  }

  const pathname = new URL(request.url).pathname;
  const mobileHeader = request.headers.get("x-aegis-lscso-mobile") === "1";
  const mobileTokenMatches = constantTimeEqual(sha256(supplied), AEGIS_MOBILE_TOKEN_SHA256);

  if (mobileHeader && AEGIS_MOBILE_ALLOWED_PATHS.has(pathname) && mobileTokenMatches) {
    return { ok: true };
  }

  if (!expected || expected.length < 32) {
    return {
      ok: false,
      status: 503,
      error: "FiveM integration is not configured.",
    };
  }

  return {
    ok: false,
    status: 401,
    error: "Unauthorized.",
  };
}
