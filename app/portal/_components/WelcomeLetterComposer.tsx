"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Letter = {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  authorName: string;
  authorRank: string;
};

export function WelcomeLetterComposer({
  profileId,
  displayName,
  letters,
  canSend = true,
}: {
  profileId: string;
  displayName: string;
  letters: Letter[];
  canSend?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");

  async function sendLetter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true);
    setNotice("");
    const { error } = await (createClient() as any).rpc("send_personnel_welcome_letter", {
      target_profile_id: profileId,
      letter_subject: String(data.get("subject") ?? "").trim(),
      letter_body: String(data.get("body") ?? "").trim(),
    });
    setPending(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    form.reset();
    setNotice(`Welcome letter delivered to ${displayName}'s My Documents.`);
    router.refresh();
  }

  return (
    <div className={`personnel-letter-layout${canSend ? "" : " personnel-letter-layout--history-only"}`}>
      {canSend ? <section className="portal-panel personnel-letter-composer" id="send-letter">
        <div className="portal-panel-heading">
          <div><p>Command correspondence</p><h2>Send a welcome letter</h2></div>
          <span>Delivered to My Documents</span>
        </div>
        <div className="personnel-guidance-note">
          <strong>Who sees this?</strong>
          <span>{displayName} will see the letter in their protected personnel portal. Your name and command rank are recorded automatically.</span>
        </div>
        <form onSubmit={sendLetter}>
          <label>
            Subject
            <input name="subject" required minLength={2} maxLength={140} defaultValue="Welcome to the Los Santos County Sheriff’s Office" />
          </label>
          <label>
            Letter
            <textarea name="body" required minLength={20} maxLength={10000} rows={12} placeholder={`Write a personal welcome to ${displayName}...`} />
          </label>
          <div className="portal-modal-actions">
            <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Sending…" : "Send welcome letter"}</button>
          </div>
        </form>
        {notice ? <div className="personnel-inline-notice" role="status">{notice}</div> : null}
      </section> : null}

      <section className="portal-panel">
        <div className="portal-panel-heading">
          <div><p>Delivery history</p><h2>Letters sent</h2></div>
          <span>{letters.length}</span>
        </div>
        <div className="personnel-document-list">
          {letters.length ? letters.map((letter) => (
            <article key={letter.id}>
              <span className="personnel-document-icon">WL</span>
              <div>
                <strong>{letter.subject}</strong>
                <small>From {letter.authorRank} {letter.authorName} · {new Date(letter.sentAt).toLocaleDateString()}</small>
                <p>{letter.body}</p>
              </div>
              <b>Delivered</b>
            </article>
          )) : <div className="portal-empty-state"><strong>No letters have been sent to this member.</strong><span>The first welcome letter will appear here after delivery.</span></div>}
        </div>
      </section>
    </div>
  );
}
