export const STATEMENT_BLUE = "#5BA3D4";
export const STATEMENT_BLUE_RGB: [number, number, number] = [91, 163, 212];

export function FundtecLogo({
  className,
  size = 56,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="32" cy="32" r="32" fill={STATEMENT_BLUE} />
      <rect x="14" y="34" width="7" height="16" rx="1.2" fill="white" />
      <rect x="24" y="26" width="7" height="24" rx="1.2" fill="white" />
      <rect x="34" y="20" width="7" height="30" rx="1.2" fill="white" />
      <rect x="44" y="14" width="7" height="36" rx="1.2" fill="white" />
    </svg>
  );
}
