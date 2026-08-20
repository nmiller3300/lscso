import Image from "next/image";

type PageHeroProps = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
  containedImage?: boolean;
};

export function PageHero({
  eyebrow,
  title,
  description,
  image,
  imageAlt,
  imagePosition = "center",
  containedImage = false,
}: PageHeroProps) {
  return (
    <section className={`page-hero${containedImage ? " page-hero--contained" : ""}`}>
      <div className="page-hero-media">
        <Image
          src={image}
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectPosition: imagePosition }}
        />
      </div>
      <div className="page-hero-overlay" />
      <div className="site-shell page-hero-content">
        <p className="section-kicker">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}
