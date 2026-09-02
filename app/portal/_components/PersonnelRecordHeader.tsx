import Link from "next/link";
import { PersonnelRecordTabs, type PersonnelRecordSection } from "./PersonnelRecordTabs";

type PersonnelRecordHeaderProps = {
  personnelId: string;
  displayName: string;
  rank: string;
  callSign?: string | null;
  assignment?: string | null;
  status?: string | null;
  probationLabel?: string | null;
  active: PersonnelRecordSection;
};

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function PersonnelRecordHeader({
  personnelId,
  displayName,
  rank,
  callSign,
  assignment,
  status,
  probationLabel,
  active,
}: PersonnelRecordHeaderProps) {
  return (
    <section className="personnel-record-shell" aria-label={`${displayName} personnel record`}>
      <div className="personnel-record-identity">
        <span className="personnel-record-avatar" aria-hidden="true">{initials(displayName)}</span>
        <div>
          <p>Personnel record · {personnelId}</p>
          <h2>{displayName}</h2>
          <span>{rank} · {callSign ?? "No call sign"}{assignment ? ` · ${assignment}` : ""}</span>
        </div>
        <div className="personnel-record-identity-actions">
          {status ? <span className="personnel-record-status">{status}</span> : null}
          {probationLabel ? <span className="personnel-record-status" title="15-day new-hire probation period">{probationLabel}</span> : null}
          <Link href="/portal/command/personnel">All personnel</Link>
        </div>
      </div>
      <PersonnelRecordTabs personnelId={personnelId} active={active} />
    </section>
  );
}
