import { fail, identity, integration, MobileError, reply, text, userClient, verifyUser } from "@/lib/integrations/fivem/mobile";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let auth: any;
  let keepSession = false;
  try {
    integration(request);
    const body = await request.json();
    identity(body);
    if (body.action === "logout") {
      const token = request.headers.get("x-lscso-user-token");
      if (token) {
        const { createAdminClient } = await import("@/lib/supabase/admin");
        await createAdminClient().auth.admin.signOut(token, "local");
      }
      return reply({ ok: true });
    }
    auth = userClient();
    const username = text(body.username, 80).toLowerCase();
    // Passwords are never trimmed, persisted, logged, or sent back to the phone.
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || password.length > 256) throw new MobileError("Enter your portal username and password.");
    const { data, error } = await auth.auth.signInWithPassword({ email: `${username}@auth.lscso.internal`, password });
    if (error || !data.session) throw new MobileError("The username or password is incorrect.", 401, "invalid_credentials");
    const context = await verifyUser(data.session.access_token, body, false);
    if (!context.linked) {
      if (body.linkCharacter !== true) throw new MobileError("Confirm that you want to link this LSCSO character to your account.", 409, "pairing_required");
      const { error: linkError } = await context.admin.rpc("mobile_link_character", {
        p_profile_id: context.profile.id, p_citizen_id: context.citizenId, p_license: context.license, p_grade: body.jobGrade,
      });
      if (linkError) throw new MobileError(linkError.message, 409, "pairing_failed");
    }
    keepSession = true;
    // This response is consumed only by the FiveM server, which strips accessToken before replying to NUI.
    return reply({ ok: true, accessToken: data.session.access_token, expiresAt: data.session.expires_at, profile: context.profile });
  } catch (error) { return fail(error); }
  finally { if (auth && !keepSession) await auth.auth.signOut({ scope: "local" }).catch(() => undefined); }
}
