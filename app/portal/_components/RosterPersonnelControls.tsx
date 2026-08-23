import Link from "next/link";

type MemberOption = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  status: string;
};

export function RosterPersonnelControls({ members }: { members: MemberOption[] }) {
  if (!members.length) return null;

  return (
    <section className="portal-control-banner">
      <div>
        <span>Personnel management</span>
        <strong>Rank, status, assignments, training, and delegated responsibilities are managed in Personnel Operations.</strong>
        <p>Changes there automatically preserve career history and audit records. Account credentials and protected account actions remain in the Command Portal.</p>
      </div>
      <div className="portal-control-actions">
        <Link className="portal-button portal-button--primary" href="https://lscsoroster.vercel.app/manage" target="_blank" rel="noreferrer">Open Personnel Operations</Link>
      </div>
    </section>
  );
}
