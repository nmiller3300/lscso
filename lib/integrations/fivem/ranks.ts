export const LSCSO_JOB_NAME = "lscso" as const;

export const LSCSO_GRADES = {
  0: "Recruit",
  1: "Deputy",
  2: "Deputy II",
  3: "Deputy III",
  4: "Master Deputy",
  5: "Corporal",
  6: "Sergeant",
  7: "Lieutenant",
  8: "1st Lieutenant",
  9: "Captain",
  10: "Major",
  11: "Undersheriff",
  12: "Sheriff",
} as const;

export type LscsoGrade = keyof typeof LSCSO_GRADES;

export type ComputerAccessBand =
  | "employee"
  | "preliminary_supervisor"
  | "supervisor"
  | "command"
  | "executive";

export function isLscsoGrade(value: unknown): value is LscsoGrade {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 12;
}

export function getLscsoRankForGrade(grade: LscsoGrade) {
  return LSCSO_GRADES[grade];
}

export function getComputerAccessBand(grade: LscsoGrade): ComputerAccessBand {
  if (grade >= 11) return "executive";
  if (grade >= 8) return "command";
  if (grade >= 6) return "supervisor";
  if (grade >= 5) return "preliminary_supervisor";
  return "employee";
}
