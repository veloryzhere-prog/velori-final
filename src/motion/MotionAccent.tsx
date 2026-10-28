/** Lightweight animated linework; decorative content never changes the layout. */
export function MotionAccent() {
  return (
    <span className="motion-accent" aria-hidden="true">
      <svg viewBox="0 0 128 18" fill="none">
        <path className="motion-accent-track" d="M4 9H124" />
        <path className="motion-accent-dashes" d="M4 9H124" />
        <circle cx="4" cy="9" r="3" />
        <circle cx="64" cy="9" r="3" />
        <circle cx="124" cy="9" r="3" />
        <circle className="motion-accent-traveler" cx="4" cy="9" r="4" />
      </svg>
    </span>
  );
}
