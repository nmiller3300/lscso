import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;

async function hashPairingCode(code: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(code),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function generatePairingCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(values[0] % 1_000_000).padStart(6, "0");
}

async function getAuthenticatedProfile() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const admin = createAdminClient() as any;
  const { data: profile, error: profileError } = await admin
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,status")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    !["Active", "Acting"].includes(profile.status)
  ) {
    return null;
  }

  return { admin, profile };
}

export async function GET() {
  const context = await getAuthenticatedProfile();
  if (!context) {
    return NextResponse.json(
      { ok: false, error: "An active LSCSO portal session is required." },
      { status: 401 },
    );
  }

  const { admin, profile } = context;
  const { data: link, error: linkError } = await admin
    .from("fivem_identity_links")
    .select("linked_at,last_seen_at,last_seen_grade")
    .eq("personnel_profile_id", profile.id)
    .eq("active", true)
    .maybeSingle();

  if (linkError) {
    return NextResponse.json(
      { ok: false, error: "FiveM connection status could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      connected: Boolean(link),
      link: link
        ? {
            linkedAt: link.linked_at,
            lastSeenAt: link.last_seen_at,
            lastSeenGrade: link.last_seen_grade,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST() {
  const context = await getAuthenticatedProfile();
  if (!context) {
    return NextResponse.json(
      { ok: false, error: "An active LSCSO portal session is required." },
      { status: 401 },
    );
  }

  const { admin, profile } = context;

  const { data: existingLink, error: existingLinkError } = await admin
    .from("fivem_identity_links")
    .select("id")
    .eq("personnel_profile_id", profile.id)
    .eq("active", true)
    .maybeSingle();

  if (existingLinkError) {
    return NextResponse.json(
      { ok: false, error: "FiveM connection status could not be checked." },
      { status: 500 },
    );
  }

  if (existingLink) {
    return NextResponse.json(
      { ok: true, connected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + CODE_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  await admin
    .from("fivem_pairing_codes")
    .delete()
    .eq("personnel_profile_id", profile.id)
    .is("consumed_at", null);

  await admin
    .from("fivem_pairing_codes")
    .delete()
    .lt("expires_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generatePairingCode();
    const codeHash = await hashPairingCode(code);
    const { error: insertError } = await admin
      .from("fivem_pairing_codes")
      .insert({
        personnel_profile_id: profile.id,
        code_hash: codeHash,
        expires_at: expiresAt,
      });

    if (!insertError) {
      return NextResponse.json(
        {
          ok: true,
          connected: false,
          code,
          expiresAt,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    if (insertError.code !== "23505") {
      return NextResponse.json(
        { ok: false, error: "A FiveM pairing code could not be created." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { ok: false, error: "A unique pairing code could not be created. Try again." },
    { status: 503 },
  );
}
