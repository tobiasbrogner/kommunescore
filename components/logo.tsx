import { useId, type CSSProperties } from "react";

// Kortnål med et nordisk kors – en lille hilsen til Dannebrog.
export function LogoMark({
  className = "size-8",
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const clipId = useId();

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} style={style}>
      <defs>
        <clipPath id={clipId}>
          <circle cx="16" cy="12.5" r="6.5" />
        </clipPath>
      </defs>
      <path
        d="M16 2C10.2 2 5.5 6.6 5.5 12.4c0 7.6 9 16.4 9.4 16.8a1.6 1.6 0 0 0 2.2 0c.4-.4 9.4-9.2 9.4-16.8C26.5 6.6 21.8 2 16 2z"
        fill="var(--accent)"
      />
      <g clipPath={`url(#${clipId})`} fill="var(--accent-foreground)">
        <rect x="12.4" y="5" width="2.6" height="16" />
        <rect x="8" y="11.2" width="16" height="2.6" />
      </g>
    </svg>
  );
}
