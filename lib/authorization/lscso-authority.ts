export type LscsoRank =
  | "Sheriff"
  | "Undersheriff"
  | "Major"
  | "Captain"
  | "1st Lieutenant"
  | "Lieutenant"
  | "Sergeant"
  | "Corporal"
  | "Master Deputy"
  | "Deputy III"
  | "Deputy II"
  | "Deputy"
  | "Recruit";

export type AuthorityTier = "Executive" | "Command" | "Supervisor" | "Preliminary" | "Deputy";

export const rankLevel: Record<LscsoRank, number> = {
  Sheriff: 130,
  Undersheriff: 120,
  Major: 110,
  Captain: 100,
  "1st Lieutenant": 90,
  Lieutenant: 80,
  Sergeant: 70,
  Corporal: 60,
  "Master Deputy": 50,
  "Deputy III": 40,
  "Deputy II": 30,
  Deputy: 20,
  Recruit: 10,
};

export const rankTier: Record<LscsoRank, AuthorityTier> = {
  Sheriff: "Executive",
  Undersheriff: "Executive",
  Major: "Command",
  Captain: "Command",
  "1st Lieutenant": "Command",
  Lieutenant: "Supervisor",
  Sergeant: "Supervisor",
  Corporal: "Preliminary",
  "Master Deputy": "Deputy",
  "Deputy III": "Deputy",
  "Deputy II": "Deputy",
  Deputy: "Deputy",
  Recruit: "Deputy",
};

export type PersonnelCapability =
  | "view_self_record"
  | "view_personnel_summary"
  | "view_personnel_record"
  | "view_sensitive_personnel_documents"
  | "upload_personnel_document"
  | "create_guardian"
  | "review_guardian"
  | "approve_guardian"
  | "add_personnel_flag"
  | "request_certification"
  | "issue_certification"
  | "remove_certification"
  | "add_training_record"
  | "evaluate_trainee"
  | "manage_assignment"
  | "manage_supervisory_authority"
  | "review_leave_request"
  | "award_medal"
  | "correct_permanent_record"
  | "manage_account_access"
  | "view_audit_log";

export type AuthorityScope =
  | "self"
  | "direct"
  | "unit"
  | "command_chain"
  | "training"
  | "temporary"
  | "department";

export type AuthorityContext = {
  actorId: string;
  targetId: string;
  actorRank: LscsoRank;
  actorTier: AuthorityTier;
  scopes: AuthorityScope[];
  targetIsExecutive?: boolean;
};

const executiveOnly = new Set<PersonnelCapability>([
  "award_medal",
  "correct_permanent_record",
  "manage_account_access",
]);

const commandFinalAuthority = new Set<PersonnelCapability>([
  "approve_guardian",
  "issue_certification",
  "remove_certification",
  "review_leave_request",
  "manage_assignment",
]);

const supervisoryActions = new Set<PersonnelCapability>([
  "create_guardian",
  "review_guardian",
  "add_personnel_flag",
  "request_certification",
  "upload_personnel_document",
]);

const trainingActions = new Set<PersonnelCapability>([
  "request_certification",
  "add_training_record",
  "evaluate_trainee",
]);

function hasAnyScope(context: AuthorityContext, allowed: AuthorityScope[]) {
  return context.scopes.some((scope) => allowed.includes(scope));
}

/**
 * UI-level authority evaluator.
 *
 * Database RPC/RLS remains the source of truth. This function exists so every
 * portal surface asks the same permission question instead of embedding its
 * own rank checks.
 */
export function canPerformPersonnelAction(
  capability: PersonnelCapability,
  context: AuthorityContext,
): boolean {
  const isSelf = context.actorId === context.targetId || context.scopes.includes("self");

  if (capability === "view_self_record") return isSelf;
  if (isSelf && ["view_personnel_summary", "view_personnel_record"].includes(capability)) return true;

  if (context.actorTier === "Executive") return true;

  // Executive personnel remain protected from non-executive personnel actions.
  if (context.targetIsExecutive) {
    return capability === "view_personnel_summary" && context.actorTier === "Command";
  }

  if (capability === "view_personnel_summary") {
    return context.actorTier !== "Deputy" && hasAnyScope(context, ["direct", "unit", "command_chain", "training", "temporary", "department"]);
  }

  if (capability === "view_personnel_record") {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier) &&
      hasAnyScope(context, ["direct", "unit", "command_chain", "temporary"]);
  }

  if (capability === "view_sensitive_personnel_documents") {
    return context.actorTier === "Command" && hasAnyScope(context, ["direct", "unit", "command_chain", "department"]);
  }

  if (executiveOnly.has(capability)) return false;

  if (capability === "manage_supervisory_authority") {
    return context.actorTier === "Command" && hasAnyScope(context, ["command_chain", "department"]);
  }

  if (commandFinalAuthority.has(capability)) {
    return context.actorTier === "Command" && hasAnyScope(context, ["direct", "unit", "command_chain", "temporary", "department"]);
  }

  if (trainingActions.has(capability) && context.scopes.includes("training")) {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier);
  }

  if (supervisoryActions.has(capability)) {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier) &&
      hasAnyScope(context, ["direct", "unit", "command_chain", "training", "temporary", "department"]);
  }

  if (capability === "view_audit_log") return context.actorTier === "Command";

  return false;
}
