export const DEFAULT_RECRUITMENT_TIME_ZONE = "America/New_York";

export const RECRUITMENT_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time" },
  { value: "America/Chicago", label: "Central Time" },
  { value: "America/Denver", label: "Mountain Time" },
  { value: "America/Phoenix", label: "Arizona Time" },
  { value: "America/Los_Angeles", label: "Pacific Time" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
  { value: "UTC", label: "UTC" },
] as const;

const TIMEZONE_ALIASES: Record<string, string> = {
  ET: "America/New_York",
  EST: "America/New_York",
  EDT: "America/New_York",
  EASTERN: "America/New_York",
  "EASTERN TIME": "America/New_York",
  CT: "America/Chicago",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  CENTRAL: "America/Chicago",
  "CENTRAL TIME": "America/Chicago",
  MT: "America/Denver",
  MST: "America/Denver",
  MDT: "America/Denver",
  MOUNTAIN: "America/Denver",
  "MOUNTAIN TIME": "America/Denver",
  PT: "America/Los_Angeles",
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  PACIFIC: "America/Los_Angeles",
  "PACIFIC TIME": "America/Los_Angeles",
  AKT: "America/Anchorage",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  HST: "Pacific/Honolulu",
  UTC: "UTC",
  GMT: "UTC",
};

export function normalizeRecruitmentTimeZone(value?: string | null, fallback = DEFAULT_RECRUITMENT_TIME_ZONE) {
  const clean = String(value ?? "").trim();
  if (!clean) return fallback;
  const alias = TIMEZONE_ALIASES[clean.toUpperCase()];
  if (alias) return alias;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: clean }).format(new Date());
    return clean;
  } catch {
    return fallback;
  }
}

export function recruitmentTimeZoneLabel(value?: string | null) {
  const zone = normalizeRecruitmentTimeZone(value);
  return RECRUITMENT_TIMEZONES.find((item) => item.value === zone)?.label ?? zone;
}

export function formatRecruitmentDateTime(value?: string | null, timeZone?: string | null) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  const zone = normalizeRecruitmentTimeZone(timeZone);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function toDateTimeLocalInZone(value?: string | null, timeZone?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const zone = normalizeRecruitmentTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}
