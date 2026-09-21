import { fail, integration, MobileError, reply, text } from "@/lib/integrations/fivem/mobile";
import { createAdminClient } from "@/lib/supabase/admin";
import { LSCSO_GRADES } from "@/lib/integrations/fivem/ranks";

export const dynamic = "force-dynamic";

// Read current personnel state, never replay stale queued promotions or suspensions.
export async function POST(request: Request) {
  try {
    integration(request);
    const body = await request.json();
    if (!Array.isArray(body.characters) || body.characters.length > 100) throw new MobileError("Send at most 100 characters.");
    const characters = body.characters.map((row: any) => ({ citizenId: text(row?.citizenId, 100), license: text(row?.license, 160) })).filter((row: any) => row.citizenId && row.license);
    if (!characters.length) return reply({ ok: true, personnel: [] });
    const admin = createAdminClient() as any;
    const { data: links, error } = await admin.from("fivem_identity_links")
      .select("id,citizen_id,license_identifier,personnel_profile_id,active")
      .in("citizen_id", characters.map((row: any) => row.citizenId));
    if (error) throw error;
    const matched = (links ?? []).filter((link: any) => characters.some((row: any) => row.citizenId === link.citizen_id && row.license === link.license_identifier));
    const ids = matched.map((link: any) => link.personnel_profile_id);
    const { data: profiles, error: profileError } = ids.length ? await admin.from("personnel_profiles").select("id,rank,status,call_sign,division,updated_at").in("id", ids) : { data: [], error: null };
    if (profileError) throw profileError;
    const personnel = matched.flatMap((link: any) => {
      const profile = profiles?.find((row: any) => row.id === link.personnel_profile_id);
      if (!profile) return [];
      const grade = Object.entries(LSCSO_GRADES).find(([, rank]) => rank === profile.rank)?.[0];
      return [{ citizenId: link.citizen_id, linked: link.active, status: profile.status, grade: grade === undefined ? null : Number(grade), callSign: profile.call_sign, division: profile.division, updatedAt: profile.updated_at }];
    });
    // Last seen means a verified server contact, independent of whether the phone is open.
    if (matched.length) {
      const { error: updateError } = await admin.from("fivem_identity_links").update({ last_seen_at: new Date().toISOString() }).in("id", matched.map((link: any) => link.id));
      if (updateError) throw updateError;
    }
    return reply({ ok: true, personnel, syncedAt: new Date().toISOString() });
  } catch (error) { return fail(error); }
}
