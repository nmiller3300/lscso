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
  | "temporary_assignment"
  | "directed_action"
  | "conflict_reassignment"
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

const scopedOperationalAuthority: AuthorityScope[] = [
  "direct",
  "unit",
  "command_chain",
  "temporary_assignment",
  "conflict_reassignment",
];

function hasAnyScope(context: AuthorityContext, allowed: AuthorityScope[]) {
  return context.scopes.some((scope) => allowed.includes(scope));
}

/** Sheriff, Undersheriff, Major and Captain are not restricted to their home bureau. */
export function hasStandingDepartmentAuthority(rank: LscsoRank): boolean {
  return ["Sheriff", "Undersheriff", "Major", "Captain"].includes(rank);
}

/**
 * UI-level authority evaluator.
 *
 * Database RPC/RLS remains the source of truth. Every portal surface should ask
 * this evaluator instead of embedding its own rank checks. A certification never
 * creates supervisory authority; authority comes from command position,
 * organizational purview, an active assignment, or an explicit directed action.
 */
export function canPerformPersonnelAction(
  capability: PersonnelCapability,
  context: AuthorityContext,
): boolean {
  const isSelf = context.actorId === context.targetId || context.scopes.includes("self");
  const standingDepartmentAuthority = hasStandingDepartmentAuthority(context.actorRank);

  if (capability === "view_self_record") return isSelf;
  if (isSelf && ["view_personnel_summary", "view_personnel_record"].includes(capability)) return true;

  if (context.actorTier === "Executive") return true;

  // Executive personnel remain protected from non-executive personnel actions.
  if (context.targetIsExecutive) {
    return capability === "view_personnel_summary" && context.actorTier === "Command";
  }

  // Major and Captain retain standing department-wide operational reach even
  // when working outside their normal bureau or division.
  if (standingDepartmentAuthority) {
    if (executiveOnly.has(capability)) return false;
    if (capability === "manage_supervisory_authority") return true;
    if (capability === "view_audit_log") return true;
    return context.actorTier === "Command";
  }

  // From 1st Lieutenant down, personnel authority must have a valid scope.
  if (capability === "view_personnel_summary") {
    return context.actorTier !== "Deputy" &&
      hasAnyScope(context, [...scopedOperationalAuthority, "training", "directed_action"]);
  }

  if (capability === "view_personnel_record") {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier) &&
      hasAnyScope(context, [...scopedOperationalAuthority, "directed_action"]);
  }

  if (capability === "view_sensitive_personnel_documents") {
    return context.actorTier === "Command" && hasAnyScope(context, scopedOperationalAuthority);
  }

  if (executiveOnly.has(capability)) return false;

  if (capability === "manage_supervisory_authority") {
    return context.actorTier === "Command" && hasAnyScope(context, ["command_chain"]);
  }

  if (commandFinalAuthority.has(capability)) {
    return context.actorTier === "Command" && hasAnyScope(context, scopedOperationalAuthority);
  }

  if (trainingActions.has(capability) && context.scopes.includes("training")) {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier);
  }

  // Directed action permits the specific assigned supervisory task without
  // granting general access to the subject's unit or personnel record.
  if (supervisoryActions.has(capability) && context.scopes.includes("directed_action")) {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier);
  }

  if (supervisoryActions.has(capability)) {
    return ["Command", "Supervisor", "Preliminary"].includes(context.actorTier) &&
      hasAnyScope(context, scopedOperationalAuthority);
  }

  // Department audit visibility is intentionally not inherited by scoped
  // 1st Lieutenant-and-below authority.
  if (capability === "view_audit_log") return false;

  return false;
}
