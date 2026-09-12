import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const CUSTODIAN_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain", "1st Lieutenant"]);
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

function safeName(name: string) {
  return name.replace(/[^A-Za-z0-9._ -]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 140) || "record";
}

export async function POST(request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const actor = await getCurrentPortalProfile();
  if (!actor || !CUSTODIAN_RANKS.has(actor.rank)) return NextResponse.json({ error: "First Lieutenant or above Records Custodian authority required." }, { status: 403 });

  const { requestId } = await params;
  const supabase = await createClient() as any;
  const { data: record, error: recordError } = await supabase.from("open_records_requests").select("id,status,fee_amount,fee_status").eq("id", requestId).maybeSingle();
  if (recordError || !record) return NextResponse.json({ error: "Open Records Request not found." }, { status: 404 });
  if (["Released", "Denied", "Expired", "Closed"].includes(record.status)) return NextResponse.json({ error: "Files cannot be added after this request has reached its final disposition." }, { status: 409 });
  if (Number(record.fee_amount ?? 0) > 0 && record.fee_status !== "Paid") return NextResponse.json({ error: "In-city payment must be confirmed before release files are uploaded." }, { status: 409 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Release files must be between 1 byte and 25 MB." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "This file type is not permitted for Open Records releases." }, { status: 400 });

  const originalName = file.name.slice(0, 180) || "record";
  const storagePath = `${requestId}/${randomUUID()}-${safeName(originalName)}`;
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from("open-records-release").upload(storagePath, bytes, { contentType: file.type, upsert: false, cacheControl: "0" });
  if (uploadError) {
    console.error("Open records file upload failed", uploadError);
    return NextResponse.json({ error: "The release file could not be uploaded." }, { status: 500 });
  }

  const { data: metadata, error: metadataError } = await supabase.from("open_records_request_files").insert({
    request_id: requestId,
    storage_path: storagePath,
    file_name: originalName,
    mime_type: file.type,
    size_bytes: file.size,
    uploaded_by: actor.id,
  }).select("id,file_name,mime_type,size_bytes,uploaded_at").single();

  if (metadataError || !metadata) {
    await supabase.storage.from("open-records-release").remove([storagePath]);
    return NextResponse.json({ error: "The release file could not be recorded." }, { status: 500 });
  }

  await supabase.from("open_records_request_events").insert({
    request_id: requestId,
    actor_profile_id: actor.id,
    event_type: "Release File Uploaded",
    internal_detail: `${actor.rank} ${actor.display_name} uploaded ${originalName} for release review.`,
    metadata: { file_id: metadata.id, file_name: originalName, size_bytes: file.size },
  });

  return NextResponse.json({ success: true, file: metadata });
}
