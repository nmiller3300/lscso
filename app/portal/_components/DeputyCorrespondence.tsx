"use client";

import { useState } from "react";

type Letter = {
  id: string;
  subject: string;
  body: string;
  sentAt: string;
  authorName: string;
  authorRank: string;
};

export function DeputyCorrespondence({ letters }: { letters: Letter[] }) {
  const [selected, setSelected] = useState<Letter | null>(null);

  return (
    <>
      <div className="personnel-document-list personnel-document-list--member">
        {letters.map((letter) => (
          <article key={letter.id}>
            <span className="personnel-document-icon">WL</span>
            <div><strong>{letter.subject}</strong><small>Welcome Letter · From {letter.authorRank} {letter.authorName} · {new Date(letter.sentAt).toLocaleDateString()}</small></div>
            <b>Delivered</b>
            <button onClick={() => setSelected(letter)} type="button">Read letter</button>
          </article>
        ))}
        {!letters.length ? <div className="portal-empty-state"><strong>No command letters are on file.</strong></div> : null}
      </div>

      {selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelected(null); }}>
          <section className="portal-modal personnel-letter-modal" role="dialog" aria-modal="true" aria-labelledby="personnel-letter-title">
            <div className="portal-modal-heading"><div><span>Welcome Letter · {new Date(selected.sentAt).toLocaleDateString()}</span><h2 id="personnel-letter-title">{selected.subject}</h2></div><button onClick={() => setSelected(null)} type="button" aria-label="Close welcome letter">×</button></div>
            <div className="personnel-letter-body">{selected.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            <footer><span>Respectfully,</span><strong>{selected.authorRank} {selected.authorName}</strong><small>Los Santos County Sheriff&apos;s Office</small></footer>
            <div className="portal-modal-actions"><button className="portal-button portal-button--primary" onClick={() => setSelected(null)} type="button">Close letter</button></div>
          </section>
        </div>
      ) : null}
    </>
  );
}
