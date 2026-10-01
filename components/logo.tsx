import { useId, type CSSProperties } from "react";

// Skråtstillet kompasnål: nord i fuld farve, syd dæmpet. Farveovergangen styres af --logo-fra/--logo-til.
export function LogoMark({
  className = "size-8",
  style,
  hvid = false,
}: {
  className?: string;
  style?: CSSProperties;
  hvid?: boolean;
}) {
  const gradientId = useId();

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} style={style}>
      {!hvid && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--logo-fra)" }} />
            <stop offset="1" style={{ stopColor: "var(--logo-til)" }} />
          </linearGradient>
        </defs>
      )}
      <g transform="rotate(28 16 16)" fill={hvid ? "white" : `url(#${gradientId})`}>
        <polygon points="16,1 23,15 9,15" />
        <polygon points="9,17 23,17 16,31" fillOpacity={0.4} />
      </g>
    </svg>
  );
}
