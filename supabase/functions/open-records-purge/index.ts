import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Purge service unavailable" }, 503);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: config, error: configError } = await supabase.from("open_records_purge_config").select("secret").eq("id", true).maybeSingle();
  if (configError || !config?.secret) return json({ error: "Purge configuration unavailable" }, 503);

  const supplied = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!supplied || supplied !== config.secret) return json({ error: "Unauthorized" }, 401);

  const now = new Date().toISOString();
  const { data: expiredRequests, error: requestError } = await supabase
    .from("open_records_requests")
    .select("id,request_number,release_expires_at")
    .eq("status", "Released")
    .lte("release_expires_at", now);

  if (requestError) return json({ error: "Expired request lookup failed" }, 500);

  let requestsExpired = 0;
  let filesDeleted = 0;
  const failures: Array<{ request_id: string; message: string }> = [];

  for (const record of expiredRequests ?? []) {
    try {
      const { data: files, error: fileError } = await supabase
        .from("open_records_request_files")
        .select("id,storage_path,file_name")
        .eq("request_id", record.id)
        .is("deleted_at", null);
      if (fileError) throw fileError;

      const activeFiles = files ?? [];
      for (const batch of chunks(activeFiles.map((file) => file.storage_path), 100)) {
        if (!batch.length) continue;
        const { error: removeError } = await supabase.storage.from("open-records-release").remove(batch);
        if (removeError) throw removeError;
      }

      if (activeFiles.length) {
        const { error: metadataError } = await supabase
          .from("open_records_request_files")
          .update({ deleted_at: now, download_url: null })
          .eq("request_id", record.id)
          .is("deleted_at", null);
        if (metadataError) throw metadataError;
      }

      const { error: requestUpdateError } = await supabase.from("open_records_requests").update({ status: "Expired", updated_at: now }).eq("id", record.id);
      if (requestUpdateError) throw requestUpdateError;

      await supabase.from("open_records_request_events").insert({
        request_id: record.id,
        event_type: "Release Files Purged",
        public_message: "The 48-hour electronic release window expired and the temporary download files were removed from active storage.",
        internal_detail: `Automatic retention purge removed ${activeFiles.length} temporary release file(s).`,
        metadata: { expired_at: record.release_expires_at, purged_at: now, file_count: activeFiles.length },
      });

      requestsExpired += 1;
      filesDeleted += activeFiles.length;
    } catch (error) {
      failures.push({ request_id: record.id, message: error instanceof Error ? error.message : "Unknown purge failure" });
    }
  }

  return json({ requests_expired: requestsExpired, files_deleted: filesDeleted, failures });
});
