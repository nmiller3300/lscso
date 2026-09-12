import { NextResponse } from "next/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const CUSTODIAN_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain", "1st Lieutenant"]);

export async function DELETE(_: Request, { params }: { params: Promise<{ requestId: string; fileId: string }> }) {
  const actor = await getCurrentPortalProfile();
  if (!actor || !CUSTODIAN_RANKS.has(actor.rank)) return NextResponse.json({ error: "First Lieutenant or above Records Custodian authority required." }, { status: 403 });

  const { requestId, fileId } = await params;
  const supabase = await createClient() as any;
  const { data: requestRow, error: requestError } = await supabase.from("open_records_requests").select("id,status").eq("id", requestId).maybeSingle();
  if (requestError || !requestRow) return NextResponse.json({ error: "Open Records Request not found." }, { status: 404 });
  if (["Released", "Expired", "Closed"].includes(requestRow.status)) return NextResponse.json({ error: "Released files cannot be changed after publication." }, { status: 409 });

  const { data: file, error: fileError } = await supabase.from("open_records_request_files").select("id,storage_path,file_name,deleted_at").eq("id", fileId).eq("request_id", requestId).maybeSingle();
  if (fileError || !file || file.deleted_at) return NextResponse.json({ error: "Release file not found." }, { status: 404 });

  const { error: storageError } = await supabase.storage.from("open-records-release").remove([file.storage_path]);
  if (storageError) return NextResponse.json({ error: "The stored release file could not be removed." }, { status: 500 });

  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("open_records_request_files").update({ deleted_at: now, download_url: null }).eq("id", fileId);
  if (updateError) return NextResponse.json({ error: "The release file metadata could not be updated." }, { status: 500 });

  await supabase.from("open_records_request_events").insert({ request_id: requestId, actor_profile_id: actor.id, event_type: "Release File Removed", internal_detail: `${actor.rank} ${actor.display_name} removed ${file.file_name} before release.`, metadata: { file_id: fileId, file_name: file.file_name } });
  return NextResponse.json({ success: true });
}
