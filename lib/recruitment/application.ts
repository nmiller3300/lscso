export const APPLICATION_STATUSES = ["Submitted", "Under Review", "Accepted", "Denied", "Hired", "Withdrawn"] as const;
export const APPLICATION_REVIEW_STATUSES = ["Submitted", "Under Review"] as const;
export const INTERVIEW_STATUSES = ["Not Scheduled", "Scheduled", "Completed", "No Show", "Passed", "Failed"] as const;

export const APPLICATION_QUESTION_TYPES = ["short_text", "long_text", "multiple_choice", "yes_no"] as const;
export type ApplicationQuestionType = typeof APPLICATION_QUESTION_TYPES[number];

export type RecruitmentApplicationQuestion = {
  id: string;
  questionKey: string;
  sectionTitle: string;
  sectionShortTitle: string;
  sectionEyebrow: string;
  sectionDescription: string;
  prompt: string;
  questionType: ApplicationQuestionType;
  helpText: string | null;
  placeholder: string | null;
  options: string[];
  required: boolean;
  active: boolean;
  sortOrder: number;
  systemField: string | null;
  locked: boolean;
};

export const APPLICATION_CERTIFICATION_TEXT = "Under penalty of perjury under the laws of the State of San Andreas, I certify that all information provided in this application is true, accurate, and complete to the best of my knowledge. I understand that any false, misleading, or intentionally omitted information may result in the denial or disqualification of my application.";

// Legacy question map retained for older integrations and applications submitted before the form builder.
export const applicationQuestions: Array<[string, string, string]> = [
  ["Applicant Information", "full_name", "What is your full name?"],
  ["Applicant Information", "discord_username", "What is your Discord username?"],
  ["Applicant Information", "age", "What is your age?"],
  ["Applicant Information", "timezone", "What is your timezone?"],
  ["Experience & Availability", "fivem_experience", "How long have you been playing FiveM and participating in serious roleplay?"],
  ["Experience & Availability", "previous_departments", "What departments or factions have you previously been a member of?"],
  ["Experience & Availability", "weekly_hours", "How many hours per week can you dedicate to LSCSO?"],
  ["Experience & Availability", "upcoming_commitments", "Do you have any upcoming commitments that may affect your activity?"],
  ["Why LSCSO?", "why_lscso", "Why do you want to join the Los Santos County Sheriff's Office?"],
  ["Why LSCSO?", "contribution", "What do you believe you can contribute to LSCSO?"],
  ["Background & Integrity", "drug_use_history", "Have you ever used illegal drugs, used prescription medication not prescribed to you, or otherwise misused a controlled substance? If yes, identify the substance(s), approximate date(s), frequency, and any relevant context. If no, enter No."],
  ["Roleplay & Law Enforcement", "serious_roleplay_definition", "What does serious roleplay mean to you?"],
  ["Roleplay & Law Enforcement", "reasonable_suspicion_probable_cause", "Explain the difference between reasonable suspicion and probable cause."],
  ["Roleplay & Law Enforcement", "use_of_force_factors", "What factors should an officer consider before using force?"],
  ["Scenarios", "scenario_speeding_nervous", "You stop a vehicle for speeding. The driver becomes increasingly nervous during the stop. What do you do?"],
  ["Scenarios", "scenario_deputy_policy_violation", "You witness another deputy violating department policy. What do you do?"],
  ["Scenarios", "scenario_supervisor_order", "A supervisor orders you to do something you believe violates department policy. How do you handle it?"],
];

export function applicationLabel(applicationNumber: number | string) {
  return `APP-${String(applicationNumber).padStart(4, "0")}`;
}

export function applicationStatusLabel(status: string) {
  switch (status) {
    case "Accepted": return "Application Accepted";
    case "Interview": return "Legacy Interview Stage";
    case "Hired": return "Hired · Recruit";
    default: return status;
  }
}

export function applicationNextAction(status: string, interviewStatus?: string | null, hired = false) {
  if (hired || status === "Hired") return "Recruit record created — continue onboarding and training.";
  if (status === "Denied") return "Application closed — no interview will be scheduled.";
  if (status === "Withdrawn") return "Application withdrawn — no further action required.";
  if (status === "Submitted") return "Assign a Captain+ reviewer and begin Command screening.";
  if (status === "Under Review") return "Complete Command screening, then accept or deny the application.";
  if (status === "Accepted") {
    if (interviewStatus === "Passed") return "Interview passed — applicant is cleared for the Recruit hire handoff.";
    if (interviewStatus === "Failed") return "Interview failed — document the outcome; the applicant is not eligible for the Recruit hire handoff.";
    if (interviewStatus === "Scheduled") return "Interview scheduled — complete and record the interview outcome.";
    if (interviewStatus === "No Show") return "Applicant did not attend — reschedule the interview or document the no-show outcome.";
    if (interviewStatus === "Completed") return "Interview completed — record Pass or Fail before hiring.";
    return "Contact the applicant on Discord and schedule the required interview.";
  }
  if (status === "Interview") return "Legacy record — complete the interview record before any Recruit hire handoff.";
  return "Continue the documented recruitment workflow.";
}
