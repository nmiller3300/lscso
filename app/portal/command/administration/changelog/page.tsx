import Link from "next/link";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { LifetimeChangelog } from "./LifetimeChangelog";
import { parseLifetimeChangelog } from "@/lib/lifetime-changelog";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export const runtime = "nodejs";

export default async function LifetimeChangelogPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  if (profile.access_tier !== "Executive") redirect("/portal/command/administration");

  const markdown = await readFile(path.join(process.cwd(), "CHANGELOG.md"), "utf8");
  const entries = parseLifetimeChangelog(markdown);

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration / Department Governance"
      title="Lifetime Changelog"
      description="The dated, permanent history of LSCSO website and Personnel Portal development."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/administration">Back to Administration</Link>}
    >
      <LifetimeChangelog entries={entries} />
    </PortalShell>
  );
}
