"use client";

export function CoffeeBreakButton() {
  return (
    <button
      className="portal-coffee-launch"
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("lscso:coffee-break"))}
      aria-label="Open LSCSO coffee break"
      title="Coffee break"
    >
      <span className="portal-coffee-launch__cup" aria-hidden="true">☕</span>
      <span className="portal-coffee-launch__copy">
        <strong>Coffee break</strong>
        <small>Brew a cup</small>
      </span>
    </button>
  );
}
