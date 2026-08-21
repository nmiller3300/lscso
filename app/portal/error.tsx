"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("LSCSO portal route error", error);
  }, [error]);

  return (
    <main className="portal-recovery" role="alert">
      <span>Secure portal interruption</span>
      <h1>This workspace could not finish loading.</h1>
      <p>No action was confirmed from this screen. Retry the protected request, or return to sign-in if your session expired.</p>
      <div>
        <button className="portal-button portal-button--primary" onClick={reset} type="button">Retry workspace</button>
        <Link className="portal-button portal-button--secondary" href="/portal">Return to sign-in</Link>
      </div>
    </main>
  );
}
