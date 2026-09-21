import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "./auth";
import { isLscsoGrade, LSCSO_JOB_NAME } from "./ranks";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/lib/supabase/config";

export class MobileError extends Error {
  constructor(message: string, public status = 400, public code = "validation_error") { super(message); }
}
export const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export function fail(error: unknown) {
  if (error instanceof MobileError) return reply({ ok: false, error: error.message, code: error.code }, error.status);
  console.error("[LSCSO Mobile]", error);
  return reply({ ok: false, error: "The personnel service is unavailable. Please try again.", code: "backend_error" }, 500);
}
export function text(value: unknown, max = 2000) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
export function uuid(value: unknown) {
  const result = text(value, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new MobileError("Invalid record identifier.");
  return result;
}
export function integration(request: Request) {
  const result = authorizeFiveMIntegration(request);
  if (!result.ok) throw new MobileError(result.error, result.status, "integration_unavailable");
}
export function identity(body: Record<string, unknown>) {
  const citizenId = text(body.citizenId, 100), license = text(body.license, 160);
  if (!citizenId || !license || body.jobName !== LSCSO_JOB_NAME || !isLscsoGrade(body.jobGrade)) throw new MobileError("An active LSCSO character is required.", 403, "job_required");
  return { citizenId, license };
}
export function userClient(token?: string) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
  }) as any;
}
export async function verifyUser(token: string, body: Record<string, unknown>, requireLink = true) {
  const who = identity(body);
  const db = userClient(token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new MobileError("Please sign in again.", 401, "session_expired");
  const admin = createAdminClient() as any;
  const { data: profile, error: profileError } = await admin.from("personnel_profiles")
    .select("id,auth_user_id,personnel_id,display_name,greeting_name,rank,access_tier,call_sign,division,supervisor_label,status,credentials_assigned")
    .eq("auth_user_id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["Active", "Acting"].includes(profile.status)) throw new MobileError("This personnel account is not active.", 403, "profile_inactive");
  // Match the existing portal first-login requirement. Authorization comes from the live profile and RLS.
  if (data.user.user_metadata?.must_change_password === true) throw new MobileError("Complete your first password change on the website.", 403, "account_setup_required");
  const { data: link, error: linkError } = await admin.from("fivem_identity_links")
    .select("citizen_id,license_identifier,active").eq("personnel_profile_id", profile.id).eq("active", true).maybeSingle();
  if (linkError) throw linkError;
  if (link && (link.citizen_id !== who.citizenId || link.license_identifier !== who.license)) throw new MobileError("This account is linked to a different character. Disconnect it from Account connections on the website first.", 403, "identity_mismatch");
  if (requireLink && !link) throw new MobileError("Link this character before opening personnel records.", 403, "pairing_required");
  return { db, admin, profile, linked: Boolean(link), ...who };
}
export async function mobileContext(request: Request, body: Record<string, unknown>) {
  integration(request);
  const token = request.headers.get("x-lscso-user-token") ?? "";
  if (!token) throw new MobileError("Please sign in.", 401, "session_expired");
  return verifyUser(token, body);
}
export function checked<T = any>(result: { data: T; error: any }): T {
  if (result.error) throw new MobileError(result.error.message || "This action could not be completed.", result.error.code === "42501" ? 403 : 400);
  return result.data;
}
