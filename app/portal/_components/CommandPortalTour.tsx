"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { usePortalProfile } from "./PortalProfileProvider";

const MODULES = [
  { title: "Command home", href: "/portal/command/home", note: "Read the action summary, distinguish urgent work from routine activity, and identify items needing Command review.", task: "Locate the pending-work indicators without making a decision." },
  { title: "Approvals & requests", href: "/portal/command/approvals", note: "Learn the review queue, ownership, routing, and the difference between a request and an approval.", task: "Open a request for inspection. Do not approve or deny it during training." },
  { title: "Personnel directory", href: "/portal/command/personnel", note: "Find personnel profiles, callsigns, status, and employment records. Remember that sensitive changes belong in authorized workflows.", task: "Find your own personnel record and check the displayed rank and call sign." },
  { title: "Promotions & career", href: "/portal/command/promotions", note: "Review career histories, promotion cases, eligibility, and the decision trail before changing rank.", task: "Find where pending promotion cases are reviewed, but do not submit one." },
  { title: "Recruitment", href: "/portal/command/applications", note: "Follow the application lifecycle: submission, review, interview, decision, and hiring.", task: "Locate an application status and review the available history without changing it." },
  { title: "Supervision", href: "/portal/command/supervision", note: "Understand personnel oversight, reporting responsibilities, and how to review assigned supervision work.", task: "Locate the supervision area and identify where officer oversight occurs." },
  { title: "Guardian workspace", href: "/portal/command/guardians", note: "Explore Guardian records, approval status, follow-ups, and accountability documentation.", task: "Open an existing record for reading only. Do not issue or approve a Guardian." },
  { title: "Training & FTO", href: "/portal/command/training", note: "Locate training assignments, field training operations, and certifications.", task: "Find the training progress or qualification view without editing a record." },
  { title: "Command orders", href: "/portal/orders", note: "Learn how formal directives are distributed and acknowledged, and how they differ from announcements.", task: "Open an existing order and identify its acknowledgement requirements." },
  { title: "Department announcements", href: "/portal/command/announcements", note: "Review how official notices are prepared and published. Publication can reach Discord and must be deliberate.", task: "Inspect announcement controls without posting a message." },
  { title: "Public information", href: "/portal/command/psa", note: "Learn the public-facing notice and PSA workflow and the importance of reviewing content before publication.", task: "Locate the PSA editor or current notices without publishing." },
  { title: "Administration", href: "/portal/command/administration", note: "Understand access controls, account administration, and high-impact system actions.", task: "Identify account management tools without creating, modifying, or deactivating accounts." },
  { title: "Your office & personal records", href: "/portal/my-office", note: "Review your own personnel documents, requests, leave, qualifications, and profile information.", task: "Find My Info and the personal request area." },
] as const;

const TARGET_IDS = new Set(["LS-002", "LS-004"]);

export function CommandPortalTour() {
  const profile = usePortalProfile();
  const pathname = usePathname();
  const eligible = TARGET_IDS.has(profile.personnel_id);
  const key = `lscso-command-tour-v1:${profile.id}`;
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "{}");
      const next = Math.max(0, Math.min(MODULES.length - 1, Number(saved.step) || 0));
      setStep(next);
      setFinished(saved.completed === true);
      setOpen(saved.completed !== true && saved.dismissed !== true);
    } catch { setStep(0); setOpen(true); }
    setReady(true);
  }, [eligible, key]);

  function save(nextStep: number, nextOpen: boolean, complete = false) {
    setStep(nextStep);
    setOpen(nextOpen);
    setFinished(complete);
    try { localStorage.setItem(key, JSON.stringify({ step: nextStep, dismissed: !nextOpen, completed: complete })); } catch {}
  }

  if (!eligible || !ready || !pathname.startsWith("/portal/") || pathname === "/portal/onboarding") return null;

  const module = MODULES[step];
  const onPage = pathname === module.href || pathname.startsWith(module.href + "/");
  return (
    <div className="command-tour-root">
      {!open ? (
        <button type="button" className="command-tour-launch" onClick={() => save(step, true, finished)}>
          {finished ? "Replay Command tour" : "Resume Command tour"}
        </button>
      ) : (
        <section className="command-tour-panel" role="region" aria-label="Command Portal guided tour">
          <header className="command-tour-heading">
            <div><span>LSCSO · COMMAND ORIENTATION</span><h2>{finished ? "Tour completed" : "Your portal field guide"}</h2></div>
            <button type="button" onClick={() => save(step, false, finished)} aria-label="Minimize command tour">×</button>
          </header>
          <div className="command-tour-progress"><span style={{ width: `${((step + 1) / MODULES.length) * 100}%` }} /></div>
          <p className="command-tour-count">Module {step + 1} of {MODULES.length} · {profile.rank}</p>
          <h3>{module.title}</h3>
          <p>{module.note}</p>
          <div className="command-tour-exercise"><strong>Practice exercise</strong><p>{module.task}</p></div>
          <p className="command-tour-safety">Training mode is instructional only. Live controls remain live—do not submit, publish, approve, or alter records while practicing.</p>
          <div className="command-tour-controls">
            <Link href={module.href} className="command-tour-visit">{onPage ? "You are in this section ✓" : "Open section ↗"}</Link>
            <button type="button" disabled={step === 0} onClick={() => save(step - 1, true)}>Back</button>
            {step < MODULES.length - 1 ? (
              <button type="button" className="command-tour-next" onClick={() => save(step + 1, true)}>Next</button>
            ) : (
              <button type="button" className="command-tour-next" onClick={() => save(0, false, true)}>Finish</button>
            )}
          </div>
          <button type="button" className="command-tour-reset" onClick={() => save(0, true)}>Restart from beginning</button>
        </section>
      )}
      <style jsx global>{`
        .command-tour-root{position:fixed;right:20px;bottom:20px;z-index:8000;font-family:inherit}
        .command-tour-launch{border:1px solid #c5a86b;border-radius:999px;background:#14252d;color:#f7e8bf;padding:12px 18px;font-weight:700;box-shadow:0 12px 40px #0009;cursor:pointer}
        .command-tour-panel{width:min(430px,calc(100vw - 24px));max-height:min(78vh,690px);overflow-y:auto;border:1px solid #9a855c;border-radius:18px;background:#101c24;color:#e9eef1;padding:20px;box-shadow:0 20px 65px #000b}
        .command-tour-heading{display:flex;justify-content:space-between;align-items:start;gap:16px}
        .command-tour-heading span{color:#c5aa77;font-size:10px;font-weight:800;letter-spacing:1.5px}
        .command-tour-heading h2{margin:5px 0 12px;font-size:19px;color:#fff}
        .command-tour-heading button{border:0;background:transparent;color:#cfd8df;font-size:26px;cursor:pointer}
        .command-tour-progress{height:5px;background:#31414b;border-radius:9px;overflow:hidden}
        .command-tour-progress span{display:block;height:100%;background:#d2ad68;transition:width .2s}
        .command-tour-count{font-size:12px;color:#aebec8;margin:12px 0}
        .command-tour-panel h3{font-size:21px;margin:0 0 9px;color:#fff}
        .command-tour-panel p{line-height:1.5;font-size:14px}
        .command-tour-exercise{padding:12px;border:1px solid #3e5360;border-radius:10px;background:#1b303b;margin:15px 0}
        .command-tour-exercise strong{font-size:12px;color:#e2c386;text-transform:uppercase;letter-spacing:.5px}
        .command-tour-exercise p{margin:6px 0 0}
        .command-tour-panel .command-tour-safety{font-size:12px;color:#aebbc5}
        .command-tour-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:18px}
        .command-tour-controls button,.command-tour-visit{border:1px solid #627280;border-radius:9px;background:#22343f;color:#f5f7f9;padding:10px 13px;font-size:13px;font-weight:700;text-decoration:none;cursor:pointer}
        .command-tour-controls button:disabled{opacity:.35;cursor:not-allowed}
        .command-tour-controls .command-tour-next{background:#d0ad74;color:#121a20;border-color:#d0ad74}
        .command-tour-reset{margin-top:14px;background:transparent;border:0;padding:6px 0;color:#b8c9d1;font-size:12px;text-decoration:underline;cursor:pointer}
        @media(max-width:700px){.command-tour-root{right:12px;bottom:12px}.command-tour-panel{max-height:70vh;padding:16px}}
      `}</style>
    </div>
  );
}
