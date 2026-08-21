type MedalAward = {
  id: string;
  award_name: string;
  citation?: string | null;
  awarded_on: string;
};

const medalAssets: Record<string, string> = {
  "Medal of Valor": "/images/medals/medal-of-valor.png?v=5",
  "Medal of Merit": "/images/medals/medal-of-merit.png?v=5",
  "Life Saving Award": "/images/medals/life-saving-award.png?v=5",
  "Distinguished Service Award": "/images/medals/distinguished-service-award.png?v=5",
};

export function MedalGallery({ awards }: { awards: MedalAward[] }) {
  if (!awards.length) {
    return (
      <div className="portal-empty-state">
        <strong>No medals or decorations have been awarded.</strong>
      </div>
    );
  }

  return (
    <div className="medal-gallery">
      {awards.map((award) => {
        const src = medalAssets[award.award_name];
        return (
          <article className="medal-card" key={award.id}>
            <div className="medal-card__art">
              {src ? (
                <img
                  src={src}
                  alt={`${award.award_name} medal`}
                  loading="eager"
                  decoding="async"
                />
              ) : null}
            </div>
            <div className="medal-card__body">
              <strong>{award.award_name}</strong>
              <span className="medal-card__meta">
                Awarded {new Date(award.awarded_on).toLocaleDateString()}
              </span>
              <span className="medal-card__type">Decoration</span>
            </div>
            <details>
              <summary>View citation</summary>
              <p className="medal-card__citation">
                {award.citation?.trim() || "No citation was entered for this award."}
              </p>
            </details>
          </article>
        );
      })}
    </div>
  );
}
