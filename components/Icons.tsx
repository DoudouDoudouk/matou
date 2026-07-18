const IC: Record<string, string> = {
  wallet: '<rect x="2.5" y="6" width="19" height="12" rx="2.4"/><circle cx="12" cy="12" r="2.4"/><path d="M2.5 10h4M17.5 14h4"/>',
  budget: '<circle cx="12" cy="12" r="8.2"/><path d="M12 3.8V12l6 5.4"/>',
  tax: '<rect x="5" y="3" width="14" height="18" rx="2.2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  invest: '<path d="M3 17l6-6 4 4 7-7"/><path d="M17 8h4v4"/>',
  flame: '<path d="M12 3c.6 3 3 4.2 3 7a3 3 0 0 1-6 0c0-.9.4-1.6.9-2.1C9.5 9.5 10 11 11 11.4 10.2 9 11 5.5 12 3z"/><path d="M7.5 13.5A5.5 5.5 0 1 0 17 17c0-2.3-1.4-4-3-5.5"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M9.5 10h3.5a1.5 1.5 0 0 1 0 3H10a1.5 1.5 0 0 0 0 3h3"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  star: '<path d="M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.4 9.3l6-.7z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  trophy: '<path d="M7 4h10v3.5a5 5 0 0 1-10 0z"/><path d="M7 5H4v1.5A3.5 3.5 0 0 0 7 10M17 5h3v1.5A3.5 3.5 0 0 1 17 10"/><path d="M12 12v4M8.5 20h7M10 20l.5-4h3l.5 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
};

export function Icon({ name, size = 22, className = "icn" }: { name: keyof typeof IC; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: IC[name] }}
    />
  );
}

export function Cat({ size = 44 }: { size?: number }) {
  return (
    <svg className="cat" width={size} height={size} viewBox="0 0 120 120" aria-label="Matou">
      <path className="ear" d="M26 46 L34 18 L58 40 Z" />
      <path className="ear" d="M94 46 L86 18 L62 40 Z" />
      <path className="in" d="M33 40 L38 24 L50 38 Z" />
      <path className="in" d="M87 40 L82 24 L70 38 Z" />
      <path
        className="fur"
        d="M60 34 C86 34 98 52 98 74 C98 98 82 108 60 108 C38 108 22 98 22 74 C22 52 34 34 60 34 Z"
      />
      <path className="eye" d="M44 68 q6 8 12 0" />
      <path className="eye" d="M64 68 q6 8 12 0" />
      <circle className="blush" cx="40" cy="80" r="6" />
      <circle className="blush" cx="80" cy="80" r="6" />
      <path className="nose" d="M56 78 h8 l-4 5 z" />
      <path className="wh" d="M30 76 h-14M30 82 h-13" />
      <path className="wh" d="M90 76 h14M90 82 h13" />
    </svg>
  );
}

export function Flag() {
  return (
    <span className="flag">
      <i></i>
      <i></i>
      <i></i>
    </span>
  );
}

const MISTRAL_MARK = (
  <svg width={19} height={14} viewBox="0 0 20 15" style={{ verticalAlign: -2, borderRadius: 2 }}>
    <rect y={0} width={20} height={3} fill="#FFD800" />
    <rect y={3} width={20} height={3} fill="#FFAF00" />
    <rect y={6} width={20} height={3} fill="#FF8205" />
    <rect y={9} width={20} height={3} fill="#FA500F" />
    <rect y={12} width={20} height={3} fill="#E10500" />
  </svg>
);

export function MistralBadge() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--ink)" }}>
      {MISTRAL_MARK} Mistral AI
    </span>
  );
}

export function Confetti({ burstKey }: { burstKey: number }) {
  if (!burstKey) return null;
  const cols = ["#FF6FB0", "#12BCB0", "#F5A524", "#8B7CF6", "#ff97c9"];
  const pieces = Array.from({ length: 48 }, (_, i) => ({
    left: 6 + ((i * 83) % 86),
    bg: cols[i % 5],
    dur: 1.1 + (i % 5) * 0.25,
    delay: (i % 9) * 0.04,
    rot: (i * 40) % 360,
  }));
  return (
    <div className="confetti" key={burstKey}>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="cf"
          style={{
            left: `${p.left}%`,
            top: "-20px",
            background: p.bg,
            animationDuration: `${p.dur}s`,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
