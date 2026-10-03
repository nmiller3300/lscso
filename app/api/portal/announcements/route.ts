import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hasStandingDepartmentAuthority, type LscsoRank } from "@/lib/authorization/lscso-authority";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

function canSendAnnouncements(rank: string) {
  return hasStandingDepartmentAuthority(rank as LscsoRank);
}

async function authorize() {
  const profile = await getCurrentPortalProfile();
  return profile && canSendAnnouncements(profile.rank) ? profile : null;
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET() {
  const profile = await authorize();
  if (!profile) {
    return NextResponse.json({ error: "Captain or higher authority is required." }, { status: 403 });
  }

  const admin = createAdminClient() as any;
  const { data, error } = await admin
    .from("discord_announcements")
    .select("id,title,body,image_url,discord_message_id,issued_by_display_name,issued_by_rank,sent_at")
    .order("sent_at", { ascending: false })
    .limit(12);

  if (error) {
    return NextResponse.json({ error: "Announcement history could not be loaded." }, { status: 500 });
  }

  return NextResponse.json({ announcements: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await authorize();
  if (!profile) {
    return NextResponse.json({ error: "Captain or higher authority is required." }, { status: 403 });
  }

  let uploadedPath: string | null = null;
  const admin = createAdminClient() as any;

  try {
    const form = await request.formData();
    const title = cleanText(form.get("title"), 256);
    const message = cleanText(form.get("message"), 3900);
    const image = form.get("image");

    if (!title) return NextResponse.json({ error: "Enter an announcement title." }, { status: 400 });
    if (!message) return NextResponse.json({ error: "Enter an announcement message." }, { status: 400 });

    let imageUrl: string | null = null;
    if (image instanceof File && image.size > 0) {
      const extension = ALLOWED_IMAGE_TYPES.get(image.type);
      if (!extension) {
        return NextResponse.json({ error: "Images must be PNG, JPG, or WebP." }, { status: 400 });
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "Announcement images must be 4 MB or smaller." }, { status: 400 });
      }

      const date = new Date();
      const year = String(date.getUTCFullYear());
      const month = String(date.getUTCMonth() + 1).padStart(2, "0");
      uploadedPath = `${year}/${month}/${randomUUID()}.${extension}`;

      const bytes = Buffer.from(await image.arrayBuffer());
      const { error: uploadError } = await admin.storage
        .from("discord-announcements")
        .upload(uploadedPath, bytes, {
          contentType: image.type,
          cacheControl: "31536000",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = admin.storage
        .from("discord-announcements")
        .getPublicUrl(uploadedPath);
      imageUrl = publicUrlData.publicUrl;
    }

    const { data: result, error: sendError } = await admin.rpc("send_lscso_discord_announcement", {
      p_actor_profile_id: profile.id,
      p_title: title,
      p_message: message,
      p_image_url: imageUrl,
      p_image_path: uploadedPath,
    });

    if (sendError || !result?.ok) {
      if (uploadedPath) {
        await admin.storage.from("discord-announcements").remove([uploadedPath]);
      }
      throw sendError ?? new Error("Discord did not confirm the announcement.");
    }

    return NextResponse.json({
      success: true,
      messageId: result.message_id ?? null,
      channelId: result.channel_id,
      sentAt: result.sent_at,
      title,
      message,
      imageUrl,
      issuedBy: { displayName: profile.display_name, rank: profile.rank },
    });
  } catch (error) {
    console.error("LSCSO Discord announcement failed", error);
    return NextResponse.json({ error: "The announcement could not be sent to Discord. Please try again." }, { status: 500 });
  }
}
