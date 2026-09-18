import type { ReactNode } from "react";

type CinematicOrbProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function CinematicOrb({
  children,
  className = "",
  contentClassName = "",
}: CinematicOrbProps) {
  return (
    <div className={`lscso-cinematic-orb ${className}`.trim()}>
      <div className={`lscso-cinematic-orb__content ${contentClassName}`.trim()}>
        {children}
      </div>
    </div>
  );
}
