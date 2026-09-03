import { timingSafeEqual } from "node:crypto";

export type FiveMIntegrationAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeFiveMIntegration(request: Request): FiveMIntegrationAuthResult {
  const expected = process.env.LSCSO_FIVEM_API_TOKEN?.trim();

  if (!expected || expected.length < 32) {
    return {
      ok: false,
      status: 503,
      error: "FiveM integration is not configured.",
    };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const supplied = match?.[1]?.trim() ?? "";

  if (!supplied || !constantTimeEqual(supplied, expected)) {
    return {
      ok: false,
      status: 401,
      error: "Unauthorized.",
    };
  }

  return { ok: true };
}
