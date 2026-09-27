"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function requireAdministrationAuthority() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Sheriff", "Undersheriff"].includes(profile.rank)) throw new Error("Not authorized to manage the current administration.");
  return profile;
}

function refreshAdministration() {
  revalidatePath("/portal/command/administration");
  revalidatePath("/portal/command/administration/current-administration");
  revalidatePath("/office-of-the-sheriff");
}

export async function loadAdministrationWorkspace() {
  await requireAdministrationAuthority();
  const admin = createAdminClient() as any;
  const [{ data: members, error: memberError }, { data: personnel, error: personnelError }] = await Promise.all([
    admin
      .from("current_administration")
      .select("id,profile_id,display_name,rank,position_title,call_sign,portrait_url,public_bio,responsibilities,appointment_status,start_date,display_order,is_public,is_active,updated_at")
      .order("display_order", { ascending: true })
      .order("display_name", { ascending: true }),
    admin
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,call_sign,division,status")
      .in("status", ["Active", "Acting"])
      .order("display_name", { ascending: true }),
  ]);
  if (memberError) throw new Error(memberError.message);
  if (personnelError) throw new Error(personnelError.message);
  return { members: members ?? [], personnel: personnel ?? [] };
}

async function portraitUrlFor(formData: FormData, memberId: string, currentUrl: string | null) {
  const file = formData.get("portrait");
  if (!(file instanceof File) || file.size === 0) return currentUrl;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error("Portrait must be a JPG, PNG, WebP, or AVIF image.");
  if (file.size > MAX_PORTRAIT_BYTES) throw new Error("Portrait must be 5 MB or smaller.");

  const extension: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/avif": "avif",
  };
  const admin = createAdminClient() as any;
  const path = `${memberId}/portrait-${Date.now()}.${extension[file.type] ?? "jpg"}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await admin.storage.from("administration-portraits").upload(path, buffer, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return admin.storage.from("administration-portraits").getPublicUrl(path).data.publicUrl as string;
}

export async function saveAdministrationMember(formData: FormData) {
  const actor = await requireAdministrationAuthority();
  const admin = createAdminClient() as any;
  const submittedId = value(formData, "id");
  const profileId = value(formData, "profile_id");
  if (!profileId) throw new Error("Select a personnel member.");

  const { data: rosterProfile, error: rosterError } = await admin
    .from("personnel_profiles")
    .select("id,display_name,rank,call_sign,division,status")
    .eq("id", profileId)
    .maybeSingle();
  if (rosterError) throw new Error(rosterError.message);
  if (!rosterProfile || !["Active", "Acting"].includes(rosterProfile.status)) throw new Error("That personnel member is not currently active.");

  let existing: any = null;
  if (submittedId) {
    const result = await admin.from("current_administration").select("id,portrait_url").eq("id", submittedId).maybeSingle();
    if (result.error) throw new Error(result.error.message);
    if (!result.data) throw new Error("Administration member not found.");
    existing = result.data;
  }

  const memberId = submittedId || crypto.randomUUID();
  const displayOrderRaw = Number(value(formData, "display_order") || 100);
  const displayOrder = Number.isFinite(displayOrderRaw) ? Math.max(0, Math.min(999, Math.round(displayOrderRaw))) : 100;
  const responsibilities = value(formData, "responsibilities")
    .split("\n")
    .map((line) => line.trim().replace(/^[-•]\s*/, ""))
    .filter(Boolean)
    .slice(0, 8);
  const portraitUrl = await portraitUrlFor(formData, memberId, existing?.portrait_url ?? null);
  const appointmentStatus = value(formData, "appointment_status") === "Acting" ? "Acting" : "Permanent";
  const payload = {
    id: memberId,
    profile_id: profileId,
    display_name: value(formData, "display_name") || rosterProfile.display_name,
    rank: value(formData, "rank") || rosterProfile.rank,
    position_title: value(formData, "position_title") || rosterProfile.rank,
    call_sign: value(formData, "call_sign") || rosterProfile.call_sign || null,
    portrait_url: portraitUrl,
    public_bio: value(formData, "public_bio") || null,
    responsibilities,
    appointment_status: appointmentStatus,
    start_date: value(formData, "start_date") || null,
    display_order: displayOrder,
    is_public: formData.get("is_public") === "on",
    is_active: formData.get("is_active") === "on",
    updated_by: actor.id,
    updated_at: new Date().toISOString(),
  };

  const result = submittedId
    ? await admin.from("current_administration").update(payload).eq("id", submittedId)
    : await admin.from("current_administration").insert({ ...payload, created_by: actor.id });
  if (result.error) {
    if (result.error.code === "23505") throw new Error("That personnel member is already part of the current administration.");
    throw new Error(result.error.message);
  }
  refreshAdministration();
}

export async function removeAdministrationMember(formData: FormData) {
  const actor = await requireAdministrationAuthority();
  const id = value(formData, "id");
  if (!id) throw new Error("Administration member id is required.");
  const admin = createAdminClient() as any;
  const { error } = await admin
    .from("current_administration")
    .update({ is_active: false, is_public: false, updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  refreshAdministration();
}
