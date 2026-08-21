export type NotificationCategory = "Personnel" | "Guardians" | "Requests" | "Training" | "System";
export type NotificationPriority = "Critical" | "High" | "Normal" | "Low";

export function classifyNotification(type: string, title = "", message = ""): NotificationCategory {
  const value = `${type} ${title} ${message}`.toLowerCase();
  if (value.includes("guardian") || value.includes("disciplin") || value.includes("commendation")) return "Guardians";
  if (value.includes("request") || value.includes("leave") || value.includes("loa") || value.includes("promotion") || value.includes("transfer")) return "Requests";
  if (value.includes("cert") || value.includes("training") || value.includes("fto") || value.includes("academy")) return "Training";
  if (value.includes("personnel") || value.includes("account") || value.includes("credential") || value.includes("call sign") || value.includes("rank") || value.includes("assignment")) return "Personnel";
  return "System";
}

export function classifyNotificationPriority(type: string, title = "", message = ""): NotificationPriority {
  const value = `${type} ${title} ${message}`.toLowerCase();
  if (value.includes("emergency") || value.includes("critical")) return "Critical";
  if (value.includes("overdue") || value.includes("suspend") || value.includes("deactivat") || value.includes("denied") || value.includes("revoked")) return "High";
  if (value.includes("approval") || value.includes("acknowledg") || value.includes("request") || value.includes("follow-up") || value.includes("follow up")) return "Normal";
  return "Low";
}

/**
 * This metadata contract is intentionally delivery-channel agnostic.
 * Portal inbox rendering uses it now; future Discord embeds can consume the
 * same category/priority/source information instead of inventing a second
 * notification taxonomy.
 */
export type DepartmentNotificationEvent = {
  eventKey: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  href?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  subjectProfileId?: string | null;
  actorProfileId?: string | null;
};
