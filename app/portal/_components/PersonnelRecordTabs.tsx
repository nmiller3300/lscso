import Link from "next/link";

type PersonnelRecordSection = "overview" | "timeline" | "supervision" | "training" | "recognition" | "documents" | "administration";

export function PersonnelRecordTabs({ personnelId, active }: { personnelId: string; active: PersonnelRecordSection }) {
  const base = `/portal/command/personnel/${personnelId}`;
  const items: Array<{ id: PersonnelRecordSection; label: string; href: string }> = [
    { id: "overview", label: "Overview", href: base },
    { id: "timeline", label: "Timeline", href: `${base}/timeline` },
    { id: "supervision", label: "Supervision", href: `${base}/supervision` },
    { id: "training", label: "Training", href: `${base}/training` },
    { id: "recognition", label: "Recognition", href: `${base}/recognition` },
    { id: "documents", label: "Documents", href: `${base}/documents` },
    { id: "administration", label: "Administration", href: `${base}/administration` },
  ];

  return (
    <nav className="command-v2-record-tabs" aria-label="Personnel record sections">
      {items.map((item) => (
        <Link
          key={item.id}
          className={active === item.id ? "is-active" : undefined}
          aria-current={active === item.id ? "page" : undefined}
          href={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
