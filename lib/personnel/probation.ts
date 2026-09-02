export const PERSONNEL_PROBATION_DAYS = 15;

export type PersonnelProbationState = {
  active: boolean;
  endsAt: string | null;
  daysRemaining: number | null;
};

export function getPersonnelProbationState(probationEndsAt: string | null | undefined, now = Date.now()): PersonnelProbationState {
  if (!probationEndsAt) return { active: false, endsAt: null, daysRemaining: null };
  const end = new Date(probationEndsAt).getTime();
  if (!Number.isFinite(end) || end <= now) return { active: false, endsAt: probationEndsAt, daysRemaining: null };
  return {
    active: true,
    endsAt: probationEndsAt,
    daysRemaining: Math.max(1, Math.ceil((end - now) / 86_400_000)),
  };
}
