type Props = {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
};

export function GlassBlobToggle({ checked, disabled = false, label, onChange }: Props) {
  return (
    <button
      className={`portal-glass-toggle ${checked ? "is-on" : "is-off"}`}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="portal-glass-toggle__track" aria-hidden="true">
        <span className="portal-glass-toggle__blob">
          <span className="portal-glass-toggle__shine" />
        </span>
      </span>
    </button>
  );
}
