import Link from "next/link";

const items = [
  ["#promotion-review", "Promotion"],
  ["#performance-evaluations", "Evaluations"],
  ["#documents", "Documents"],
  ["#certifications", "Qualifications"],
  ["#training", "Training"],
  ["#awards", "Awards"],
  ["#assignments", "Assignments"],
  ["#leave-requests", "Leave"],
] as const;

export function MyInfoSectionNav() {
  return <nav className="my-info-section-nav" aria-label="My Info sections">{items.map(([href,label]) => <Link href={href} key={href}>{label}</Link>)}</nav>;
}