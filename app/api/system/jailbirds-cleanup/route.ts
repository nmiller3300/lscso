import { NextResponse } from "next/server";
import { purgeExpiredJailbirds } from "../../../../lib/jailbirds";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  }

  if (authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await purgeExpiredJailbirds();
    return NextResponse.json({ ok: true, ...result, checkedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Jailbirds cleanup failed", error);
    return NextResponse.json({ error: "Cleanup failed." }, { status: 500 });
  }
}
