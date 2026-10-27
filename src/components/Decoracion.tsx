// Dibujos de la marca: mariposa y silueta meditando, en lila y dorado.

let n = 0;

export function Mariposa({ className = "", tam = 28 }: { className?: string; tam?: number }) {
  const id = `ala${n++}`;
  return (
    <svg className={"mariposa " + className} width={tam} height={tam} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--lila-claro)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`} stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M31 33 C24 14 10 4 5 9 C0 15 8 30 31 35 Z" />
        <path d="M33 33 C40 14 54 4 59 9 C64 15 56 30 33 35 Z" />
        <path d="M31 36 C18 37 9 46 13 53 C17 59 27 50 31 39 Z" />
        <path d="M33 36 C46 37 55 46 51 53 C47 59 37 50 33 39 Z" />
      </g>
      <path d="M32 26 L32 48" stroke="var(--gold)" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M32 27 C30 21 27 18 24 17 M32 27 C34 21 37 18 40 17" stroke="var(--gold)" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Meditando({ className = "", tam = 120 }: { className?: string; tam?: number }) {
  return (
    <svg className={"meditando " + className} width={tam} height={tam} viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="56" fill="none" stroke="var(--gold)" strokeWidth="1" strokeDasharray="2 5" opacity=".7" />
      <g fill="var(--accent)">
        <circle cx="60" cy="27" r="9.5" />
        <path d="M51 40 Q60 35 69 40 L73 70 Q60 76 47 70 Z" />
        <path d="M51 42 Q40 54 34 76 Q37 80 41 78 Q46 61 55 50 Z" />
        <path d="M69 42 Q80 54 86 76 Q83 80 79 78 Q74 61 65 50 Z" />
        <path d="M22 86 Q40 70 60 76 Q80 70 98 86 Q94 96 60 96 Q26 96 22 86 Z" />
      </g>
      <circle cx="37" cy="79" r="3.2" fill="var(--gold)" />
      <circle cx="83" cy="79" r="3.2" fill="var(--gold)" />
    </svg>
  );
}
