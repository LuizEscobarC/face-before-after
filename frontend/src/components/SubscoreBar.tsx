const BAR_COLORS = {
  good:   { fg: "var(--accent2)",  bg: "rgba(34,211,238,0.15)"  },
  warn:   { fg: "#fcd34d",         bg: "rgba(252,211,77,0.12)"  },
  bad:    { fg: "#fca5a5",         bg: "rgba(252,165,165,0.12)" },
} as const;

function barColor(value: number) {
  if (value >= 0.75) return BAR_COLORS.good;
  if (value >= 0.45) return BAR_COLORS.warn;
  return BAR_COLORS.bad;
}

type Props = { label: string; value?: number };

export function SubscoreBar({ label, value }: Props): JSX.Element {
  const pct = Math.round((value ?? 0) * 100);
  const { fg, bg } = barColor(value ?? 0);

  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "10px 12px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </span>
        <span style={{ color: "var(--text)", fontWeight: 700, fontSize: 14 }}>{pct}</span>
      </div>
      <div style={{ background: bg, borderRadius: 99, height: 6, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: fg,
            borderRadius: 99,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
