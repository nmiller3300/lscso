import {
  canPerformPersonnelAction,
  rankLevel,
  type AuthorityContext,
  type AuthorityScope,
  type LscsoRank,
  type PersonnelCapability,
} from "./lscso-authority";

export type ActiveUnitAssignment = {
  profileId: string;
  unitId: string;
  assignmentType: "Primary" | "Secondary" | "Special" | "Temporary" | "Training";
};

export type ActiveSupervisoryAuthority = {
  supervisorProfileId: string;
  unitId?: string | null;
  subjectProfileId?: string | null;
  authorityType: "Primary" | "Unit" | "Command" | "Training" | "Temporary";
};

export type ActiveDirectedAction = {
  assigneeProfileId: string;
  subjectProfileId: string;
  capability: PersonnelCapability;
  matterType?: string | null;
  matterId?: string | null;
};

export type ActiveRecusal = {
  recusedProfileId: string;
  replacementProfileId?: string | null;
  matterType: string;
  matterId: string;
};

export type OrganizationalUnitNode = {
  id: string;
  parentUnitId?: string | null;
};

export type AuthorityResolutionInput = {
  actor: {
    id: string;
    rank: LscsoRank;
    tier: AuthorityContext["actorTier"];
  };
  target: {
    id: string;
    rank: LscsoRank;
  };
  capability: PersonnelCapability;
  units: OrganizationalUnitNode[];
  assignments: ActiveUnitAssignment[];
  supervisoryAuthority: ActiveSupervisoryAuthority[];
  directedActions?: ActiveDirectedAction[];
  recusals?: ActiveRecusal[];
  matter?: {
    type: string;
    id: string;
  };
};

export type AuthorityResolution = {
  allowed: boolean;
  scopes: AuthorityScope[];
  reasons: string[];
  blockedByRecusal: boolean;
};

const standingDepartmentRanks = new Set<LscsoRank>([
  "Sheriff",
  "Undersheriff",
  "Major",
  "Captain",
]);

function unitContains(
  authorityUnitId: string,
  targetUnitId: string,
  units: OrganizationalUnitNode[],
): boolean {
  if (authorityUnitId === targetUnitId) return true;
  const byId = new Map(units.map((unit) => [unit.id, unit]));
  const visited = new Set<string>();
  let cursor: OrganizationalUnitNode | undefined = byId.get(targetUnitId);

  while (cursor?.parentUnitId) {
    if (visited.has(cursor.id)) return false;
    visited.add(cursor.id);
    if (cursor.parentUnitId === authorityUnitId) return true;
    cursor = byId.get(cursor.parentUnitId);
  }

  return false;
}

function uniqueScopes(scopes: AuthorityScope[]) {
  return Array.from(new Set(scopes));
}

/**
 * Resolves why an LSCSO member has authority over another member.
 * Database RPC/RLS remains the final enforcement layer.
 */
export function resolvePersonnelAuthority(input: AuthorityResolutionInput): AuthorityResolution {
  const { actor, target, capability } = input;
  const scopes: AuthorityScope[] = [];
  const reasons: string[] = [];

  if (actor.id === target.id) {
    scopes.push("self");
    reasons.push("Own personnel record");
  }

  if (standingDepartmentRanks.has(actor.rank)) {
    scopes.push("department");
    reasons.push(`${actor.rank} has standing department-wide command authority`);
  }

  const targetAssignments = input.assignments.filter((assignment) => assignment.profileId === target.id);
  const actorAuthority = input.supervisoryAuthority.filter(
    (authority) => authority.supervisorProfileId === actor.id,
  );

  for (const authority of actorAuthority) {
    const mappedScope: AuthorityScope =
      authority.authorityType === "Primary"
        ? "direct"
        : authority.authorityType === "Training"
          ? "training"
          : authority.authorityType === "Temporary"
            ? "temporary_assignment"
            : authority.authorityType === "Command"
              ? "command_chain"
              : "unit";

    if (authority.subjectProfileId === target.id) {
      scopes.push(mappedScope);
      reasons.push(`${authority.authorityType} supervisory authority over this member`);
    }

    if (authority.unitId) {
      for (const assignment of targetAssignments) {
        if (unitContains(authority.unitId, assignment.unitId, input.units)) {
          scopes.push(mappedScope);
          reasons.push(`${authority.authorityType} authority through an active unit assignment`);
        }
      }
    }
  }

  const directed = (input.directedActions ?? []).some((action) => {
    if (action.assigneeProfileId !== actor.id || action.subjectProfileId !== target.id) return false;
    if (action.capability !== capability) return false;
    if (!input.matter) return true;
    const typeMatches = !action.matterType || action.matterType === input.matter.type;
    const idMatches = !action.matterId || action.matterId === input.matter.id;
    return typeMatches && idMatches;
  });

  if (directed) {
    scopes.push("directed_action");
    reasons.push("Authorized directed action for this member/matter");
  }

  const matchingRecusal = input.matter
    ? (input.recusals ?? []).find(
        (recusal) =>
          recusal.matterType === input.matter?.type && recusal.matterId === input.matter?.id,
      )
    : undefined;

  const blockedByRecusal = matchingRecusal?.recusedProfileId === actor.id;
  const isConflictReplacement = matchingRecusal?.replacementProfileId === actor.id;

  if (blockedByRecusal) {
    return {
      allowed: false,
      scopes: uniqueScopes(scopes),
      reasons: [...reasons, "Recused from this matter"],
      blockedByRecusal: true,
    };
  }

  if (isConflictReplacement) {
    scopes.push("conflict_reassignment");
    reasons.push("Assigned as replacement authority for a recused personnel matter");
  }

  // Directed action is capability-specific and does not grant general record access.
  if (directed) {
    return {
      allowed: true,
      scopes: uniqueScopes(scopes),
      reasons,
      blockedByRecusal: false,
    };
  }

  const context: AuthorityContext = {
    actorId: actor.id,
    targetId: target.id,
    actorRank: actor.rank,
    actorTier: actor.tier,
    scopes: uniqueScopes(scopes),
    targetIsExecutive: rankLevel[target.rank] >= rankLevel.Undersheriff,
  };

  return {
    allowed: canPerformPersonnelAction(capability, context),
    scopes: context.scopes,
    reasons,
    blockedByRecusal: false,
  };
}
