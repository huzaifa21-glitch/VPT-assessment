// A small reusable spinner — used anywhere an action is in flight, so the
// user gets visible feedback instead of a click that silently does nothing
// for a moment (which reads as "broken" and invites a repeat click).
export function Spinner({ size = 16, className = '' }) {
  return (
    <svg
      className={`animate-spin text-current ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
