---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-premium-upgrade-2026-05-04.prompt"
file_path: ".claude/prompts/face-analysis/task-premium-upgrade-2026-05-04.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "face-analysis"
  - "task-prompt"
rag_keywords:
  - "analysis"
  - "face"
  - "premium"
  - "prompt"
  - "prompts"
  - "upgrade"
related_modules: []
depends_on: []
used_by: []
---
# Task: Premium Features — Full Upgrade
**Module:** face-analysis  
**Type:** feature  
**Slug:** premium-upgrade  
**Date:** 2026-05-04  
**Plan:** `.claude/plans/premium-upgrade-2026-05-04.md`

---

## Context Summary

### Stack
- **Backend:** Python 3.10 + FastAPI (`api_server.py`) + `mvp_pipeline.py` que orquestra `impression_layer.py`, `visual_status.py`, `top_leverage.py`, `evolution_path.py`, `recommendations.py`, `glossary.py`
- **Frontend:** React 18 + TypeScript + Vite, React Router, zero component library — CSS manual em `styles.css`
- **Infra:** Docker Compose; API em `:9015`, Frontend em `:9016`
- **NO tests** — não há suíte de testes automatizados; verificar manualmente com curl + DevTools

### Arquivos principais (lidos antes de implementar)
| Arquivo | Propósito |
|---------|-----------|
| `frontend/src/types.ts` | Tipos TypeScript do resultado da análise |
| `frontend/src/pages/PremiumResultPage.tsx` | Página de resultado premium (~380 linhas) |
| `frontend/src/pages/CapturePage.tsx` | Upload + câmera + seleção de modo |
| `frontend/src/pages/FreeResultPage.tsx` | Resultado gratuito (referência de padrão) |
| `frontend/src/App.tsx` | Roteamento (7 linhas) |
| `frontend/src/api.ts` | Helpers de fetch |
| `frontend/src/styles.css` | Design system completo (~680 linhas) |
| `mvp_pipeline.py` | Pipeline principal — função `run()` monta o dict de resultado |
| `api_server.py` | Endpoints FastAPI |
| `recommendations.py` | `recommend(measurements)` → lista de ações por métrica |
| `glossary.py` | `GLOSSARY` dict com 15 termos |
| `compare_report.py` | `generate_report()` texto — precisamos adicionar `compare_json()` |
| `evolution_path.py` | `build_evolution_path()` → phases com `skin_alert`, `mutable_metrics` |
| `impression_layer.py` | `build_first_impression()` → `{headline, tags, main_risk, positive_signal}` |

### Design System (styles.css — CSS variables)
```css
--bg: #0a0a12; --surface: #13131f; --surface2: #1c1c2e;
--border: rgba(255,255,255,0.07); --text: #e2e8f0; --muted: #94a3b8;
--accent: #6366f1; --accent2: #22d3ee; --radius: 16px;
```
Classes existentes a reutilizar: `.section`, `.section-title`, `.section-sub`, `.phase-card`, `.phase-header`, `.action-card`, `.sev-pill`, `.sev-*`, `.bar-row`, `.bar-track`, `.bar-fill`, `.badge-pill`, `.metric-group` (`<details>`), `.narrative`

---

## Dependency Referential Graph

### Backend → Frontend (dados que já existem no JSON mas NÃO estão no tipo)

| Campo JSON | Origem Python | Tipo real |
|------------|--------------|-----------|
| `capture_confidence` | `compute_capture_confidence()` | `float` 0–1 |
| `measurements` | `fm.compute_all()` + `asymmetry_measurements` | `dict[str, any]` |
| `first_impression.tags` | `build_first_impression()` | `list[str]` |
| `first_impression.main_risk` | `build_first_impression()` | `str` |
| `top3_actions_v2[].tier` | `get_top3_actions()` | `int` 0/1/2 |
| `top3_actions_v2[].metric_key` | `get_top3_actions()` | `str` |
| `evolution_path.skin_alert` | `build_evolution_path()` | `bool` |
| `evolution_path.mutable_metrics` | `build_evolution_path()` | `list[str]` |
| `phase_*.confidence_score` | `build_evolution_path()` | `float` 0–1 |
| `phase_*.requires_professional` | `build_evolution_path()` | `bool` |

### Campos em `measurements` usados na seção de assimetria regional
```
eye_level_difference_pct_ipd     # diferença de nível dos olhos
eye_horizontal_asymmetry_pct_ipd # assimetria horizontal dos olhos
nose_deviation_pct_ipd           # desvio nasal
mouth_deviation_pct_ipd          # desvio labial
chin_deviation_pct_ipd           # desvio do queixo
```

### Campos em `measurements` usados nos cards de pele/forma
```
face_shape_label          # str: "oval" | "round" | "square" | "heart" | "oblong"
under_eye_darkness_left   # float 0–1
under_eye_darkness_right  # float 0–1
skin_uniformity_std_lab_left   # float (menor = melhor)
skin_uniformity_std_lab_right  # float
marquardt_deviation_pct_ipd    # float: desvio da máscara áurea de Marquardt
```

### `recommendations.recommend()` — estrutura de retorno
```python
# List[Dict] — cada item:
{
    "metric_key": str,
    "metric_label": str,
    "severity": str,       # "excelente" | "leve" | "moderada" | "acentuada" | "severa"
    "value": Any,
    "ideal": str,
    "what_is": str,        # explicação em português
    "how_measured": str,
    "why_matters": str,
    "actions": [           # lista de ações para a severidade atual
        {
            "tipo": str,       # "habito" | "postura" | "exercicio" | "profissional"
            "titulo": str,
            "descricao": str,
            "frequencia": str,
            "fonte": {"titulo": str, "url": str}
        }
    ],
    "references": [{"titulo": str, "url": str}]
}
```

### `GLOSSARY` — estrutura de cada termo
```python
{
    "termo": str,
    "unidade": str,
    "descricao": str,
    "como_medido": str,
    "faixas": str,
    "problemas_comuns": list[str],
    "referencias": [{"titulo": str, "url": str}]
}
```
15 termos: `ipd`, `fwhr`, `canthal_tilt`, `gonial_angle`, `marquardt`, `lab_delta_e`, `laplacian_sharpness`, `solvepnp_pose`, `thirds_fifths`, `face_shape`, `ear`

### `compare_json()` — estrutura de retorno esperada (nova função)
```python
{
    "score_before": int,
    "score_after": int,
    "score_delta": int,     # score_after - score_before
    "tier_before": str,
    "tier_after": str,
    "metrics": [
        {
            "key": str,
            "label": str,
            "before": float,
            "after": float,
            "delta": float,   # after - before (positivo = melhorou = assimetria reduziu)
            "improved": bool
        }
    ],
    "improved_count": int,
    "worsened_count": int,
    "top_improvements": [...]  # 3 melhores, sorted by abs(delta) desc
    "top_regressions": [...]   # 3 piores, se houver
}
```
NOTA: Para assimetria, delta positivo = valor menor (menos assimetria) = melhoria.
Para scores (score_after > score_before), delta positivo = melhoria.

---

## ReAct Self-Reflection

✅ Todos os campos JSON verificados em `mvp_pipeline.py` (função `run()`, dict `result`)  
✅ Tipo `EvolutionPhase` já tem `actions[].metric_label` mas faltam `confidence_score`, `requires_professional`  
✅ `AnalysisResult.first_impression` já tem `main_risk` no tipo mas `tags` está ausente  
✅ `top3_actions_v2[]` não tem `tier` nem `metric_key` no tipo  
✅ `evolution_path` não tem `skin_alert` nem `mutable_metrics` no tipo  
✅ Nenhuma mutação de banco de dados — operações são file I/O e cálculos  
✅ Nenhuma autenticação necessária — API é pública por design  
✅ Links externos em referências DEVEM ter `rel="noopener noreferrer"` (segurança)  
✅ RadarChart SVG deve ter `aria-label` (acessibilidade mínima)  
✅ Fase 4: `run_id` deve ser validado contra path traversal (`../`) antes de ler JSON  

---

## Instruções de Implementação

### FASE 1 — Zero backend, apenas tipos e UI

#### 1.1 Atualizar `frontend/src/types.ts`

Adicionar os seguintes campos:

```typescript
// Em AnalysisResult, adicionar:
capture_confidence?: number;
measurements?: Record<string, number | string | boolean | null>;

// Em first_impression:
first_impression?: {
  headline?: string;
  positive_signal?: string;
  main_risk?: string;
  tags?: string[];   // ADICIONAR
};

// Em top3_actions_v2[]:
top3_actions_v2?: Array<{
  rank: number;
  short_action: string;
  why_it_matters: string;
  time_to_result: string;
  tier?: number;       // ADICIONAR (0=hoje, 1=semanas, 2=meses)
  metric_key?: string; // ADICIONAR
}>;

// Em evolution_path:
evolution_path?: {
  phase_1?: EvolutionPhase;
  phase_2?: EvolutionPhase;
  phase_3?: EvolutionPhase;
  skin_alert?: boolean;        // ADICIONAR
  mutable_metrics?: string[];  // ADICIONAR
};

// Em EvolutionPhase:
export type EvolutionPhase = {
  label?: string;
  focus?: string;
  confidence_label?: string;
  confidence_score?: number;         // ADICIONAR (0–1)
  requires_professional?: boolean;   // ADICIONAR
  reanalysis_date?: string;
  reanalysis_label?: string;
  actions?: Array<{
    titulo: string;
    descricao: string;
    frequencia: string;
    metric_label?: string;
  }>;
};
```

#### 1.2 Atualizar `frontend/src/pages/PremiumResultPage.tsx`

**1.2.a — Tags de percepção** (adicionar após `.headline-text` dentro de `headline-box`):
```tsx
{result.first_impression?.tags && result.first_impression.tags.length > 0 && (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
    {result.first_impression.tags.map((tag, i) => (
      <span key={i} className="badge-pill">{tag}</span>
    ))}
  </div>
)}
```

**1.2.b — Risco principal** (adicionar após `positive-signal`):
```tsx
{result.first_impression?.main_risk && (
  <div style={{
    marginTop: 10, padding: '10px 14px',
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 10, fontSize: 13, color: '#fda4af'
  }}>
    ⚠️ {result.first_impression.main_risk}
  </div>
)}
```

**1.2.c — Tier badges nas action-cards**:

Criar mapa antes do return:
```typescript
const TIER_LABEL: Record<number, string> = { 0: '⚡ Hoje', 1: '🎯 Semanas', 2: '🏅 Meses' };
```

No action-card, adicionar abaixo de `.action-time`:
```tsx
{item.tier !== undefined && (
  <div style={{ fontSize: 10, marginTop: 4, color: 'var(--muted)' }}>
    <span className="badge-pill">{TIER_LABEL[item.tier] ?? `Tier ${item.tier}`}</span>
  </div>
)}
```

**1.2.d — Barra de confiança da captura** (adicionar dentro da seção de avisos, antes da lista de warnings):
```tsx
{result.capture_confidence !== undefined && (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
      Confiança da captura: <strong style={{ color: '#fde68a' }}>{Math.round(result.capture_confidence * 100)}%</strong>
    </div>
    <div className="bar-track" style={{ height: 8 }}>
      <div className="bar-fill" style={{ width: `${result.capture_confidence * 100}%` }} />
    </div>
  </div>
)}
```

**1.2.e — Banner skin alert** (adicionar ANTES da seção de evolução):
```tsx
{result.evolution_path?.skin_alert && (
  <div className="benchmark-strip" style={{
    background: 'rgba(99,102,241,0.08)',
    borderColor: 'rgba(99,102,241,0.25)',
  }}>
    <div className="benchmark-icon">🌞</div>
    <div>
      <div className="benchmark-text">Alerta de pele detectado</div>
      <div className="benchmark-ctx">SPF 30+ diariamente + hidratante noturno são prioritários. Efeito visível em semanas com custo mínimo.</div>
    </div>
  </div>
)}
```

**1.2.f — Mutable metrics count** (adicionar no `<h2>` da seção de evolução ou abaixo do `section-sub`):
```tsx
{result.evolution_path?.mutable_metrics && result.evolution_path.mutable_metrics.length > 0 && (
  <div style={{ marginBottom: 14, fontSize: 13, color: '#a5b4fc' }}>
    🔄 {result.evolution_path.mutable_metrics.length} métricas mutáveis identificadas no seu perfil
  </div>
)}
```

**1.2.g — confidence_score por fase** (no phase-card, após `.phase-focus`):
```tsx
{phase.confidence_score !== undefined && (
  <div style={{ marginTop: 6 }}>
    <div className="bar-track" style={{ height: 4 }}>
      <div className="bar-fill" style={{ width: `${phase.confidence_score * 100}%`, opacity: 0.6 }} />
    </div>
    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
      Confiança do plano: {phase.confidence_label ?? `${Math.round(phase.confidence_score * 100)}%`}
    </div>
  </div>
)}
```

**1.2.h — requires_professional badge** (no phase-card, após phase-actions):
```tsx
{phase.requires_professional && (
  <div style={{ marginTop: 8 }}>
    <span className="badge-pill" style={{ background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: '#fda4af' }}>
      🏥 Requer avaliação profissional
    </span>
  </div>
)}
```

**1.2.i — metric_label por ação de fase** (no `<li>` de phase-actions, após `.phase-freq`):
```tsx
{a.metric_label && (
  <span style={{ fontSize: 10, color: '#6366f1', display: 'block', marginTop: 2 }}>
    📌 {a.metric_label}
  </span>
)}
```

#### 1.3 Assimetria regional — nova seção em `PremiumResultPage.tsx`

Criar APÓS a seção "Primeira Impressão" (onde está o `headline-box`):
```tsx
{/* ── Assimetria Regional ── */}
{result.measurements && (
  <section className="section">
    <h2 className="section-title">📐 Assimetria por Região</h2>
    <p className="section-sub">Desvio medido em % do IPD (distância interpupilar). Referência: &lt; 2% = invisível a olho nu.</p>
    {[
      { label: '👁 Nível dos Olhos',    key: 'eye_level_difference_pct_ipd' },
      { label: '👁 Eixo Horizontal',    key: 'eye_horizontal_asymmetry_pct_ipd' },
      { label: '👃 Nariz',              key: 'nose_deviation_pct_ipd' },
      { label: '👄 Boca',              key: 'mouth_deviation_pct_ipd' },
      { label: '🫀 Queixo',            key: 'chin_deviation_pct_ipd' },
    ].map(({ label, key }) => {
      const raw = result.measurements?.[key];
      const val = typeof raw === 'number' ? raw : null;
      const pct = val !== null ? Math.min((val / 8) * 100, 100) : 0; // 8% IPD = severidade máxima
      const sev = val === null ? '—' : val < 1 ? 'Excelente' : val < 2 ? 'Leve' : val < 4 ? 'Moderada' : val < 8 ? 'Acentuada' : 'Severa';
      const sevCls = val === null ? 'sev-info' : val < 1 ? 'sev-excelente' : val < 2 ? 'sev-leve' : val < 4 ? 'sev-moderada' : val < 8 ? 'sev-acentuada' : 'sev-severa';
      return (
        <div key={key} className="bar-row" style={{ marginBottom: 14 }}>
          <div className="bar-label" style={{ minWidth: 140, fontSize: 12 }}>{label}</div>
          <div className="bar-track" style={{ flex: 1 }}>
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ minWidth: 44, textAlign: 'right', fontSize: 11 }}>
            {val !== null ? `${val.toFixed(1)}%` : '—'}
          </div>
          <span className={`sev-pill ${sevCls}`} style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>{sev}</span>
        </div>
      );
    })}
  </section>
)}
```

#### 1.4 Cards: Forma Facial + Pele + Máscara Áurea

Criar APÓS a seção de Assimetria Regional:
```tsx
{/* ── Perfil Facial ── */}
{result.measurements && (
  <section className="section">
    <h2 className="section-title">🪞 Perfil Facial Detalhado</h2>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>

      {/* Forma facial */}
      {result.measurements.face_shape_label && (() => {
        const SHAPE_INFO: Record<string, string> = {
          oval: 'Oval — formato mais versátil; compatível com a maioria dos estilos de corte e barba.',
          round: 'Redonda — cortes com volume no topo alongam visualmente o rosto.',
          square: 'Quadrada — mandíbula marcada; cortes suavizantes valorizam a simetria.',
          heart: 'Coração — testa larga; cortes com mais volume nas têmporas equilibram.',
          oblong: 'Oblonga — rosto longo; evitar cortes com muito volume no topo.',
        };
        const shape = String(result.measurements!.face_shape_label);
        return (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Forma Facial</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#a5b4fc', textTransform: 'capitalize', marginBottom: 6 }}>{shape}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{SHAPE_INFO[shape.toLowerCase()] ?? shape}</div>
          </div>
        );
      })()}

      {/* Olheiras */}
      {(result.measurements.under_eye_darkness_left !== undefined || result.measurements.under_eye_darkness_right !== undefined) && (() => {
        const l = typeof result.measurements!.under_eye_darkness_left === 'number' ? result.measurements!.under_eye_darkness_left as number : 0;
        const r = typeof result.measurements!.under_eye_darkness_right === 'number' ? result.measurements!.under_eye_darkness_right as number : 0;
        const avg = (l + r) / 2;
        const sev = avg < 0.08 ? 'Excelente' : avg < 0.15 ? 'Leve' : avg < 0.25 ? 'Moderada' : 'Acentuada';
        const sevCls = avg < 0.08 ? 'sev-excelente' : avg < 0.15 ? 'sev-leve' : avg < 0.25 ? 'sev-moderada' : 'sev-acentuada';
        return (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Olheiras</div>
            <span className={`sev-pill ${sevCls}`}>{sev}</span>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Índice de escuridão subocular: {avg.toFixed(2)}</div>
          </div>
        );
      })()}

      {/* Uniformidade de pele */}
      {(result.measurements.skin_uniformity_std_lab_left !== undefined || result.measurements.skin_uniformity_std_lab_right !== undefined) && (() => {
        const l = typeof result.measurements!.skin_uniformity_std_lab_left === 'number' ? result.measurements!.skin_uniformity_std_lab_left as number : 0;
        const r = typeof result.measurements!.skin_uniformity_std_lab_right === 'number' ? result.measurements!.skin_uniformity_std_lab_right as number : 0;
        const avg = (l + r) / 2;
        const sev = avg < 10 ? 'Excelente' : avg < 15 ? 'Leve' : avg < 20 ? 'Moderada' : 'Acentuada';
        const sevCls = avg < 10 ? 'sev-excelente' : avg < 15 ? 'sev-leve' : avg < 20 ? 'sev-moderada' : 'sev-acentuada';
        return (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Uniformidade de Pele</div>
            <span className={`sev-pill ${sevCls}`}>{sev}</span>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Desvio ΔE Lab: {avg.toFixed(1)} (ideal &lt; 10)</div>
          </div>
        );
      })()}

      {/* Máscara Áurea (Marquardt) */}
      {result.measurements.marquardt_deviation_pct_ipd !== undefined && (() => {
        const dev = typeof result.measurements!.marquardt_deviation_pct_ipd === 'number' ? result.measurements!.marquardt_deviation_pct_ipd as number : 0;
        const sev = dev < 2 ? 'Excelente' : dev < 4 ? 'Leve' : dev < 8 ? 'Moderada' : 'Acentuada';
        const sevCls = dev < 2 ? 'sev-excelente' : dev < 4 ? 'sev-leve' : dev < 8 ? 'sev-moderada' : 'sev-acentuada';
        return (
          <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', gridColumn: 'span 1' }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Máscara Áurea (Marquardt)</div>
            <span className={`sev-pill ${sevCls}`}>{sev}</span>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Desvio: {dev.toFixed(1)}% IPD (referência de proporção áurea)</div>
          </div>
        );
      })()}
    </div>
  </section>
)}
```

---

### FASE 2 — Backend: Recommendations + Glossário

#### 2.1 Adicionar `recommendations` ao payload — `mvp_pipeline.py`

Na função `run()`, logo após a linha `capture_recommendations = build_capture_recommendations(photo_quality_metrics)`, adicionar:

```python
rec_plan = rec.recommend(measurements) if analysis_mode == "premium" else []
```

No dict `result`, adicionar a chave:
```python
'recommendations': rec_plan,
```

IMPORTANTE: `rec.recommend()` já existe e está importado. Não criar nada novo — apenas chamar e incluir no JSON.

#### 2.2 Novo endpoint `/api/glossary` — `api_server.py`

Verificar imports existentes, adicionar import de glossary se não existir:
```python
import glossary as gl
```

Adicionar endpoint ANTES do bloco `if __name__ == "__main__":`:
```python
@app.get("/api/glossary")
async def get_glossary():
    """Retorna o glossário completo de termos da análise facial."""
    return gl.GLOSSARY
```

#### 2.3 Adicionar tipos em `frontend/src/types.ts`

Adicionar os novos tipos (antes de `AnalysisResult`):
```typescript
export type RecommendationAction = {
  tipo: string;
  titulo: string;
  descricao: string;
  frequencia: string;
  fonte?: { titulo: string; url: string };
};

export type MetricRecommendation = {
  metric_key: string;
  metric_label: string;
  severity: string;
  value: unknown;
  ideal: string;
  what_is: string;
  how_measured: string;
  why_matters: string;
  actions: RecommendationAction[];
  references: { titulo: string; url: string }[];
};

export type GlossaryTerm = {
  termo: string;
  unidade: string;
  descricao: string;
  como_medido: string;
  faixas: string;
  problemas_comuns: string[];
  referencias: { titulo: string; url: string }[];
};
```

Em `AnalysisResult`, adicionar:
```typescript
recommendations?: MetricRecommendation[];
```

Adicionar helper de fetch em `frontend/src/api.ts`:
```typescript
export async function fetchGlossary(): Promise<Record<string, GlossaryTerm>> {
  const res = await fetch("/api/glossary");
  if (!res.ok) throw new Error("Glossário indisponível");
  return res.json();
}
```

#### 2.4 Fetch glossário em `PremiumResultPage.tsx`

Adicionar import do helper e state:
```typescript
import { fetchGlossary } from "../api";
import type { GlossaryTerm } from "../types";

// Dentro do componente:
const [glossary, setGlossary] = useState<Record<string, GlossaryTerm>>({});

useEffect(() => {
  fetchGlossary().then(setGlossary).catch(() => {});
}, []);
```

---

### FASE 3 — Novas seções UI

#### 3.1 Seção "Plano de Ação Detalhado" — após Top 3 Ações

Adicionar nova seção DEPOIS do bloco de `top3_actions_v2`:
```tsx
{/* ── Plano Detalhado por Métrica ── */}
{result.recommendations && result.recommendations.filter(r => r.severity !== 'excelente').length > 0 && (
  <section className="section">
    <h2 className="section-title">🎯 Plano de Ação Detalhado</h2>
    <p className="section-sub">Cada métrica fora do ideal com ações específicas e embasamento científico.</p>
    {result.recommendations
      .filter(r => r.severity !== 'excelente')
      .map(rec => (
        <details key={rec.metric_key} className="metric-group" style={{ marginBottom: 10 }}>
          <summary style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{rec.metric_label}</span>
            <span className={`sev-pill sev-${rec.severity.toLowerCase().includes('excel') ? 'excelente' : rec.severity.toLowerCase().includes('leve') ? 'leve' : rec.severity.toLowerCase().includes('moder') ? 'moderada' : rec.severity.toLowerCase().includes('acent') ? 'acentuada' : 'severa'}`}>
              {rec.severity}
            </span>
          </summary>
          <div style={{ padding: '16px 18px', borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}><strong style={{ color: 'var(--text)' }}>O que é:</strong> {rec.what_is}</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}><strong style={{ color: 'var(--text)' }}>Por que importa:</strong> {rec.why_matters}</p>
            {rec.actions.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a78bfa', marginBottom: 8 }}>Ações recomendadas</div>
                {rec.actions.map((action, i) => (
                  <div key={i} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', marginBottom: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{action.titulo}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{action.descricao}</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      <span style={{ color: '#67e8f9' }}>⏱ {action.frequencia}</span>
                      <span className="badge-pill" style={{ marginLeft: 8, fontSize: 10 }}>{action.tipo}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rec.references.length > 0 && (
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Referências:</div>
                {rec.references.map((ref, i) => (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'block', fontSize: 11, color: '#6366f1', textDecoration: 'none', marginBottom: 3 }}>
                    ↗ {ref.titulo}
                  </a>
                ))}
              </div>
            )}
          </div>
        </details>
      ))
    }
  </section>
)}
```

#### 3.2 Radar Chart SVG (Percepção Visual)

Criar componente `RadarChart` DENTRO do arquivo `PremiumResultPage.tsx` (antes do export principal):
```tsx
interface RadarScores { dominance: number; attractiveness: number; freshness: number; }

function RadarChart({ scores }: { scores: RadarScores }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = 75;
  const maxVal = 10;

  // Triângulo equilateral: 3 eixos a 120° cada; topo = -90°
  const angles = [-90, 30, 150]; // graus
  const vals = [scores.dominance ?? 0, scores.attractiveness ?? 0, scores.freshness ?? 0];
  const labels = ['Dominância', 'Atratividade', 'Vitalidade'];

  const toXY = (angleDeg: number, r: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Grades (3 anéis)
  const rings = [0.33, 0.67, 1.0];
  const ringPaths = rings.map(frac => {
    const pts = angles.map(a => toXY(a, maxR * frac));
    return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y} Z`;
  });

  // Área de dados
  const dataPts = vals.map((v, i) => toXY(angles[i], (Math.min(v, maxVal) / maxVal) * maxR));
  const dataPath = `M ${dataPts[0].x} ${dataPts[0].y} L ${dataPts[1].x} ${dataPts[1].y} L ${dataPts[2].x} ${dataPts[2].y} Z`;

  // Labels (empurrar para fora do anel)
  const labelOffset = maxR + 20;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label="Radar de percepção visual">
      {/* Grade */}
      {ringPaths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
      ))}
      {/* Eixos */}
      {angles.map((a, i) => {
        const end = toXY(a, maxR);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />;
      })}
      {/* Área de dados */}
      <path d={dataPath} fill="rgba(99,102,241,0.3)" stroke="#6366f1" strokeWidth={2} />
      {/* Pontos */}
      {dataPts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={4} fill="#6366f1" />
      ))}
      {/* Labels */}
      {angles.map((a, i) => {
        const lp = toXY(a, labelOffset);
        return (
          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle"
            fontSize="10" fill="var(--muted)" fontFamily="system-ui">
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}
```

Substituir o bloco `<BarRow>` na seção "Percepção Visual" por:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
  <RadarChart scores={{
    dominance: result.visual_status.dominance_score ?? 0,
    attractiveness: result.visual_status.attractiveness_score ?? 0,
    freshness: result.visual_status.freshness_score ?? 0,
  }} />
  <div style={{ flex: 1, minWidth: 160 }}>
    <BarRow label="Dominância" value={result.visual_status.dominance_score} />
    <BarRow label="Atratividade" value={result.visual_status.attractiveness_score} />
    <BarRow label="Vitalidade" value={result.visual_status.freshness_score} />
  </div>
</div>
```

#### 3.3 Glossário interativo

Adicionar seção ANTES do `<div className="footer">`:
```tsx
{Object.keys(glossary).length > 0 && (
  <section className="section">
    <h2 className="section-title">📖 Glossário de Métricas</h2>
    <p className="section-sub">Termos técnicos usados nesta análise com definições e referências científicas.</p>
    {Object.entries(glossary).map(([key, term]) => (
      <details key={key} className="metric-group" style={{ marginBottom: 8 }}>
        <summary>
          <span>{term.termo}</span>
          {term.unidade && <span className="metric-count">{term.unidade}</span>}
        </summary>
        <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)', fontSize: 13 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 8 }}>{term.descricao}</p>
          {term.faixas && <p style={{ color: 'var(--muted)', marginBottom: 8 }}><strong style={{ color: 'var(--text)' }}>Faixas:</strong> {term.faixas}</p>}
          {term.como_medido && <p style={{ color: 'var(--muted)', marginBottom: 8 }}><strong style={{ color: 'var(--text)' }}>Como medimos:</strong> {term.como_medido}</p>}
          {term.problemas_comuns.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ color: 'var(--text)', fontSize: 12 }}>Problemas comuns:</strong>
              <ul style={{ paddingLeft: 16, marginTop: 4, color: 'var(--muted)' }}>
                {term.problemas_comuns.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </div>
          )}
          {term.referencias.length > 0 && (
            <div>
              {term.referencias.map((ref, i) => (
                <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'block', fontSize: 11, color: '#6366f1', textDecoration: 'none', marginBottom: 3 }}>
                  ↗ {ref.titulo}
                </a>
              ))}
            </div>
          )}
        </div>
      </details>
    ))}
  </section>
)}
```

---

### FASE 4 — Fluxo Antes/Depois

#### 4.1 Função `compare_json()` em `compare_report.py`

Adicionar no final do arquivo:
```python
def compare_json(report_before: dict, report_after: dict) -> dict:
    """Compara dois relatórios JSON e retorna delta estruturado."""
    score_before = int(report_before.get("score", 0))
    score_after  = int(report_after.get("score", 0))

    tier_before = report_before.get("tier", "—")
    tier_after  = report_after.get("tier", "—")

    # Extrair measurements de forma compatível
    m_before = report_before.get("measurements", report_before)
    m_after  = report_after.get("measurements", report_after)

    COMPARE_KEYS = {
        "overall_asymmetry_score_pct_ipd": "Assimetria geral",
        "eye_level_difference_pct_ipd":    "Nível dos olhos",
        "eye_horizontal_asymmetry_pct_ipd": "Eixo horizontal",
        "nose_deviation_pct_ipd":           "Desvio nasal",
        "mouth_deviation_pct_ipd":          "Desvio labial",
        "chin_deviation_pct_ipd":           "Desvio do queixo",
        "fwhr":                             "Largura-altura facial",
        "canthal_tilt_mean_deg":            "Inclinação canthal",
        "lower_third_ratio":                "Terço inferior",
        "jawline_definition_score":         "Definição mandibular",
        "marquardt_deviation_pct_ipd":      "Desvio Máscara Áurea",
        "under_eye_darkness_left":          "Olheira esquerda",
        "under_eye_darkness_right":         "Olheira direita",
    }

    metrics = []
    for key, label in COMPARE_KEYS.items():
        v_before = m_before.get(key)
        v_after  = m_after.get(key)
        if v_before is None or v_after is None:
            continue
        try:
            vb = float(v_before)
            va = float(v_after)
        except (TypeError, ValueError):
            continue
        # Para métricas de assimetria/desvio: menor é melhor → delta = vb - va (positivo = melhorou)
        # Para jawline_definition_score, canthal_tilt: maior é melhor → delta = va - vb
        HIGHER_IS_BETTER = {"jawline_definition_score", "canthal_tilt_mean_deg"}
        if key in HIGHER_IS_BETTER:
            delta = va - vb
        else:
            delta = vb - va  # positivo = valor caiu = melhorou
        metrics.append({
            "key": key,
            "label": label,
            "before": round(vb, 3),
            "after": round(va, 3),
            "delta": round(delta, 3),
            "improved": delta > 0,
        })

    improved = [m for m in metrics if m["improved"]]
    worsened = [m for m in metrics if not m["improved"] and m["delta"] != 0]

    top_improvements = sorted(improved, key=lambda x: abs(x["delta"]), reverse=True)[:3]
    top_regressions  = sorted(worsened, key=lambda x: abs(x["delta"]), reverse=True)[:3]

    return {
        "score_before":    score_before,
        "score_after":     score_after,
        "score_delta":     score_after - score_before,
        "tier_before":     tier_before,
        "tier_after":      tier_after,
        "metrics":         metrics,
        "improved_count":  len(improved),
        "worsened_count":  len(worsened),
        "top_improvements": top_improvements,
        "top_regressions":  top_regressions,
    }
```

#### 4.2 Endpoint `POST /api/compare` em `api_server.py`

Adicionar import de `compare_report` se não existir:
```python
import compare_report as cr
```

Adicionar classe Pydantic para o body e o endpoint:
```python
from pydantic import BaseModel

class CompareRequest(BaseModel):
    run_id_before: str
    run_id_after: str

@app.post("/api/compare")
async def compare_runs(req: CompareRequest):
    """Compara dois run_ids retornando delta estruturado de métricas."""
    import json, re, glob

    # Validar run_ids contra path traversal
    def _validate_run_id(rid: str) -> str:
        if not re.match(r'^[a-f0-9]{12}$', rid):
            raise HTTPException(status_code=400, detail=f"run_id inválido: {rid}")
        return rid

    rid_before = _validate_run_id(req.run_id_before)
    rid_after  = _validate_run_id(req.run_id_after)

    BASE = "resultado_api"

    def _load_json(rid: str) -> dict:
        pattern = os.path.join(BASE, rid, "*_mvp_report.json")
        matches = glob.glob(pattern)
        if not matches:
            raise HTTPException(status_code=404, detail=f"Resultado não encontrado: {rid}")
        with open(matches[0], encoding="utf-8") as f:
            return json.load(f)

    report_before = _load_json(rid_before)
    report_after  = _load_json(rid_after)

    return cr.compare_json(report_before, report_after)
```

NOTA: `os` já está importado em `api_server.py`. Verificar se `HTTPException` e `BaseModel` já estão importados; adicionar apenas o que faltar.

#### 4.3 Modo compare em `CapturePage.tsx`

Em `types.ts`, alterar:
```typescript
export type AnalyzeMode = "free" | "premium" | "compare";
```

Em `CapturePage.tsx`, adicionar:
- Terceiro `mode-btn` para "compare"
- State para segundo arquivo: `const [fileBefore, setFileBefore] = useState<File | null>(null);` e `const [fileAfter, setFileAfter] = useState<File | null>(null);`
- Lógica condicional no submit:
  ```typescript
  if (mode === "compare") {
    // 1. Analisar fileBefore → POST /api/analyze/premium → run_id_before
    // 2. Analisar fileAfter  → POST /api/analyze/premium → run_id_after
    // 3. POST /api/compare { run_id_before, run_id_after } → compareResult
    // 4. navigate("/resultado/compare", { state: { compareResult } })
  }
  ```
- Adicionar helper `compareRuns` em `api.ts`:
  ```typescript
  export async function compareRuns(run_id_before: string, run_id_after: string): Promise<CompareResult> {
    const res = await fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id_before, run_id_after }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail ?? "Erro na comparação");
    }
    return res.json();
  }
  ```

#### 4.4 Nova `CompareResultPage.tsx`

Criar `frontend/src/pages/CompareResultPage.tsx`.

Tipo `CompareResult` em `types.ts`:
```typescript
export type CompareMetric = {
  key: string;
  label: string;
  before: number;
  after: number;
  delta: number;
  improved: boolean;
};

export type CompareResult = {
  score_before: number;
  score_after: number;
  score_delta: number;
  tier_before: string;
  tier_after: string;
  metrics: CompareMetric[];
  improved_count: number;
  worsened_count: number;
  top_improvements: CompareMetric[];
  top_regressions: CompareMetric[];
};
```

Estrutura da página:
```tsx
export function CompareResultPage() {
  // Seção 1: Hero com 2 ScoreArc lado a lado + seta delta
  // Seção 2: Cards resumo (improved_count verde vs worsened_count vermelho)
  // Seção 3: Top melhorias (3 cards verdes com delta positivo)
  // Seção 4: Top regressões (se houver, 3 cards vermelhos)
  // Seção 5: Tabela completa de todas as métricas
}
```

Reutilizar `ScoreArc` (copiar o componente de `PremiumResultPage.tsx` ou extrair para componente compartilhado).

Layout hero:
```tsx
<div style={{ display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>ANTES</div>
    <ScoreArc score={result.score_before} />
    <div className="tier-badge">{result.tier_before}</div>
  </div>
  <div style={{ fontSize: 32 }}>{result.score_delta >= 0 ? '→✨' : '→📉'}</div>
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>DEPOIS</div>
    <ScoreArc score={result.score_after} />
    <div className="tier-badge">{result.tier_after}</div>
  </div>
</div>
<div style={{ textAlign: 'center', marginTop: 12 }}>
  <span style={{ fontSize: 20, fontWeight: 800, color: result.score_delta >= 0 ? '#22d3ee' : '#f87171' }}>
    {result.score_delta >= 0 ? '+' : ''}{result.score_delta} pontos
  </span>
</div>
```

#### 4.5 Atualizar `App.tsx`

```tsx
import { CompareResultPage } from "./pages/CompareResultPage";

// Adicionar rota:
<Route path="/resultado/compare" element={<CompareResultPage />} />
```

---

## Ordem de Execução Recomendada

```
1. Ler todos os arquivos listados (verificar estado atual antes de editar)
2. Fase 1.1: types.ts → adicionar campos ausentes
3. Fase 1.2–1.4: PremiumResultPage.tsx → seções novas e dados ausentes
4. Fase 2.1: mvp_pipeline.py → adicionar rec_plan ao payload
5. Fase 2.2: api_server.py → endpoint /api/glossary
6. Fase 2.3–2.4: types.ts + api.ts + PremiumResultPage.tsx → tipos e fetch
7. Fase 3.1: PremiumResultPage.tsx → seção plano detalhado
8. Fase 3.2: PremiumResultPage.tsx → RadarChart SVG
9. Fase 3.3: PremiumResultPage.tsx → seção glossário
10. Rebuild Docker: docker compose up -d --build
11. Verificar Fase 1 + 2 + 3 manualmente
12. Fase 4.1: compare_report.py → compare_json()
13. Fase 4.2: api_server.py → /api/compare
14. Fase 4.3: types.ts + api.ts + CapturePage.tsx → modo compare
15. Fase 4.4: CompareResultPage.tsx → nova página
16. Fase 4.5: App.tsx → rota /resultado/compare
17. Rebuild Docker novamente
18. Verificar Fase 4 manualmente
```

## Verificação Final

```bash
# Fase 2
curl http://localhost:9015/api/glossary | python3 -m json.tool | head -30

# Fase 4
curl -X POST http://localhost:9015/api/compare \
  -H "Content-Type: application/json" \
  -d '{"run_id_before": "ABCDEF012345", "run_id_after": "FEDCBA098765"}' \
  | python3 -m json.tool
```

Inspecionar no DevTools: `result.capture_confidence`, `result.first_impression.tags`, `result.evolution_path.skin_alert`, `result.top3_actions_v2[0].tier`, `result.recommendations[0].what_is`.

## Guardrails

- Links `<a>` externos: SEMPRE `rel="noopener noreferrer"` + `target="_blank"`
- `run_id` no endpoint `/api/compare`: validar com regex `^[a-f0-9]{12}$` antes de construir path
- `compare_json()`: nunca lança exceção — retorna lista vazia se measurements ausentes
- RadarChart: `?? 0` em todos os scores para evitar `NaN` no SVG
- `fetchGlossary()` falha silenciosamente (`.catch(() => {})`) — glossário é enhancement, não crítico
