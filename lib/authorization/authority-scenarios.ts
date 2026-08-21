import { resolvePersonnelAuthority, type AuthorityResolutionInput } from "./resolve-personnel-authority";
import type { PersonnelCapability } from "./lscso-authority";

type ExpectedAuthorityScenario = {
  name: string;
  expected: boolean;
  input: AuthorityResolutionInput;
};

const units = [
  { id: "dept" },
  { id: "patrol", parentUnitId: "dept" },
  { id: "gang", parentUnitId: "dept" },
  { id: "swat", parentUnitId: "dept" },
  { id: "training", parentUnitId: "dept" },
];

const baseAssignments = [
  { profileId: "deputy-a", unitId: "patrol", assignmentType: "Primary" as const },
  { profileId: "deputy-a", unitId: "swat", assignmentType: "Special" as const },
  { profileId: "deputy-b", unitId: "gang", assignmentType: "Primary" as const },
];

function scenario(
  name: string,
  expected: boolean,
  actor: AuthorityResolutionInput["actor"],
  target: AuthorityResolutionInput["target"],
  capability: PersonnelCapability,
  overrides: Partial<AuthorityResolutionInput> = {},
): ExpectedAuthorityScenario {
  return {
    name,
    expected,
    input: {
      actor,
      target,
      capability,
      units,
      assignments: baseAssignments,
      supervisoryAuthority: [],
      ...overrides,
    },
  };
}

export const authorityScenarios: ExpectedAuthorityScenario[] = [
  scenario(
    "Captain may act outside home bureau without temporary permission",
    true,
    { id: "captain", rank: "Captain", tier: "Command" },
    { id: "deputy-b", rank: "Deputy III" },
    "create_guardian",
  ),
  scenario(
    "Major may review personnel department-wide",
    true,
    { id: "major", rank: "Major", tier: "Command" },
    { id: "deputy-a", rank: "Deputy III" },
    "view_personnel_record",
  ),
  scenario(
    "1st Lieutenant cannot act on unrelated personnel without scope",
    false,
    { id: "first-lt", rank: "1st Lieutenant", tier: "Command" },
    { id: "deputy-b", rank: "Deputy III" },
    "create_guardian",
  ),
  scenario(
    "1st Lieutenant inherits authority through assigned Patrol command",
    true,
    { id: "first-lt", rank: "1st Lieutenant", tier: "Command" },
    { id: "deputy-a", rank: "Deputy III" },
    "create_guardian",
    {
      supervisoryAuthority: [
        { supervisorProfileId: "first-lt", unitId: "patrol", authorityType: "Command" },
      ],
    },
  ),
  scenario(
    "SWAT supervisor can act on member through secondary assignment",
    true,
    { id: "swat-sgt", rank: "Sergeant", tier: "Supervisor" },
    { id: "deputy-a", rank: "Deputy III" },
    "create_guardian",
    {
      supervisoryAuthority: [
        { supervisorProfileId: "swat-sgt", unitId: "swat", authorityType: "Unit" },
      ],
    },
  ),
  scenario(
    "Unrelated Sergeant cannot act on deputy",
    false,
    { id: "other-sgt", rank: "Sergeant", tier: "Supervisor" },
    { id: "deputy-a", rank: "Deputy III" },
    "create_guardian",
  ),
  scenario(
    "Directed Guardian action permits only the assigned capability",
    true,
    { id: "training-first-lt", rank: "1st Lieutenant", tier: "Command" },
    { id: "deputy-b", rank: "Deputy III" },
    "create_guardian",
    {
      directedActions: [
        {
          assigneeProfileId: "training-first-lt",
          subjectProfileId: "deputy-b",
          capability: "create_guardian",
        },
      ],
    },
  ),
  scenario(
    "Directed Guardian action does not grant certification removal",
    false,
    { id: "training-first-lt", rank: "1st Lieutenant", tier: "Command" },
    { id: "deputy-b", rank: "Deputy III" },
    "remove_certification",
    {
      directedActions: [
        {
          assigneeProfileId: "training-first-lt",
          subjectProfileId: "deputy-b",
          capability: "create_guardian",
        },
      ],
    },
  ),
  scenario(
    "FTO authority permits trainee evaluation",
    true,
    { id: "fto", rank: "Deputy III", tier: "Deputy" },
    { id: "recruit", rank: "Recruit" },
    "evaluate_trainee",
    {
      assignments: [...baseAssignments, { profileId: "recruit", unitId: "training", assignmentType: "Training" }],
      supervisoryAuthority: [
        { supervisorProfileId: "fto", subjectProfileId: "recruit", authorityType: "Training" },
      ],
    },
  ),
  scenario(
    "FTO authority does not grant general Guardian authority",
    false,
    { id: "fto", rank: "Deputy III", tier: "Deputy" },
    { id: "recruit", rank: "Recruit" },
    "create_guardian",
    {
      assignments: [...baseAssignments, { profileId: "recruit", unitId: "training", assignmentType: "Training" }],
      supervisoryAuthority: [
        { supervisorProfileId: "fto", subjectProfileId: "recruit", authorityType: "Training" },
      ],
    },
  ),
  scenario(
    "Recusal blocks otherwise valid supervisor action on the matter",
    false,
    { id: "patrol-sgt", rank: "Sergeant", tier: "Supervisor" },
    { id: "deputy-a", rank: "Deputy III" },
    "review_guardian",
    {
      supervisoryAuthority: [
        { supervisorProfileId: "patrol-sgt", unitId: "patrol", authorityType: "Unit" },
      ],
      matter: { type: "Guardian", id: "matter-1" },
      recusals: [
        { recusedProfileId: "patrol-sgt", replacementProfileId: "other-lt", matterType: "Guardian", matterId: "matter-1" },
      ],
    },
  ),
  scenario(
    "Conflict replacement may handle reassigned supervisory matter",
    true,
    { id: "other-lt", rank: "Lieutenant", tier: "Supervisor" },
    { id: "deputy-a", rank: "Deputy III" },
    "review_guardian",
    {
      matter: { type: "Guardian", id: "matter-1" },
      recusals: [
        { recusedProfileId: "patrol-sgt", replacementProfileId: "other-lt", matterType: "Guardian", matterId: "matter-1" },
      ],
    },
  ),
];

export function evaluateAuthorityScenarios() {
  return authorityScenarios.map((item) => {
    const result = resolvePersonnelAuthority(item.input);
    return {
      name: item.name,
      expected: item.expected,
      actual: result.allowed,
      passed: result.allowed === item.expected,
      reasons: result.reasons,
    };
  });
}
