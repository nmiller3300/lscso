import { randomInt } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const CODE_TTL_MINUTES = 10;

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function toInternalEmail(username: string) {
  return `${username.trim().toLowerCase()}@auth.lscso.internal`;
}

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

function noStore(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) {
    return noStore({ ok: false, error: authorization.error }, authorization.status);
  }

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const username = cleanString(body?.username, 80).toLowerCase();
  const password = cleanString(body?.password, 256);

  if (!username || !password) {
    return noStore(
      { ok: false, code: "invalid_credentials_request", error: "Username and password are required." },
      400,
    );
  }

  const auth = createSupabaseClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  try {
    const { data: authData, error: authError } = await auth.auth.signInWithPassword({
      email: toInternalEmail(username),
      password,
    });

    if (authError || !authData.user) {
      return noStore(
        { ok: false, code: "invalid_credentials", error: "The LSCSO username or password is incorrect." },
        401,
      );
    }

    if (authData.user.user_metadata?.must_change_password === true) {
      return noStore(
        {
          ok: false,
          code: "account_setup_required",
          error: "Complete your first-time password change before linking a FiveM character.",
        },
        403,
      );
    }

    const admin = createAdminClient() as any;
    const { data: profile, error: profileError } = await admin
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,rank,status")
      .eq("auth_user_id", authData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile || !["Active", "Acting"].includes(profile.status)) {
      return noStore(
        { ok: false, code: "profile_inactive", error: "This LSCSO personnel account is not active." },
        403,
      );
    }

    const { data: existingLink, error: existingLinkError } = await admin
      .from("fivem_identity_links")
      .select("citizen_id,linked_at,last_seen_at")
      .eq("personnel_profile_id", profile.id)
      .eq("active", true)
      .maybeSingle();

    if (existingLinkError) throw existingLinkError;
    if (existingLink) {
      return noStore({
        ok: true,
        connected: true,
        account: {
          personnelId: profile.personnel_id,
          displayName: profile.display_name,
          rank: profile.rank,
        },
      });
    }

  for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generatePairingCode();
      const codeHash = await hashPairingCode(code);
      const { data: expiresAt, error: insertError } = await admin.rpc("mobile_create_pairing", {
          p_profile_id: profile.id, p_code_hash: codeHash,
        });

      if (!insertError) {
        return noStore({
          ok: true,
          connected: false,
          code,
          expiresAt,
          account: {
            personnelId: profile.personnel_id,
            displayName: profile.display_name,
            rank: profile.rank,
          },
        });
      }

      if (insertError.code !== "23505") {
        throw insertError;
      }
    }

    return noStore(
      { ok: false, code: "pairing_code_unavailable", error: "A unique pairing code could not be created. Try again." },
      503,
    );
  } catch (error) {
    console.error("[FiveM mobile pairing] failure", error);
    return noStore(
      { ok: false, code: "backend_error", error: "LSCSO mobile pairing failed." },
      500,
    );
  } finally {
    await auth.auth.signOut().catch(() => undefined);
  }
}
