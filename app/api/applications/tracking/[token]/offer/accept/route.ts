import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function clean(value: unknown, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function errorStatus(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("expired") || normalized.includes("no longer available") || normalized.includes("already complete")) return 409;
  if (normalized.includes("invalid") || normalized.includes("signature") || normalized.includes("not eligible") || normalized.includes("not found")) return 400;
  return 500;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const rawToken = String(token ?? "").trim();
    if (rawToken.length < 32 || rawToken.length > 160) {
      return NextResponse.json({ error: "Tracking link is invalid." }, { status: 400 });
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body) || body.accepted !== true) {
      return NextResponse.json({ error: "You must confirm acceptance of the employment offer." }, { status: 400 });
    }

    const offerId = clean(body.offerId, 80);
    const signatureName = clean(body.signatureName, 120);
    if (!offerId || !signatureName) {
      return NextResponse.json({ error: "Enter your full name and accept the employment offer." }, { status: 400 });
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const supabase = await createClient() as any;
    const { data, error } = await supabase.rpc("accept_recruitment_employment_offer", {
      p_tracking_token_hash: tokenHash,
      p_offer_id: offerId,
      p_signature_name: signatureName,
    });

    if (error) {
      const message = error.message || "The employment offer could not be accepted.";
      const status = errorStatus(message);
      if (status >= 500) console.error("[Recruitment Offer Acceptance]", error);
      return NextResponse.json({ error: status >= 500 ? "The employment offer could not be accepted. Please try again." : message }, { status });
    }

    return NextResponse.json({ success: true, acceptance: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[Recruitment Offer Acceptance]", error);
    return NextResponse.json({ error: "The employment offer could not be accepted. Please try again." }, { status: 500 });
  }
}
