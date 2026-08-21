import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const allowedTiers = new Set(["Executive", "Command", "Supervisor", "Preliminary"]);

type SearchProfile = {
  id: string;
  personnel_id: string;
  display_name: string;
  rank: string;
  call_sign: string | null;
};

function normalizeQuery(value: string | null) {
  return (value ?? "").trim().replace(/[(),]/g, " ").slice(0, 80);
}

function uniqueBy<T>(rows: T[], key: (row: T) => string) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const value = key(row);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

export async function GET(request: Request) {
  const profile = await getCurrentPortalProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowedTiers.has(profile.access_tier)) {
    return NextResponse.json({ error: "Search scope unavailable" }, { status: 403 });
  }

  const query = normalizeQuery(new URL(request.url).searchParams.get("q"));
  if (query.length < 2) {
    return NextResponse.json({ personnel: [], guardians: [], certifications: [], requests: [], awards: [], flags: [] });
  }

  const supabase = await createClient() as any;
  const pattern = `%${query}%`;

  const { data: personnelMatches } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,status")
    .or(`display_name.ilike.${pattern},personnel_id.ilike.${pattern},call_sign.ilike.${pattern},rank.ilike.${pattern},division.ilike.${pattern}`)
    .neq("status", "Deactivated")
    .limit(12);

  const matchingProfileIds = (personnelMatches ?? []).map((person: any) => person.id).filter(Boolean);

  const [guardianText, certText, requestText, awardText, flagText] = await Promise.all([
    supabase.from("guardian_records").select("id,guardian_number,title,record_type,status,subject_profile_id,author_profile_id,created_at").or(`title.ilike.${pattern},record_type.ilike.${pattern},status.ilike.${pattern}`).order("created_at", { ascending: false }).limit(10),
    supabase.from("certifications").select("id,profile_id,name,certificate_number,status,issued_on,created_at").or(`name.ilike.${pattern},certificate_number.ilike.${pattern},status.ilike.${pattern}`).order("created_at", { ascending: false }).limit(10),
    supabase.from("personnel_requests").select("id,request_number,request_type,status,subject,requester_profile_id,created_at").or(`request_type.ilike.${pattern},status.ilike.${pattern},subject.ilike.${pattern}`).order("created_at", { ascending: false }).limit(10),
    supabase.from("personnel_awards").select("id,profile_id,award_name,citation,awarded_on").or(`award_name.ilike.${pattern},citation.ilike.${pattern}`).order("awarded_on", { ascending: false }).limit(10),
    supabase.from("personnel_flags").select("id,profile_id,flag_type,notes,created_at,active").or(`flag_type.ilike.${pattern},notes.ilike.${pattern}`).order("created_at", { ascending: false }).limit(10),
  ]);

  const [guardianPeople, certPeople, requestPeople, awardPeople, flagPeople] = matchingProfileIds.length
    ? await Promise.all([
        supabase.from("guardian_records").select("id,guardian_number,title,record_type,status,subject_profile_id,author_profile_id,created_at").in("subject_profile_id", matchingProfileIds).order("created_at", { ascending: false }).limit(10),
        supabase.from("certifications").select("id,profile_id,name,certificate_number,status,issued_on,created_at").in("profile_id", matchingProfileIds).order("created_at", { ascending: false }).limit(10),
        supabase.from("personnel_requests").select("id,request_number,request_type,status,subject,requester_profile_id,created_at").in("requester_profile_id", matchingProfileIds).order("created_at", { ascending: false }).limit(10),
        supabase.from("personnel_awards").select("id,profile_id,award_name,citation,awarded_on").in("profile_id", matchingProfileIds).order("awarded_on", { ascending: false }).limit(10),
        supabase.from("personnel_flags").select("id,profile_id,flag_type,notes,created_at,active").in("profile_id", matchingProfileIds).order("created_at", { ascending: false }).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

  let guardianNumberMatches: any[] = [];
  const guardianNumber = Number(query.replace(/^g-/i, ""));
  if (Number.isInteger(guardianNumber) && guardianNumber > 0) {
    const { data } = await supabase
      .from("guardian_records")
      .select("id,guardian_number,title,record_type,status,subject_profile_id,author_profile_id,created_at")
      .eq("guardian_number", guardianNumber)
      .limit(4);
    guardianNumberMatches = data ?? [];
  }

  const guardiansRaw = uniqueBy([
    ...guardianNumberMatches,
    ...(guardianText.data ?? []),
    ...(guardianPeople.data ?? []),
  ], (record: any) => String(record.id ?? record.guardian_number)).slice(0, 10);

  const certsRaw = uniqueBy([...(certText.data ?? []), ...(certPeople.data ?? [])], (record: any) => String(record.id)).slice(0, 10);
  const requestsRaw = uniqueBy([...(requestText.data ?? []), ...(requestPeople.data ?? [])], (record: any) => String(record.id ?? record.request_number)).slice(0, 10);
  const awardsRaw = uniqueBy([...(awardText.data ?? []), ...(awardPeople.data ?? [])], (record: any) => String(record.id)).slice(0, 10);
  const flagsRaw = uniqueBy([...(flagText.data ?? []), ...(flagPeople.data ?? [])], (record: any) => String(record.id)).slice(0, 10);

  const relatedProfileIds = Array.from(new Set([
    ...matchingProfileIds,
    ...guardiansRaw.flatMap((record: any) => [record.subject_profile_id, record.author_profile_id]),
    ...certsRaw.map((record: any) => record.profile_id),
    ...requestsRaw.map((record: any) => record.requester_profile_id),
    ...awardsRaw.map((record: any) => record.profile_id),
    ...flagsRaw.map((record: any) => record.profile_id),
  ].filter(Boolean)));

  const { data: relatedProfiles } = relatedProfileIds.length
    ? await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign").in("id", relatedProfileIds)
    : { data: [] };

  const people = new Map<string, SearchProfile>(
    ((relatedProfiles ?? []) as SearchProfile[]).map((person) => [person.id, person]),
  );

  return NextResponse.json({
    personnel: (personnelMatches ?? []).map((person: any) => ({
      personnelId: person.personnel_id,
      label: person.display_name,
      detail: `${person.rank} · ${person.call_sign ?? person.personnel_id} · ${person.division}`,
      status: person.status,
      href: `/portal/command/personnel/${person.personnel_id}`,
    })),
    guardians: guardiansRaw.map((record: any) => ({
      guardianNumber: Number(record.guardian_number),
      title: record.title,
      type: record.record_type,
      status: record.status,
      subject: people.get(record.subject_profile_id)?.display_name ?? "Restricted personnel",
      href: `/portal/command/guardians/${record.guardian_number}`,
    })),
    certifications: certsRaw.map((cert: any) => ({
      id: cert.id,
      label: cert.name,
      detail: `${people.get(cert.profile_id)?.display_name ?? "Personnel"} · ${cert.certificate_number ?? "Pending number"}`,
      status: cert.status,
      href: "/portal/command/certifications",
    })),
    requests: requestsRaw.map((item: any) => ({
      id: item.id,
      requestNumber: Number(item.request_number),
      label: item.subject,
      detail: `${people.get(item.requester_profile_id)?.display_name ?? "Personnel"} · ${item.request_type}`,
      status: item.status,
      href: "/portal/command/approvals",
    })),
    awards: awardsRaw.map((award: any) => ({
      id: award.id,
      label: award.award_name,
      detail: `${people.get(award.profile_id)?.display_name ?? "Personnel"}${award.awarded_on ? ` · ${new Date(award.awarded_on).toLocaleDateString("en-US")}` : ""}`,
      status: "Award",
      href: "/portal/command/service-records",
    })),
    flags: flagsRaw.map((flag: any) => ({
      id: flag.id,
      label: flag.flag_type,
      detail: `${people.get(flag.profile_id)?.display_name ?? "Personnel"}${flag.notes ? ` · ${flag.notes}` : ""}`,
      status: flag.active ? "Active" : "Closed",
      href: "/portal/command/service-records",
    })),
  });
}
