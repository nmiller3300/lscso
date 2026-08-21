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
    scope: "Full command authority; only tier permitted to deactivate accounts.",
  },
  {
    tier: "Command",
    ranks: ["Major", "Captain", "1st Lieutenant"],
    scope: "Department-wide command review and approval authority.",
  },
  {
    tier: "Supervisor",
    ranks: ["Lieutenant", "Sergeant"],
    scope: "Issue direct Guardians and submit disciplinary Guardians for review.",
  },
  {
    tier: "Preliminary",
    ranks: ["Corporal"],
    scope: "Limited supervisory tools within assigned personnel scope.",
  },
  {
    tier: "Deputy",
    ranks: ["Master Deputy", "Deputy III", "Deputy II", "Deputy", "Recruit"],
    scope: "Access to own record, certifications, assignments, and requests.",
  },
] as const;
