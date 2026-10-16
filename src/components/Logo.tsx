import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
    >
      <rect width="64" height="64" rx="16" fill="#17181a" />
      <rect x="18" y="14" width="10" height="36" rx="5" fill="#c8f169" />
      <rect x="18" y="40" width="28" height="10" rx="5" fill="#c8f169" />
    </svg>
  );
}

export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="Linkbio — início">
      <LogoMark />
      <span className="logo-text">Linkbio</span>
    </Link>
  );
}
