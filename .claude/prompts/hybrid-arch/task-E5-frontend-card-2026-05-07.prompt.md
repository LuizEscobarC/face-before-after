# Task E5 — Frontend: PhotoQualityCard Melhorias + ConsistencyWarning
**Created**: 2026-05-07
**Stack**: React 18, TypeScript, CSS vars do design system (--surface, --accent, --accent2, --muted)
**Depende de**: E1 (flags com valores reais), E3 (consistency_score no compare response)
**Status**: ✅ IMPLEMENTADO

---

## 0. Contexto

O `PhotoQualityCard.tsx` atual exibe:
- Badge de decision (ACCEPT/WARN/REJECT) + grade + score circular
- Lista de recommendations
- Grid de 5 tiles de subscore (estáticos — apenas número, sem barra)

Esta task melhora o card com:
1. **Subscore bars** — barras horizontais coloridas por valor
2. **Pose indicator** — yaw/pitch/roll com status visual
3. **Flag chips** — pills quando `beard`, `glasses`, `smile` forem `true`
4. **ConsistencyWarning** — banner âmbar no compare view quando `consistency_score < 0.7`

---

## 1. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `frontend/src/components/PhotoQualityCard.tsx` | Substituir `Subscore` tile por `SubscoreBar`; adicionar `PoseIndicator`, `FlagChips` |
| `frontend/src/api.ts` | Adicionar `beard_density` em `flags`; novo type `CompareWithConsistency` |
| `frontend/src/components/ConsistencyWarning.tsx` | CRIAR — banner âmbar reutilizável |

---

## 2. Implementação

### 2.1 `api.ts` — atualizar types

Em `PhotoQualityDecision`, expandir `flags`:
```typescript
export type PhotoQualityDecision = {
  ...
  flags: {
    beard: boolean;
    beard_density: number;   // ← adicionar
    glasses: boolean;
    smile: boolean;
    hair_covering: boolean;
  };
  fingerprint_parts?: string[];  // ← adicionar (E3)
  ...
};
```

Novo type para compare response com ConsistencyScore (E3):
```typescript
export type CompareWithConsistency = CompareResult & {
  consistency_score?: number;
  consistency_issues?: string[];
  is_comparable?: boolean;
};
```

Atualizar `compareRuns()` para retornar `CompareWithConsistency`.

### 2.2 `PhotoQualityCard.tsx` — `SubscoreBar`

Substituir o componente `Subscore` (tile simples) por `SubscoreBar` com barra horizontal:

```tsx
function SubscoreBar({ label, value }: { label: string; value?: number }): JSX.Element {
  const pct = Math.round((value ?? 0) * 100);
  const color =
    pct >= 80 ? "#4ade80"   // verde
    : pct >= 60 ? "#fcd34d" // âmbar
    : "#fca5a5";            // vermelho

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{label}</span>
        <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{pct}</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 99,
          background: "var(--surface2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            borderRadius: 99,
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
    </div>
  );
}
```

Atualizar o `<section>` de subscores para usar `SubscoreBar`:
```tsx
<section style={{ display: "grid", gap: 10 }}>
  <SubscoreBar label="Pose"       value={decision.subscore_breakdown.pose_score} />
  <SubscoreBar label="Nitidez"    value={decision.subscore_breakdown.sharpness_score} />
  <SubscoreBar label="Iluminação" value={decision.subscore_breakdown.lighting_score} />
  <SubscoreBar label="Oclusão"    value={decision.subscore_breakdown.occlusion_score} />
  <SubscoreBar label="Expressão"  value={decision.subscore_breakdown.expression_score} />
</section>
```

### 2.3 `PoseIndicator` (adicionar ao card)

```tsx
function PoseIndicator({ pose }: { pose: { yaw: number; pitch: number; roll: number } }): JSX.Element {
  const POSE_IDEAL = { yaw: 8, pitch: 8, roll: 5 };
  const isOk = (axis: keyof typeof POSE_IDEAL, val: number) => Math.abs(val) <= POSE_IDEAL[axis];

  const axes = [
    { label: "Yaw",   value: pose.yaw,   ok: isOk("yaw",   pose.yaw) },
    { label: "Pitch", value: pose.pitch, ok: isOk("pitch", pose.pitch) },
    { label: "Roll",  value: pose.roll,  ok: isOk("roll",  pose.roll) },
  ];

  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        gap: 16,
      }}
    >
      <span style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", alignSelf: "center" }}>
        Posição
      </span>
      {axes.map(({ label, value, ok }) => (
        <div key={label} style={{ textAlign: "center" }}>
          <p style={{ margin: 0, color: ok ? "#4ade80" : "#fca5a5", fontWeight: 600, fontSize: 13 }}>
            {value >= 0 ? "+" : ""}{value.toFixed(1)}°
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 10 }}>{label}</p>
        </div>
      ))}
    </div>
  );
}
```

Adicionar `<PoseIndicator pose={decision.pose} />` no card, após o header e antes dos subscores.

### 2.4 `FlagChips` (adicionar ao card)

```tsx
function FlagChips({ flags }: { flags: PhotoQualityDecision["flags"] }): JSX.Element | null {
  const active: string[] = [];
  if (flags.beard)   active.push("Barba detectada");
  if (flags.glasses) active.push("Óculos detectado");
  if (flags.smile)   active.push("Sorriso detectado");
  if (flags.hair_covering) active.push("Cabelo cobrindo rosto");

  if (active.length === 0) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {active.map((label) => (
        <span
          key={label}
          style={{
            padding: "3px 10px",
            borderRadius: 99,
            fontSize: 11,
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#a5b4fc",
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
```

Adicionar `<FlagChips flags={decision.flags} />` após `PoseIndicator`.

### 2.5 `ConsistencyWarning.tsx` (CRIAR)

```tsx
// frontend/src/components/ConsistencyWarning.tsx
type Props = {
  score: number;
  issues: string[];
};

export function ConsistencyWarning({ score, issues }: Props): JSX.Element | null {
  if (score >= 0.7) return null;

  return (
    <div
      style={{
        background: "rgba(252,211,77,0.10)",
        border: "1px solid rgba(252,211,77,0.35)",
        borderRadius: 12,
        padding: "12px 16px",
        display: "grid",
        gap: 8,
      }}
    >
      <p style={{ margin: 0, color: "#fcd34d", fontWeight: 600, fontSize: 14 }}>
        ⚠ Condições diferentes detectadas (consistência: {Math.round(score * 100)}%)
      </p>
      {issues.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, color: "var(--muted)", fontSize: 13, display: "grid", gap: 2 }}>
          {issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>
      )}
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
        Para uma comparação oficial confiável, repita a captura nas mesmas condições.
      </p>
    </div>
  );
}
```

Usar no compare view (quando `compareResult.is_comparable === false`):
```tsx
{compareResult && !compareResult.is_comparable && compareResult.consistency_score !== undefined && (
  <ConsistencyWarning
    score={compareResult.consistency_score}
    issues={compareResult.consistency_issues ?? []}
  />
)}
```

---

## 3. Regras de Design

- Usar **apenas CSS variables** do design system (`--surface`, `--surface2`, `--border`, `--text`, `--muted`, `--accent`, `--accent2`)
- Cores das barras: verde `#4ade80` (≥80), âmbar `#fcd34d` (≥60), vermelho `#fca5a5` (<60)
- Chips de flags: estilo indigo (`rgba(99,102,241,0.12)` + `#a5b4fc`)
- `ConsistencyWarning`: estilo âmbar (`rgba(252,211,77,0.10)`)
- Transições suaves: `transition: "width 0.4s ease"` nas barras
- Sem novos pacotes de UI — React puro + CSS vars

---

## 4. Verificação

```bash
# Iniciar frontend local
cd frontend && npm run dev

# Acessar http://localhost:5173
# Upload de foto → verificar:
#   1. SubscoreBar aparece como barra horizontal colorida
#   2. PoseIndicator mostra yaw/pitch/roll em graus (verde se dentro do ideal)
#   3. FlagChips aparece se backend reportar beard/glasses/smile = true

# Compare com consistency_score baixo:
# (modificar manualmente no mock ou usar dois runs com condições diferentes)
# ConsistencyWarning deve aparecer como banner âmbar

# TypeScript check
npx tsc --noEmit
```

---

## 5. Checklist

- [x] `SubscoreBar` com barra horizontal e cores dinâmicas (verde/âmbar/vermelho)
- [x] `PoseIndicator` exibe yaw/pitch/roll com cor OK/ERRO
- [x] `FlagChips` exibe chips para beard/glasses/smile quando `true`
- [x] `ConsistencyWarning.tsx` criado e importado no compare view
- [x] `api.ts` tem `beard_density: number` em `flags` e `CompareWithConsistency` type
- [x] Nenhuma cor hardcoded — todos usam CSS vars ou as 3 constantes de cor definidas acima
- [x] `npx tsc --noEmit` sem erros
