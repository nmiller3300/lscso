export type AccessTier = "Executive" | "Command" | "Supervisor" | "Preliminary" | "Deputy";

export type PersonnelStatus = "Active" | "Acting" | "Suspended" | "Deactivated";

export type PersonnelRecord = {
  profileId?: string;
  id: string;
  displayName: string;
  username: string | null;
  callSign: string;
  callSignHistory?: string[];
  rank: string;
  access: AccessTier;
  division: string;
  supervisor: string;
  status: PersonnelStatus;
  certifications: number;
  guardianOpen: number;
  lastSession: string;
  isTestAccount?: boolean;
  credentialsAssigned?: boolean;
};

export const rankAccess = [
  {
    tier: "Executive",
    ranks: ["Sheriff", "Undersheriff"],
    scope: "Department-wide executive authority.",
  },
  {
    tier: "Command",
    ranks: ["Major", "Captain"],
    scope: "Standing department-wide command authority; home assignment sets responsibility, not access boundaries.",
  },
  {
    tier: "Command",
    ranks: ["1st Lieutenant"],
    scope: "Command Staff authority within active organizational purview, command chain, assignment, or directed matter.",
  },
  {
    tier: "Supervisor",
    ranks: ["Lieutenant", "Sergeant"],
    scope: "Supervisory authority within active organizational purview, command chain, assignment, or directed matter.",
  },
  {
    tier: "Preliminary",
    ranks: ["Corporal"],
    scope: "Limited supervisory authority over specifically assigned personnel and authorized directed matters.",
  },
  {
    tier: "Deputy",
    ranks: ["Master Deputy", "Deputy III", "Deputy II", "Deputy", "Recruit"],
    scope: "Access to own record, certifications, assignments, and requests.",
  },
] as const;
