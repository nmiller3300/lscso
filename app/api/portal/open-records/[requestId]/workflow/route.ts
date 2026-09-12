import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const CUSTODIAN_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain", "1st Lieutenant"]);
const REVIEW_STATUSES = new Set(["Under Initial Review", "Records Collection", "Redaction & Legal Review", "Ready for Release"]);
const DISPOSITIONS = new Set(["Pending", "Granted", "Partially Granted", "Denied"]);

function clean(value: unknown, max = 8000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function money(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : NaN;
}

async function recordEvent(supabase: any, requestId: string, actorId: string, eventType: string, publicMessage: string | null, internalDetail: string | null, metadata: Record<string, unknown> = {}) {
  const { error } = await supabase.from("open_records_request_events").insert({
    request_id: requestId,
    actor_profile_id: actorId,
    event_type: eventType,
    public_message: publicMessage,
    internal_detail: internalDetail,
    metadata,
  });
  if (error) console.error("Open records event write failed", error);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const actor = await getCurrentPortalProfile();
  if (!actor || !CUSTODIAN_RANKS.has(actor.rank)) {
    return NextResponse.json({ error: "First Lieutenant or above Records Custodian authority required." }, { status: 403 });
  }

  const { requestId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid custodian action." }, { status: 400 });
  const action = clean((body as any).action, 60);
  const supabase = await createClient() as any;
  const { data: current, error: currentError } = await supabase
    .from("open_records_requests")
    .select("id,status,disposition,fee_amount,fee_status,acknowledged_at,response_summary,withholding_authority,release_available_at,release_expires_at")
    .eq("id", requestId)
    .maybeSingle();
  if (currentError || !current) return NextResponse.json({ error: "Open Records Request not found." }, { status: 404 });

  const now = new Date().toISOString();

  if (action === "acknowledge") {
    const { error } = await supabase.from("open_records_requests").update({
      status: "Under Initial Review",
      acknowledged_at: current.acknowledged_at || now,
      updated_at: now,
    }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "The request could not be acknowledged." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, "Acknowledged", "LSCSO acknowledged the request and began the initial custodian review.", `${actor.rank} ${actor.display_name} acknowledged the request.`);
    return NextResponse.json({ success: true });
  }

  if (action === "assess_fee") {
    const amount = money((body as any).fee_amount);
    if (!Number.isFinite(amount)) return NextResponse.json({ error: "Enter a valid fee amount." }, { status: 400 });
    const waived = amount === 0;
    const { error } = await supabase.from("open_records_requests").update({
      status: waived ? "Records Collection" : "Awaiting Payment",
      fee_amount: amount,
      fee_status: waived ? "Waived" : "Awaiting Payment",
      fee_assessed_at: now,
      fee_assessed_by: actor.id,
      acknowledged_at: current.acknowledged_at || now,
      updated_at: now,
    }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "The fee could not be assessed." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, waived ? "Fee Waived" : "Fee Assessed", waived ? "No processing fee is required for this request." : `A processing fee of $${amount.toFixed(2)} has been assessed. Payment must be made in city before processing continues.`, `${actor.rank} ${actor.display_name} assessed ${waived ? "a waived fee" : `$${amount.toFixed(2)}`}.`, { fee_amount: amount });
    return NextResponse.json({ success: true });
  }

  if (action === "confirm_payment") {
    if (Number(current.fee_amount ?? 0) <= 0) return NextResponse.json({ error: "This request does not have a payable fee." }, { status: 400 });
    const reference = clean((body as any).payment_reference, 240);
    const { error } = await supabase.from("open_records_requests").update({
      status: "Records Collection",
      fee_status: "Paid",
      payment_confirmed_at: now,
      payment_confirmed_by: actor.id,
      payment_reference: reference || null,
      updated_at: now,
    }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "Payment could not be confirmed." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, "Payment Confirmed", "In-city payment has been confirmed. LSCSO may proceed with records collection and review.", `${actor.rank} ${actor.display_name} confirmed in-city payment.${reference ? ` Reference: ${reference}` : ""}`);
    return NextResponse.json({ success: true });
  }

  if (action === "save_review") {
    const status = clean((body as any).status, 60);
    const disposition = clean((body as any).disposition, 40) || "Pending";
    if (!REVIEW_STATUSES.has(status)) return NextResponse.json({ error: "Select a valid review stage." }, { status: 400 });
    if (!DISPOSITIONS.has(disposition)) return NextResponse.json({ error: "Select a valid release disposition." }, { status: 400 });
    if (status !== "Under Initial Review" && Number(current.fee_amount ?? 0) > 0 && !["Paid", "Waived"].includes(current.fee_status)) return NextResponse.json({ error: "The assessed fee must be paid in city before processing advances." }, { status: 409 });
    const responseSummary = clean((body as any).response_summary, 8000);
    const withholdingAuthority = clean((body as any).withholding_authority, 4000);
    const internalNotes = clean((body as any).internal_notes, 8000);
    if (["Partially Granted", "Denied"].includes(disposition) && withholdingAuthority.length < 3) return NextResponse.json({ error: "Cite the legal authority for withholding or redaction." }, { status: 400 });
    const { error } = await supabase.from("open_records_requests").update({
      status,
      disposition,
      response_summary: responseSummary || null,
      withholding_authority: withholdingAuthority || null,
      internal_notes: internalNotes || null,
      acknowledged_at: current.acknowledged_at || now,
      updated_at: now,
    }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "The custodian review could not be saved." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, "Custodian Review Updated", responseSummary || null, `${actor.rank} ${actor.display_name} moved the request to ${status} with disposition ${disposition}.`, { status, disposition });
    return NextResponse.json({ success: true });
  }

  if (action === "deny") {
    const authority = clean((body as any).withholding_authority, 4000);
    const summary = clean((body as any).response_summary, 8000);
    const internalNotes = clean((body as any).internal_notes, 8000);
    if (authority.length < 3) return NextResponse.json({ error: "A denial must cite the legal authority relied upon." }, { status: 400 });
    if (summary.length < 3) return NextResponse.json({ error: "Provide a requester-facing denial summary." }, { status: 400 });
    const { error } = await supabase.from("open_records_requests").update({
      status: "Denied",
      disposition: "Denied",
      response_summary: summary,
      withholding_authority: authority,
      internal_notes: internalNotes || null,
      acknowledged_at: current.acknowledged_at || now,
      completed_at: now,
      updated_at: now,
    }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "The denial could not be recorded." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, "Denied", summary, `${actor.rank} ${actor.display_name} denied the request. Authority: ${authority}`);
    return NextResponse.json({ success: true });
  }

  if (action === "release") {
    if (current.fee_status === "Awaiting Payment") return NextResponse.json({ error: "Payment must be confirmed before records can be released." }, { status: 409 });
    const disposition = clean((body as any).disposition, 40);
    if (!["Granted", "Partially Granted"].includes(disposition)) return NextResponse.json({ error: "A release must be marked Granted or Partially Granted." }, { status: 400 });
    const summary = clean((body as any).response_summary, 8000);
    const authority = clean((body as any).withholding_authority, 4000);
    if (disposition === "Partially Granted" && authority.length < 3) return NextResponse.json({ error: "A partial grant must cite the legal authority for withheld or redacted material." }, { status: 400 });

    const { data: files, error: filesError } = await supabase.from("open_records_request_files").select("id,storage_path,file_name").eq("request_id", requestId).is("deleted_at", null).order("uploaded_at", { ascending: true });
    if (filesError || !files?.length) return NextResponse.json({ error: "Upload at least one approved release file before releasing the request." }, { status: 409 });

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    for (const file of files) {
      const { data: signed, error: signedError } = await supabase.storage.from("open-records-release").createSignedUrl(file.storage_path, 48 * 60 * 60);
      if (signedError || !signed?.signedUrl) return NextResponse.json({ error: `A secure release link could not be created for ${file.file_name}.` }, { status: 500 });
      const { error: fileUpdateError } = await supabase.from("open_records_request_files").update({ released_at: now, download_url: signed.signedUrl }).eq("id", file.id);
      if (fileUpdateError) return NextResponse.json({ error: "Release file metadata could not be finalized." }, { status: 500 });
    }

    const { error } = await supabase.from("open_records_requests").update({
      status: "Released",
      disposition,
      response_summary: summary || null,
      withholding_authority: authority || null,
      release_available_at: now,
      release_expires_at: expiresAt,
      released_by: actor.id,
      completed_at: now,
      updated_at: now,
    }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "The records could not be released." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, "Released", `LSCSO released the approved records. Download access expires ${new Date(expiresAt).toLocaleString("en-US")}.`, `${actor.rank} ${actor.display_name} released ${files.length} file(s) for 48 hours.`, { disposition, expires_at: expiresAt, file_count: files.length });
    return NextResponse.json({ success: true, release_expires_at: expiresAt });
  }

  if (action === "close") {
    const { error } = await supabase.from("open_records_requests").update({ status: "Closed", completed_at: current.release_available_at ? current.release_available_at : now, updated_at: now }).eq("id", requestId);
    if (error) return NextResponse.json({ error: "The request could not be closed." }, { status: 500 });
    await recordEvent(supabase, requestId, actor.id, "Closed", "The Open Records Request has been closed.", `${actor.rank} ${actor.display_name} closed the request.`);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Select a valid Records Custodian action." }, { status: 400 });
}
