import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function disabledResponse() {
  return NextResponse.json(
    {
      ok: false,
      disabled: true,
      error: "Game/computer account linking is temporarily disabled. No FiveM connection is required to use the LSCSO Personnel Portal.",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
