import { randomInt } from "node:crypto";
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
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
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
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { admin, profile } = context;
  const { data: link, error: linkError } = await admin
    .from("fivem_identity_links")
    .select("citizen_id,linked_at,last_seen_at,last_seen_grade")
    .eq("personnel_profile_id", profile.id)
    .eq("active", true)
    .maybeSingle();

  if (linkError) {
    return NextResponse.json(
      { ok: false, error: "FiveM connection status could not be loaded." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      connected: Boolean(link),
      link: link
        ? {
            citizenId: link.citizen_id,
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
      { status: 401, headers: { "Cache-Control": "no-store" } },
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
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (existingLink) {
    return NextResponse.json(
      { ok: true, connected: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generatePairingCode();
    const codeHash = await hashPairingCode(code);
    const { data: expiresAt, error: insertError } = await admin.rpc("mobile_create_pairing", {
          p_profile_id: profile.id, p_code_hash: codeHash,
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
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  return NextResponse.json(
    { ok: false, error: "A unique pairing code could not be created. Try again." },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ok:false,error:"Invalid request origin."},{status:403});
  const context = await getAuthenticatedProfile();
  if (!context) return NextResponse.json({ok:false,error:"Sign in to disconnect your character."},{status:401});
  const { error } = await context.admin.rpc("mobile_disconnect_character", { p_profile_id: context.profile.id });
  return NextResponse.json(error ? {ok:false,error:"Could not disconnect the character."} : {ok:true}, {status:error?500:200,headers:{"Cache-Control":"no-store"}});
}
