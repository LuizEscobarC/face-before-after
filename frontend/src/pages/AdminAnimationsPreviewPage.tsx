import { Link } from 'react-router-dom';
import { SvgFaceInstructor } from '../components/SvgFaceInstructor';
import {
  ALL_FACIAL_PRIMITIVE_IDS,
  ALL_HEAT_REGION_IDS,
  type AnimationConfig,
  type FacialPrimitiveId,
  type HeatRegionId,
} from '../types/animationConfig';

/**
 * PR-B — QA gallery: every primitive in isolation + every heat region in
 * isolation. Used by humans to confirm each primitive renders something
 * recognisable and pulses at the expected anatomical location.
 *
 * Route: /admin/animations/preview (registered in App.tsx).
 *
 * Auto-categorises primitives by their id prefix for easier scanning.
 */
const CATEGORY_ORDER: Array<{ key: string; label: string }> = [
  { key: 'brow', label: 'Sobrancelha' },
  { key: 'eye', label: 'Olho' },
  { key: 'lip', label: 'Lábio / Boca' },
  { key: 'tongue', label: 'Língua' },
  { key: 'jaw', label: 'Mandíbula' },
  { key: 'cheek', label: 'Bochecha' },
  { key: 'neck', label: 'Pescoço / Cervical' },
  { key: 'static', label: 'Estático / Informativo' },
];

function configForPrimitive(id: FacialPrimitiveId): AnimationConfig {
  // Tongue primitives need x-ray to be visible through the skin.
  const isTongue = id.startsWith('tongue_');
  return {
    schema_version: 1,
    primitives: [{ id, intensity: 1 }],
    duration_ms: 1500,
    hold_ms: 400,
    repeat: 'infinite',
    show_xray: isTongue,
    caption_pt: id,
  };
}

function configForHeatRegion(region: HeatRegionId): AnimationConfig {
  return {
    schema_version: 1,
    // Heat-only previews still need a primitive (DB CHECK requires ≥1).
    // Use the gentlest possible — brow_relax — so the face barely moves.
    primitives: [{ id: 'brow_relax', intensity: 0.1 }],
    duration_ms: 1500,
    repeat: 'infinite',
    heat_regions: [{ region, pulse: true }],
    caption_pt: `heat: ${region}`,
  };
}

export default function AdminAnimationsPreviewPage() {
  const grouped = CATEGORY_ORDER.map((cat) => ({
    ...cat,
    items: ALL_FACIAL_PRIMITIVE_IDS.filter((id) => id.startsWith(`${cat.key}_`)),
  }));

  return (
    <div style={pageStyle}>
      <header style={headerStyle}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'clamp(20px, 2.5vw, 28px)' }}>
            Animações Faciais — Preview QA
          </h1>
          <p style={subtitleStyle}>
            Galeria de todos os {ALL_FACIAL_PRIMITIVE_IDS.length} movimentos primitivos +{' '}
            {ALL_HEAT_REGION_IDS.length} regiões de calor anatômicas. Cada card roda em loop
            infinito com intensidade máxima para validação visual.
          </p>
        </div>
        <nav>
          <Link to="/admin/recommendations" style={linkStyle}>
            ← Voltar para Recomendações
          </Link>
        </nav>
      </header>

      {grouped.map((cat) => (
        <section key={cat.key} style={sectionStyle}>
          <h2 style={sectionTitleStyle}>
            {cat.label}{' '}
            <span style={countStyle}>({cat.items.length})</span>
          </h2>
          <div style={gridStyle}>
            {cat.items.map((id) => (
              <PreviewCard key={id} title={id}>
                <SvgFaceInstructor config={configForPrimitive(id)} showCaption={false} />
              </PreviewCard>
            ))}
          </div>
        </section>
      ))}

      <section style={sectionStyle}>
        <h2 style={sectionTitleStyle}>
          Regiões de Calor{' '}
          <span style={countStyle}>({ALL_HEAT_REGION_IDS.length})</span>
        </h2>
        <div style={gridStyle}>
          {ALL_HEAT_REGION_IDS.map((region) => (
            <PreviewCard key={region} title={region}>
              <SvgFaceInstructor config={configForHeatRegion(region)} showCaption={false} />
            </PreviewCard>
          ))}
        </div>
      </section>
    </div>
  );
}

function PreviewCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article style={cardStyle}>
      <div style={{ width: '100%' }}>{children}</div>
      <code style={cardLabelStyle}>{title}</code>
    </article>
  );
}

// =====================================================================
// Inline styles — keep this page self-contained (no CSS conflict with
// the .admin-page grid layout used by the CRUD pages).
// =====================================================================
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg, #0a0a12)',
  color: 'var(--text, #e2e8f0)',
  padding: '24px clamp(16px, 4vw, 48px) 80px',
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  flexWrap: 'wrap',
  gap: '16px',
  marginBottom: '32px',
  paddingBottom: '20px',
  borderBottom: '1px solid var(--border, rgba(255,255,255,0.07))',
};

const subtitleStyle: React.CSSProperties = {
  marginTop: '8px',
  marginBottom: 0,
  color: 'var(--muted, #94a3b8)',
  fontSize: '14px',
  maxWidth: '60ch',
  lineHeight: 1.5,
};

const linkStyle: React.CSSProperties = {
  color: 'var(--accent2, #22d3ee)',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '40px',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 600,
  marginBottom: '16px',
  color: 'var(--text, #e2e8f0)',
};

const countStyle: React.CSSProperties = {
  color: 'var(--muted, #94a3b8)',
  fontSize: '14px',
  fontWeight: 400,
  marginLeft: '6px',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: '16px',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--surface, #13131f)',
  border: '1px solid var(--border, rgba(255,255,255,0.07))',
  borderRadius: '12px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  alignItems: 'center',
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--muted, #94a3b8)',
  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  textAlign: 'center',
  wordBreak: 'break-all',
  lineHeight: 1.3,
};
