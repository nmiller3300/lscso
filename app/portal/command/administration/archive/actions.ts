"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const VALID_OWNERS = new Set(["Administration", "Sheriff", "Undersheriff"]);
const VALID_FOLDERS = new Set(["Leadership", "Criminal Organizations", "Operations", "Cold Cases", "Internal Affairs", "Achievements", "Correspondence", "Photos & Artifacts"]);
const VALID_RELEASES = new Set(["Draft", "Internal", "Public", "Partially Released", "Sealed"]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function makeCode(folder: string) {
  const prefix: Record<string, string> = {
    Leadership: "EXEC",
    "Criminal Organizations": "ORG",
    Operations: "OP",
    "Cold Cases": "CC",
    "Internal Affairs": "IA",
    Achievements: "ADM",
    Correspondence: "CORR",
    "Photos & Artifacts": "ART",
  };
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase();
  return `MW-${prefix[folder] ?? "ARC"}-26-${suffix}`;
}

async function requireArchiveAuthority() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Sheriff", "Undersheriff"].includes(profile.rank)) throw new Error("Not authorized");
  return profile;
}

export async function loadArchiveRecords() {
  await requireArchiveAuthority();
  const supabase = await createClient() as any;
  const { data, error } = await supabase
    .from("current_administration_archive")
    .select("id,record_owner,folder,document_code,title,date_label,release_status,status,stamp,summary,public_body,created_at,updated_at,published_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function saveArchiveRecord(formData: FormData) {
  await requireArchiveAuthority();
  const id = text(formData, "id");
  const recordOwner = text(formData, "record_owner") || "Administration";
  const folder = text(formData, "folder");
  const releaseStatus = text(formData, "release_status") || "Draft";
  const title = text(formData, "title");
  const dateLabel = text(formData, "date_label");

  if (!VALID_OWNERS.has(recordOwner) || !VALID_FOLDERS.has(folder) || !VALID_RELEASES.has(releaseStatus)) throw new Error("Invalid archive record");
  if (!title || !dateLabel) throw new Error("Title and date are required");

  const released = ["Public", "Partially Released", "Sealed"].includes(releaseStatus);
  const payload = {
    administration: "miller-white",
    record_owner: recordOwner,
    folder,
    document_code: text(formData, "document_code").toUpperCase() || makeCode(folder),
    title,
    date_label: dateLabel,
    release_status: releaseStatus,
    status: text(formData, "status") || null,
    stamp: text(formData, "stamp") || null,
    summary: text(formData, "summary"),
    public_body: text(formData, "public_body").split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean),
    internal_notes: text(formData, "internal_notes") || null,
    updated_at: new Date().toISOString(),
    published_at: released ? new Date().toISOString() : null,
  };

  const supabase = await createClient() as any;
  const result = id
    ? await supabase.from("current_administration_archive").update(payload).eq("id", id)
    : await supabase.from("current_administration_archive").insert(payload);
  if (result.error) throw new Error(result.error.message);
  revalidatePath("/portal/command/administration/archive");
}

export async function removeArchiveRecord(formData: FormData) {
  await requireArchiveAuthority();
  const id = text(formData, "id");
  if (!id) throw new Error("Archive record id is required");
  const supabase = await createClient() as any;
  const { error } = await supabase.from("current_administration_archive").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/portal/command/administration/archive");
}
