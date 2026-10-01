export const LSCSO_JOB_NAME = "lscso" as const;

// These are the framework grades with a confirmed one-to-one personnel-rank label.
// The live FiveM job can use grades through 14; higher command grades are accepted
// even when the website does not yet have a confirmed display-name mapping for them.
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

export type LscsoMappedGrade = keyof typeof LSCSO_GRADES;

export type ComputerAccessBand =
  | "employee"
  | "preliminary_supervisor"
  | "supervisor"
  | "command"
  | "executive";

export function isLscsoGrade(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 14;
}

export function getLscsoRankForGrade(grade: number) {
  return LSCSO_GRADES[grade as LscsoMappedGrade] ?? null;
}

export function getComputerAccessBand(grade: number): ComputerAccessBand {
  if (grade >= 11) return "executive";
  if (grade >= 8) return "command";
  if (grade >= 6) return "supervisor";
  if (grade >= 5) return "preliminary_supervisor";
  return "employee";
}
