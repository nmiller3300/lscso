import { createAdminClient } from "@/lib/supabase/admin";

const DOMAIN = "lscso.gov";
export const LSCSO_NOREPLY_ADDRESS = `noreply@${DOMAIN}`;

function profileAddress(username: string) {
  return `${username.trim().toLowerCase()}@${DOMAIN}`;
}

export type SystemMailRequest = {
  subject: string;
  body: string;
  toProfileIds?: string[];
  toGroupAddresses?: string[];
  automationKey: string;
  metadata?: Record<string, unknown>;
};

export async function sendSystemMail(request: SystemMailRequest) {
  const admin = createAdminClient() as any;
  const subject = request.subject.trim().slice(0, 200);
  const body = request.body.trim().slice(0, 20000);
  const automationKey = request.automationKey.trim().slice(0, 120);
  if (!subject || !body || !automationKey) throw new Error("System mail requires subject, body, and automationKey.");

  const recipients = new Map<string, { profileId: string; address: string; deliveredVia?: string }>();
  const directIds = [...new Set((request.toProfileIds || []).filter(Boolean))].slice(0, 250);
  if (directIds.length) {
    const { data, error } = await admin.from("personnel_profiles")
      .select("id,username,status")
      .in("id", directIds)
      .in("status", ["Active", "Acting"])
      .not("username", "is", null);
    if (error) throw error;
    for (const profile of data || []) recipients.set(profile.id, { profileId: profile.id, address: profileAddress(profile.username) });
  }

  const groups = [...new Set((request.toGroupAddresses || []).map((value) => value.trim().toLowerCase()).filter(Boolean))].slice(0, 50);
  for (const address of groups) {
    const { data: group, error: groupError } = await admin.from("lscso_mail_groups")
      .select("id,address,active")
      .eq("address", address)
      .eq("active", true)
      .maybeSingle();
    if (groupError) throw groupError;
    if (!group) continue;

    const { data: memberships, error: membershipError } = await admin.from("lscso_mail_group_members")
      .select("profile_id")
      .eq("group_id", group.id);
    if (membershipError) throw membershipError;
    const ids = (memberships || []).map((row: any) => row.profile_id);
    if (!ids.length) continue;

    const { data: profiles, error: profilesError } = await admin.from("personnel_profiles")
      .select("id,username,status")
      .in("id", ids)
      .in("status", ["Active", "Acting"])
      .not("username", "is", null);
    if (profilesError) throw profilesError;
    for (const profile of profiles || []) {
      if (!recipients.has(profile.id)) recipients.set(profile.id, { profileId: profile.id, address: profileAddress(profile.username), deliveredVia: group.address });
    }
  }

  if (!recipients.size) return { ok: false, delivered: 0, reason: "no_recipients" } as const;

  const { data: message, error: messageError } = await admin.from("lscso_mail_messages").insert({
    sender_profile_id: null,
    sender_address: LSCSO_NOREPLY_ADDRESS,
    sender_name: "LSCSO Automated Services",
    subject,
    body,
    system_message: true,
    metadata: { automationKey, ...(request.metadata || {}) },
  }).select("id").single();
  if (messageError) throw messageError;

  const deliveries = [...recipients.values()].map((recipient) => ({
    message_id: message.id,
    recipient_profile_id: recipient.profileId,
    recipient_address: recipient.address,
    delivery_type: recipient.deliveredVia ? "group" : "to",
    delivered_via: recipient.deliveredVia || null,
  }));
  const { error: deliveryError } = await admin.from("lscso_mail_deliveries").insert(deliveries);
  if (deliveryError) {
    await admin.from("lscso_mail_messages").delete().eq("id", message.id);
    throw deliveryError;
  }

  await admin.from("lscso_mail_audit").insert({
    actor_profile_id: null,
    event_type: "automation_sent",
    target_address: groups.join(",") || null,
    message_id: message.id,
    details: { automationKey, recipientCount: deliveries.length, ...(request.metadata || {}) },
  });

  return { ok: true, messageId: message.id, delivered: deliveries.length } as const;
}
