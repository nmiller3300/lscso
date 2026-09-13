type PasswordEyesProps = {
  open: boolean;
};

export function PasswordEyes({ open }: PasswordEyesProps) {
  return (
    <svg
      className={`portal-password-eyes ${open ? "is-open" : "is-closed"}`}
      viewBox="0 0 120 52"
      aria-hidden="true"
      focusable="false"
    >
      <g className="portal-password-eyes__brows" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
        <path d="M10 13 Q25 5 40 12" />
        <path d="M80 12 Q95 5 110 13" />
      </g>

      <g className="portal-password-eyes__open-eyes">
        <path d="M7 27 Q25 9 43 27 Q25 45 7 27Z" fill="rgba(252,251,248,.92)" stroke="currentColor" strokeWidth="2.6" />
        <path d="M77 27 Q95 9 113 27 Q95 45 77 27Z" fill="rgba(252,251,248,.92)" stroke="currentColor" strokeWidth="2.6" />
        <circle className="portal-password-eyes__pupil portal-password-eyes__pupil--left" cx="25" cy="27" r="7.3" />
        <circle className="portal-password-eyes__pupil portal-password-eyes__pupil--right" cx="95" cy="27" r="7.3" />
        <circle cx="22.5" cy="24.5" r="1.8" fill="rgba(255,255,255,.86)" />
        <circle cx="92.5" cy="24.5" r="1.8" fill="rgba(255,255,255,.86)" />
      </g>

      <g className="portal-password-eyes__closed-eyes" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        <path d="M8 29 Q25 42 42 29" />
        <path d="M78 29 Q95 42 112 29" />
      </g>
    </svg>
  );
}
