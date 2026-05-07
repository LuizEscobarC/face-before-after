type Flags = {
  beard?: boolean;
  beard_density?: number;
  glasses?: boolean;
  smile?: boolean;
};

const CHIP_DEFS: { key: keyof Flags; label: string; color: string }[] = [
  { key: "beard",   label: "Barba",  color: "#a78bfa" },
  { key: "glasses", label: "Óculos", color: "var(--accent2)" },
  { key: "smile",   label: "Sorriso", color: "#fcd34d" },
];

type Props = { flags: Flags };

export function FlagChips({ flags }: Props): JSX.Element | null {
  const active = CHIP_DEFS.filter(({ key }) => Boolean(flags[key]));
  if (active.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {active.map(({ key, label, color }) => (
        <span
          key={key}
          style={{
            fontSize: 11,
            padding: "3px 10px",
            borderRadius: 99,
            background: `${color}18`,
            border: `1px solid ${color}44`,
            color,
            letterSpacing: 0.3,
          }}
        >
          {label}
          {key === "beard" && flags.beard_density != null
            ? ` ${Math.round(flags.beard_density * 100)}%`
            : ""}
        </span>
      ))}
    </div>
  );
}
