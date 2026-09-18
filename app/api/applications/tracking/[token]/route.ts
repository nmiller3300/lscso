import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function buildVersion(record: any, messages: any[]) {
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  return JSON.stringify({
    applicationTrack: record?.application_track ?? null,
    updatedAt: record?.updated_at ?? null,
    status: record?.status ?? null,
    interviewStatus: record?.interview_status ?? null,
    interviewScheduledAt: record?.interview_scheduled_at ?? null,
    applicantTimeZone: record?.applicant_timezone ?? null,
    interviewTimeZone: record?.interview_timezone ?? null,
    applicantStatusMessage: record?.applicant_status_message ?? null,
    hired: Boolean(record?.hired),
    closureCode: record?.closure_code ?? null,
    closureReason: record?.closure_reason ?? null,
    offerId: record?.offer_id ?? null,
    offerStatus: record?.offer_status ?? null,
    offerIssuedAt: record?.offer_issued_at ?? null,
    offerExpiresAt: record?.offer_expires_at ?? null,
    offerAcceptedAt: record?.offer_accepted_at ?? null,
    offerSignatureName: record?.offer_signature_name ?? null,
    messageCount: messages.length,
    lastMessageId: lastMessage?.id ?? null,
    lastMessageSentAt: lastMessage?.sent_at ?? null,
  });
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const rawToken = String(token ?? "").trim();
    if (rawToken.length < 32 || rawToken.length > 160) {
      return NextResponse.json({ error: "Tracking link is invalid." }, { status: 400, headers: { "Cache-Control": "no-store" } });
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const supabase = await createClient() as any;
    const { data: record, error } = await supabase
      .rpc("get_recruitment_application_status", { p_tracking_token_hash: tokenHash })
      .maybeSingle();

    if (error || !record) {
      return NextResponse.json({ error: "Tracking link is unavailable." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }

    const { data: messageData } = await supabase.rpc("get_recruitment_application_messages", {
      p_tracking_token_hash: tokenHash,
    });
    const messages = Array.isArray(messageData) ? messageData : [];

    return NextResponse.json(
      { version: buildVersion(record, messages) },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("[Applicant Tracking Live Status]", error);
    return NextResponse.json({ error: "Tracking status could not be checked." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}