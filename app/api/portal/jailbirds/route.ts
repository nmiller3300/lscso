import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { JAILBIRDS_BUCKET, JAILBIRDS_RETENTION_HOURS } from "../../../../lib/jailbirds";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 8 * 1024 * 1024;

function cleanText(value: FormDataEntryValue | null, max: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const fullName = cleanText(form.get("fullName"), 120);
  const bookingNumber = cleanText(form.get("bookingNumber"), 80);
  const charges = cleanText(form.get("charges"), 800);
  const arrestedAtRaw = cleanText(form.get("arrestedAt"), 80);
  const image = form.get("image");

  if (fullName.length < 2) {
    return NextResponse.json({ error: "A name is required." }, { status: 400 });
  }

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "An arrest photo is required." }, { status: 400 });
  }

  if (!allowedTypes.has(image.type) || image.size > maxBytes) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WEBP image under 8 MB." }, { status: 400 });
  }

  const arrestedAt = arrestedAtRaw ? new Date(arrestedAtRaw) : new Date();
  if (Number.isNaN(arrestedAt.getTime())) {
    return NextResponse.json({ error: "Arrest date is invalid." }, { status: 400 });
  }

  const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
  const imagePath = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${extension}`;
  const expiresAt = new Date(Date.now() + JAILBIRDS_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  const admin = createAdminClient() as any;

  const bytes = new Uint8Array(await image.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(JAILBIRDS_BUCKET)
    .upload(imagePath, bytes, { contentType: image.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: "Photo upload failed." }, { status: 500 });
  }

  const { data, error: insertError } = await admin
    .from("jailbirds")
    .insert({
      full_name: fullName,
      booking_number: bookingNumber || null,
      charges: charges || null,
      arrested_at: arrestedAt.toISOString(),
      image_path: imagePath,
      created_by: user.id,
      expires_at: expiresAt,
    })
    .select("id,expires_at")
    .single();

  if (insertError) {
    await admin.storage.from(JAILBIRDS_BUCKET).remove([imagePath]);
    return NextResponse.json({ error: "The Jailbirds entry could not be saved." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, expiresAt: data.expires_at }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: "Missing entry id." }, { status: 400 });

  const admin = createAdminClient() as any;
  const { data: record, error: lookupError } = await admin
    .from("jailbirds")
    .select("id,image_path")
    .eq("id", body.id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: "Unable to locate entry." }, { status: 500 });
  if (!record) return NextResponse.json({ error: "Entry not found." }, { status: 404 });

  const { error: storageError } = await admin.storage.from(JAILBIRDS_BUCKET).remove([record.image_path]);
  if (storageError) return NextResponse.json({ error: "Unable to remove photo." }, { status: 500 });

  const { error: deleteError } = await admin.from("jailbirds").delete().eq("id", body.id);
  if (deleteError) return NextResponse.json({ error: "Unable to remove entry." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
