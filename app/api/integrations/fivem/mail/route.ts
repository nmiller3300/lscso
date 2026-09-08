import { NextResponse } from "next/server";
import { authorizeFiveMIntegration } from "@/lib/integrations/fivem/auth";
import { isLscsoGrade, LSCSO_JOB_NAME } from "@/lib/integrations/fivem/ranks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAIL_DOMAIN = "lscso.gov";
const SYSTEM_ADDRESS = `noreply@${MAIL_DOMAIN}`;
const MAIL_ADMIN_RANKS = new Set(["Sheriff", "Undersheriff", "Major"]);

type Profile = {
  id: string;
  username: string;
  display_name: string;
  greeting_name: string;
  rank: string;
  call_sign: string | null;
  personnel_id: string;
  status: string;
};

type Recipient = {
  profileId: string;
  address: string;
  type: "to" | "cc" | "bcc" | "group";
  deliveredVia?: string;
};

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanAddress(value: unknown) {
  const address = cleanString(value, 96).toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{1,62}@lscso\.gov$/.test(address) ? address : "";
}

function personalAddress(username: string) {
  return `${username.trim().toLowerCase()}@${MAIL_DOMAIN}`;
}

function parseAddressList(value: unknown, max = 30) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  return [...new Set(raw.map(cleanAddress).filter(Boolean))].slice(0, max);
}

function isMailAdmin(profile: Profile) {
  return MAIL_ADMIN_RANKS.has(profile.rank) || ["sheriff.miller", "m.white"].includes(profile.username.toLowerCase());
}

async function resolveIdentity(admin: any, body: Record<string, unknown>) {
  const citizenId = cleanString(body.citizenId, 100);
  const license = cleanString(body.license, 160);
  const jobName = cleanString(body.jobName, 64).toLowerCase();
  const jobGrade = Number(body.jobGrade);

  if (!citizenId || !license || jobName !== LSCSO_JOB_NAME || !isLscsoGrade(jobGrade)) {
    return { error: "Active LSCSO workstation identity is required.", code: "invalid_lscso_identity", status: 403 } as const;
  }

  const { data: link, error: linkError } = await admin
    .from("fivem_identity_links")
    .select("id,personnel_profile_id,license_identifier,active")
    .eq("citizen_id", citizenId)
    .eq("active", true)
    .maybeSingle();
  if (linkError) throw linkError;
  if (!link) return { error: "This character is not linked to a Personnel Portal account.", code: "identity_not_linked", status: 403 } as const;
  if (link.license_identifier && link.license_identifier !== license) {
    return { error: "The linked FiveM identity does not match this character license.", code: "identity_mismatch", status: 403 } as const;
  }

  const { data: profile, error: profileError } = await admin
    .from("personnel_profiles")
    .select("id,username,display_name,greeting_name,rank,call_sign,personnel_id,status")
    .eq("id", link.personnel_profile_id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !profile.username || !["Active", "Acting"].includes(profile.status)) {
    return { error: "Your Personnel Portal account is not active or does not have a username.", code: "profile_unavailable", status: 403 } as const;
  }

  await admin.from("fivem_identity_links").update({
    license_identifier: license,
    last_seen_at: new Date().toISOString(),
    last_seen_grade: jobGrade,
    updated_at: new Date().toISOString(),
  }).eq("id", link.id);

  return { profile: profile as Profile, status: 200 } as const;
}

async function getDirectory(admin: any) {
  const [{ data: profiles, error: profilesError }, { data: groups, error: groupsError }] = await Promise.all([
    admin.from("personnel_profiles")
      .select("id,username,display_name,rank,call_sign,personnel_id,status")
      .in("status", ["Active", "Acting"])
      .not("username", "is", null)
      .order("display_name"),
    admin.from("lscso_mail_groups")
      .select("id,address,display_name,description,group_type,send_policy,active")
      .eq("active", true)
      .order("address"),
  ]);
  if (profilesError) throw profilesError;
  if (groupsError) throw groupsError;
  return {
    people: (profiles || []).map((p: any) => ({
      id: p.id,
      username: p.username,
      email: personalAddress(p.username),
      displayName: p.display_name,
      rank: p.rank,
      callSign: p.call_sign,
      personnelId: p.personnel_id,
    })),
    groups: groups || [],
  };
}

async function getGroupMembership(admin: any) {
  const { data, error } = await admin
    .from("lscso_mail_group_members")
    .select("id,group_id,profile_id,role,created_at")
    .order("created_at");
  if (error) throw error;
  return data || [];
}

async function loadMailbox(admin: any, profile: Profile) {
  const [{ data: deliveries, error: deliveryError }, { data: sentRows, error: sentError }, directory, memberships] = await Promise.all([
    admin.from("lscso_mail_deliveries")
      .select("id,message_id,recipient_address,delivery_type,delivered_via,folder,is_read,read_at,created_at")
      .eq("recipient_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(150),
    admin.from("lscso_mail_messages")
      .select("id,sender_address,sender_name,subject,body,system_message,reply_to_message_id,metadata,sent_at")
      .eq("sender_profile_id", profile.id)
      .order("sent_at", { ascending: false })
      .limit(100),
    getDirectory(admin),
    getGroupMembership(admin),
  ]);
  if (deliveryError) throw deliveryError;
  if (sentError) throw sentError;

  const messageIds = [...new Set((deliveries || []).map((d: any) => d.message_id))];
  let messages: any[] = [];
  if (messageIds.length) {
    const { data, error } = await admin.from("lscso_mail_messages")
      .select("id,sender_address,sender_name,subject,body,system_message,reply_to_message_id,metadata,sent_at")
      .in("id", messageIds);
    if (error) throw error;
    messages = data || [];
  }
  const byId = new Map(messages.map((m: any) => [m.id, m]));
  const inbox = (deliveries || []).map((d: any) => ({ ...d, message: byId.get(d.message_id) || null }));
  const unread = inbox.filter((d: any) => d.folder === "inbox" && !d.is_read).length;

  const groupMap = new Map((directory.groups || []).map((g: any) => [g.id, { ...g, members: [] as any[] }]));
  for (const membership of memberships) {
    const group = groupMap.get(membership.group_id);
    if (!group) continue;
    const person = directory.people.find((p: any) => p.id === membership.profile_id);
    if (person) group.members.push({ ...person, role: membership.role });
  }

  const managedSendAs = [...groupMap.values()]
    .filter((group: any) => isMailAdmin(profile) || group.members.some((m: any) => m.id === profile.id && m.role === "manager"))
    .map((group: any) => ({ address: group.address, displayName: group.display_name, type: group.group_type }));

  return {
    account: {
      username: profile.username,
      email: personalAddress(profile.username),
      displayName: profile.display_name,
      rank: profile.rank,
      callSign: profile.call_sign,
      personnelId: profile.personnel_id,
      canManageMail: isMailAdmin(profile),
      sendAs: [{ address: personalAddress(profile.username), displayName: profile.display_name, type: "personal" }, ...managedSendAs],
    },
    unread,
    inbox,
    sent: sentRows || [],
    directory,
    groups: [...groupMap.values()],
    systemAddress: SYSTEM_ADDRESS,
  };
}

async function canSendToGroup(admin: any, profile: Profile, group: any) {
  if (group.send_policy === "any_lscso" || isMailAdmin(profile)) return true;
  const { data, error } = await admin.from("lscso_mail_group_members")
    .select("role")
    .eq("group_id", group.id)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return false;
  return group.send_policy === "members" || (group.send_policy === "managers" && data.role === "manager");
}

async function resolveRecipients(admin: any, profile: Profile, addresses: string[], type: "to" | "cc" | "bcc") {
  const recipients: Recipient[] = [];
  for (const address of addresses) {
    const username = address.slice(0, -(`@${MAIL_DOMAIN}`).length);
    const { data: person, error: personError } = await admin.from("personnel_profiles")
      .select("id,username,status")
      .ilike("username", username)
      .in("status", ["Active", "Acting"])
      .maybeSingle();
    if (personError) throw personError;
    if (person?.username && personalAddress(person.username) === address) {
      recipients.push({ profileId: person.id, address, type });
      continue;
    }

    const { data: group, error: groupError } = await admin.from("lscso_mail_groups")
      .select("id,address,display_name,send_policy,active")
      .eq("address", address)
      .eq("active", true)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) throw new Error(`Unknown LSCSO address: ${address}`);
    if (!(await canSendToGroup(admin, profile, group))) throw new Error(`You are not authorized to send to ${address}.`);

    const { data: members, error: membersError } = await admin.from("lscso_mail_group_members")
      .select("profile_id")
      .eq("group_id", group.id);
    if (membersError) throw membersError;
    if (!members?.length) throw new Error(`${address} has no recipients.`);
    for (const member of members) {
      const { data: memberProfile, error: memberError } = await admin.from("personnel_profiles")
        .select("id,username,status")
        .eq("id", member.profile_id)
        .in("status", ["Active", "Acting"])
        .maybeSingle();
      if (memberError) throw memberError;
      if (memberProfile?.username) {
        recipients.push({
          profileId: memberProfile.id,
          address: personalAddress(memberProfile.username),
          type: "group",
          deliveredVia: address,
        });
      }
    }
  }
  return recipients;
}

async function resolveFromAddress(admin: any, profile: Profile, requested: string) {
  const personal = personalAddress(profile.username);
  if (!requested || requested === personal) return { address: personal, name: profile.display_name };
  if (requested === SYSTEM_ADDRESS) throw new Error("noreply@lscso.gov is reserved for trusted system automation.");

  const { data: group, error } = await admin.from("lscso_mail_groups")
    .select("id,address,display_name,active")
    .eq("address", requested)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!group) throw new Error("The requested sender address does not exist.");
  if (!isMailAdmin(profile)) {
    const { data: membership, error: membershipError } = await admin.from("lscso_mail_group_members")
      .select("role")
      .eq("group_id", group.id)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership || membership.role !== "manager") throw new Error("You are not authorized to send as this address.");
  }
  return { address: group.address, name: group.display_name };
}

async function sendMessage(admin: any, profile: Profile, body: Record<string, unknown>) {
  const to = parseAddressList(body.to);
  const cc = parseAddressList(body.cc, 20);
  const bcc = parseAddressList(body.bcc, 20);
  const subject = cleanString(body.subject, 200);
  const messageBody = typeof body.body === "string" ? body.body.trim().slice(0, 20000) : "";
  if (!to.length) throw new Error("At least one LSCSO recipient is required.");
  if (!subject || !messageBody) throw new Error("Subject and message body are required.");

  const from = await resolveFromAddress(admin, profile, cleanAddress(body.from));
  const resolved = [
    ...(await resolveRecipients(admin, profile, to, "to")),
    ...(await resolveRecipients(admin, profile, cc, "cc")),
    ...(await resolveRecipients(admin, profile, bcc, "bcc")),
  ];
  const deduped = new Map<string, Recipient>();
  for (const recipient of resolved) if (!deduped.has(recipient.profileId)) deduped.set(recipient.profileId, recipient);
  if (!deduped.size) throw new Error("No active LSCSO recipients were resolved.");

  const { data: message, error: messageError } = await admin.from("lscso_mail_messages").insert({
    sender_profile_id: profile.id,
    sender_address: from.address,
    sender_name: from.name,
    subject,
    body: messageBody,
    system_message: false,
    metadata: { to, cc, bccCount: bcc.length },
  }).select("id").single();
  if (messageError) throw messageError;

  const deliveries = [...deduped.values()].map((recipient) => ({
    message_id: message.id,
    recipient_profile_id: recipient.profileId,
    recipient_address: recipient.address,
    delivery_type: recipient.type,
    delivered_via: recipient.deliveredVia || null,
  }));
  const { error: deliveryError } = await admin.from("lscso_mail_deliveries").insert(deliveries);
  if (deliveryError) {
    await admin.from("lscso_mail_messages").delete().eq("id", message.id);
    throw deliveryError;
  }
  await admin.from("lscso_mail_audit").insert({
    actor_profile_id: profile.id,
    event_type: "message_sent",
    target_address: to.join(","),
    message_id: message.id,
    details: { from: from.address, recipientCount: deliveries.length },
  });
  return message.id;
}

async function assertGroupManager(admin: any, profile: Profile, groupId: string) {
  if (isMailAdmin(profile)) return;
  const { data, error } = await admin.from("lscso_mail_group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.role !== "manager") throw new Error("Mail group management access is required.");
}

export async function POST(request: Request) {
  const authorization = authorizeFiveMIntegration(request);
  if (!authorization.ok) return NextResponse.json({ ok: false, error: authorization.error }, { status: authorization.status });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, code: "invalid_request", error: "Invalid mail request." }, { status: 400 });

  const admin = createAdminClient() as any;
  try {
    const identity = await resolveIdentity(admin, body);
    if (!("profile" in identity)) {
      return NextResponse.json({ ok: false, code: identity.code, error: identity.error }, { status: identity.status, headers: { "Cache-Control": "no-store" } });
    }
    const profile = identity.profile;
    const action = cleanString(body.action, 40).toLowerCase() || "read";

    if (action === "send") {
      const messageId = await sendMessage(admin, profile, body);
      return NextResponse.json({ ok: true, messageId, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "mark_read") {
      const deliveryId = cleanString(body.deliveryId, 80);
      if (!deliveryId) throw new Error("Delivery ID is required.");
      const { error } = await admin.from("lscso_mail_deliveries").update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", deliveryId).eq("recipient_profile_id", profile.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "move") {
      const deliveryId = cleanString(body.deliveryId, 80);
      const folder = cleanString(body.folder, 20).toLowerCase();
      if (!deliveryId || !["inbox", "archive", "trash"].includes(folder)) throw new Error("A valid destination folder is required.");
      const { error } = await admin.from("lscso_mail_deliveries").update({ folder })
        .eq("id", deliveryId).eq("recipient_profile_id", profile.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "create_group") {
      if (!isMailAdmin(profile)) throw new Error("Mail administrator access is required.");
      let address = cleanString(body.address, 80).toLowerCase();
      if (address && !address.includes("@")) address = `${address}@${MAIL_DOMAIN}`;
      address = cleanAddress(address);
      if (!address || address === SYSTEM_ADDRESS) throw new Error("Choose a valid @lscso.gov group address.");
      const displayName = cleanString(body.displayName, 120);
      const description = cleanString(body.description, 1000);
      const groupType = cleanString(body.groupType, 20).toLowerCase();
      const sendPolicy = cleanString(body.sendPolicy, 20).toLowerCase();
      if (!displayName) throw new Error("Group display name is required.");
      if (!["distribution", "shared"].includes(groupType)) throw new Error("Invalid mail group type.");
      if (!["any_lscso", "members", "managers"].includes(sendPolicy)) throw new Error("Invalid sending policy.");
      const { data: group, error } = await admin.from("lscso_mail_groups").insert({
        address, display_name: displayName, description: description || null, group_type: groupType,
        send_policy: sendPolicy, created_by: profile.id,
      }).select("id").single();
      if (error) throw error;
      await admin.from("lscso_mail_group_members").insert({ group_id: group.id, profile_id: profile.id, role: "manager", added_by: profile.id });
      await admin.from("lscso_mail_audit").insert({ actor_profile_id: profile.id, event_type: "group_created", target_address: address, details: { groupType, sendPolicy } });
      return NextResponse.json({ ok: true, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "update_group") {
      const groupId = cleanString(body.groupId, 80);
      if (!groupId) throw new Error("Group ID is required.");
      await assertGroupManager(admin, profile, groupId);
      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const displayName = cleanString(body.displayName, 120);
      if (displayName) update.display_name = displayName;
      if (typeof body.description === "string") update.description = cleanString(body.description, 1000) || null;
      const sendPolicy = cleanString(body.sendPolicy, 20).toLowerCase();
      if (sendPolicy) {
        if (!["any_lscso", "members", "managers"].includes(sendPolicy)) throw new Error("Invalid sending policy.");
        update.send_policy = sendPolicy;
      }
      if (typeof body.active === "boolean") update.active = body.active;
      const { error } = await admin.from("lscso_mail_groups").update(update).eq("id", groupId);
      if (error) throw error;
      await admin.from("lscso_mail_audit").insert({ actor_profile_id: profile.id, event_type: "group_updated", details: { groupId } });
      return NextResponse.json({ ok: true, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "set_group_members") {
      const groupId = cleanString(body.groupId, 80);
      if (!groupId) throw new Error("Group ID is required.");
      await assertGroupManager(admin, profile, groupId);
      const requested = Array.isArray(body.members) ? body.members.slice(0, 100) : [];
      const rows: any[] = [];
      for (const item of requested) {
        if (!item || typeof item !== "object") continue;
        const profileId = cleanString((item as any).profileId, 80);
        const role = cleanString((item as any).role, 20).toLowerCase();
        if (!profileId || !["member", "manager"].includes(role)) continue;
        const { data: memberProfile, error: memberError } = await admin.from("personnel_profiles")
          .select("id,status")
          .eq("id", profileId)
          .in("status", ["Active", "Acting"])
          .maybeSingle();
        if (memberError) throw memberError;
        if (memberProfile) rows.push({ group_id: groupId, profile_id: memberProfile.id, role, added_by: profile.id });
      }
      const { error: deleteError } = await admin.from("lscso_mail_group_members").delete().eq("group_id", groupId);
      if (deleteError) throw deleteError;
      if (rows.length) {
        const { error: insertError } = await admin.from("lscso_mail_group_members").insert(rows);
        if (insertError) throw insertError;
      }
      await admin.from("lscso_mail_audit").insert({ actor_profile_id: profile.id, event_type: "group_members_replaced", details: { groupId, memberCount: rows.length } });
      return NextResponse.json({ ok: true, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action !== "read") throw new Error("Unknown mail action.");
    return NextResponse.json({ ok: true, mail: await loadMailbox(admin, profile) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "LSCSO mail service failed.";
    return NextResponse.json({ ok: false, code: "mail_error", error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
