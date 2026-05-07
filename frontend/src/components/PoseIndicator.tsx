type Axis = { yaw: number; pitch: number; roll: number };

const AXIS_LIMIT: Record<keyof Axis, number> = { yaw: 20, pitch: 20, roll: 15 };

function axisColor(value: number, limit: number): string {
  const abs = Math.abs(value);
  if (abs <= limit * 0.4) return "var(--accent2)";
  if (abs <= limit * 0.75) return "#fcd34d";
  return "#fca5a5";
}

type Props = { pose: Axis };

export function PoseIndicator({ pose }: Props): JSX.Element {
  const axes: { key: keyof Axis; label: string }[] = [
    { key: "yaw",   label: "Yaw" },
    { key: "pitch", label: "Pitch" },
    { key: "roll",  label: "Roll" },
  ];

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
      <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 }}>
        Pose
      </span>
      <div style={{ display: "flex", gap: 10 }}>
        {axes.map(({ key, label }) => {
          const val = pose[key];
          const color = axisColor(val, AXIS_LIMIT[key]);
          return (
            <span
              key={key}
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 99,
                background: `${color}22`,
                border: `1px solid ${color}55`,
                color,
                whiteSpace: "nowrap",
              }}
            >
              {label} {val >= 0 ? "+" : ""}{val.toFixed(1)}°
            </span>
          );
        })}
      </div>
    </div>
  );
}
