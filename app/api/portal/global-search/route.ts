import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const departmentSearchRanks = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

function normalizeQuery(value: string | null) {
  return (value ?? "").trim().replace(/[(),]/g, " ").slice(0, 80);
}

export async function GET(request: Request) {
  const profile = await getCurrentPortalProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!departmentSearchRanks.has(profile.rank)) {
    return NextResponse.json({ error: "Search scope unavailable" }, { status: 403 });
  }

  const query = normalizeQuery(new URL(request.url).searchParams.get("q"));
  if (query.length < 2) return NextResponse.json({ personnel: [], guardians: [], certifications: [], requests: [] });

  const supabase = await createClient() as any;
  const pattern = `%${query}%`;

  const [personnelResult, guardianResult, certificationResult, requestResult] = await Promise.all([
    supabase
      .from("personnel_profiles")
      .select("personnel_id,display_name,rank,call_sign,division,status")
      .or(`display_name.ilike.${pattern},personnel_id.ilike.${pattern},call_sign.ilike.${pattern},rank.ilike.${pattern},division.ilike.${pattern}`)
      .neq("status", "Deactivated")
      .limit(8),
    supabase
      .from("guardian_records")
      .select("guardian_number,title,record_type,status,subject_profile_id,author_profile_id,created_at")
      .or(`title.ilike.${pattern},record_type.ilike.${pattern},status.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("certifications")
      .select("id,profile_id,name,certificate_number,status,issued_on")
      .or(`name.ilike.${pattern},certificate_number.ilike.${pattern},status.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("personnel_requests")
      .select("request_number,request_type,status,subject,requester_profile_id,created_at")
      .or(`request_type.ilike.${pattern},status.ilike.${pattern},subject.ilike.${pattern}`)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const relatedProfileIds = Array.from(new Set([
    ...(guardianResult.data ?? []).flatMap((record:any) => [record.subject_profile_id, record.author_profile_id]),
    ...(certificationResult.data ?? []).map((record:any) => record.profile_id),
    ...(requestResult.data ?? []).map((record:any) => record.requester_profile_id),
  ].filter(Boolean)));

  const { data: relatedProfiles } = relatedProfileIds.length
    ? await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign").in("id", relatedProfileIds)
    : { data: [] };

  const people = new Map((relatedProfiles ?? []).map((person:any) => [person.id, person]));

  // Guardian numbers and personnel names are common lookup terms but cannot be
  // expressed safely in the same PostgREST text filter. Add exact/related matches.
  let guardianNumberMatches:any[] = [];
  const guardianNumber = Number(query.replace(/^g-/i, ""));
  if (Number.isInteger(guardianNumber) && guardianNumber > 0) {
    const { data } = await supabase
      .from("guardian_records")
      .select("guardian_number,title,record_type,status,subject_profile_id,author_profile_id,created_at")
      .eq("guardian_number", guardianNumber)
      .limit(4);
    guardianNumberMatches = data ?? [];
  }

  const guardians = [...guardianNumberMatches, ...(guardianResult.data ?? [])]
    .filter((record:any, index:number, rows:any[]) => rows.findIndex((candidate:any) => candidate.guardian_number === record.guardian_number) === index)
    .slice(0, 8)
    .map((record:any) => ({
      guardianNumber: Number(record.guardian_number),
      title: record.title,
      type: record.record_type,
      status: record.status,
      subject: people.get(record.subject_profile_id)?.display_name ?? "Restricted personnel",
      href: `/portal/command/guardians/${record.guardian_number}`,
    }));

  return NextResponse.json({
    personnel: (personnelResult.data ?? []).map((person:any) => ({
      personnelId: person.personnel_id,
      label: person.display_name,
      detail: `${person.rank} · ${person.call_sign ?? person.personnel_id} · ${person.division}`,
      status: person.status,
      href: `/portal/command/personnel/${person.personnel_id}`,
    })),
    guardians,
    certifications: (certificationResult.data ?? []).map((cert:any) => ({
      id: cert.id,
      label: cert.name,
      detail: `${people.get(cert.profile_id)?.display_name ?? "Personnel"} · ${cert.certificate_number ?? "Pending number"}`,
      status: cert.status,
      href: "/portal/command/certifications",
    })),
    requests: (requestResult.data ?? []).map((item:any) => ({
      requestNumber: Number(item.request_number),
      label: item.subject,
      detail: `${people.get(item.requester_profile_id)?.display_name ?? "Personnel"} · ${item.request_type}`,
      status: item.status,
      href: "/portal/command/approvals",
    })),
  });
}
