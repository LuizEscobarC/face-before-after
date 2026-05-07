type Props = {
  consistency_score: number;
  consistency_issues: string[];
  is_comparable: boolean;
};

export function ConsistencyWarning({ consistency_score, consistency_issues, is_comparable }: Props): JSX.Element | null {
  if (is_comparable && consistency_issues.length === 0) return null;

  const pct = Math.round(consistency_score * 100);
  const color = is_comparable ? "#fcd34d" : "#fca5a5";
  const bg = is_comparable ? "rgba(252,211,77,0.08)" : "rgba(252,165,165,0.08)";
  const title = is_comparable
    ? `Consistência parcial (${pct}%) — comparação válida, mas com ressalvas`
    : `Baixa consistência (${pct}%) — condições muito diferentes entre as fotos`;

  return (
    <div
      role="alert"
      style={{
        background: bg,
        border: `1px solid ${color}44`,
        borderRadius: 12,
        padding: "12px 16px",
        display: "grid",
        gap: 6,
      }}
    >
      <p style={{ margin: 0, color, fontWeight: 600, fontSize: 13 }}>{title}</p>
      {consistency_issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
          {consistency_issues.map((issue) => (
            <li key={issue} style={{ color: "var(--muted)", fontSize: 12 }}>
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
