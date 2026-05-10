import { useMemo } from 'react';
import { BiometricFaceSimulator } from '../components/BiometricFaceSimulator';
import type {
  AnatomicalZoneId,
  BiometricExerciseConfig,
  MovementVerb,
} from '../biometric/types';
import './admin-shared.css';

const VERBS: MovementVerb[] = [
  'stretch',
  'compress',
  'massage_circular',
  'isometric_hold',
  'rotate_around_pivot',
];

// 4 representative zones per verb to keep preview manageable.
const ZONES_PER_VERB: Record<MovementVerb, AnatomicalZoneId[]> = {
  stretch: ['masseter_l', 'masseter_r', 'platysma', 'temporalis_l'],
  compress: ['orbicularis_oris', 'corrugator', 'mentalis', 'frontalis'],
  massage_circular: [
    'temporalis_l',
    'temporalis_r',
    'zygomaticus_l',
    'masseter_r',
  ],
  isometric_hold: [
    'orbicularis_oris',
    'orbicularis_oculi_l',
    'mentalis',
    'buccinator_r',
  ],
  rotate_around_pivot: ['masseter_l', 'masseter_r', 'tmj_joint_l', 'tmj_joint_r'],
};

const VERB_LABELS: Record<MovementVerb, string> = {
  stretch: 'Stretch (alongamento)',
  compress: 'Compress (compressão)',
  massage_circular: 'Massage circular',
  isometric_hold: 'Isometric hold',
  rotate_around_pivot: 'Rotate around pivot',
};

const ZONE_LABELS: Partial<Record<AnatomicalZoneId, string>> = {
  masseter_l: 'Masseter L',
  masseter_r: 'Masseter R',
  platysma: 'Platysma',
  temporalis_l: 'Temporalis L',
  temporalis_r: 'Temporalis R',
  orbicularis_oris: 'Orbicularis oris',
  corrugator: 'Corrugator',
  mentalis: 'Mentalis',
  frontalis: 'Frontalis',
  zygomaticus_l: 'Zygomaticus L',
  zygomaticus_r: 'Zygomaticus R',
  orbicularis_oculi_l: 'Orbicularis oculi L',
  orbicularis_oculi_r: 'Orbicularis oculi R',
  buccinator_l: 'Buccinator L',
  buccinator_r: 'Buccinator R',
  tmj_joint_l: 'TMJ joint L',
  tmj_joint_r: 'TMJ joint R',
  scm_l: 'SCM L',
  scm_r: 'SCM R',
  suboccipital: 'Suboccipital',
};

function buildSyntheticConfig(
  zone: AnatomicalZoneId,
  verb: MovementVerb,
): BiometricExerciseConfig {
  const base = {
    zone,
    verb,
    duration_ms: 1500,
    hold_ms: 1000,
    heat_intensity: 0.9,
  };
  let extra: Partial<{
    amplitude: number;
    angle_deg: number;
    pivot: 'tmj_l' | 'tmj_r' | 'tmj_center' | 'atlas_c1' | 'occipital_c0';
    vector: { x: number; y: number };
  }> = {};
  if (verb === 'stretch') extra = { amplitude: 0.18, vector: { x: 0, y: -1 } };
  else if (verb === 'compress') extra = { amplitude: 0.12 };
  else if (verb === 'massage_circular') extra = { amplitude: 0.06 };
  else if (verb === 'isometric_hold') extra = { amplitude: 0.04 };
  else if (verb === 'rotate_around_pivot')
    extra = {
      angle_deg: 12,
      pivot: zone.endsWith('_r') ? 'tmj_r' : 'tmj_l',
    };

  return {
    schema_version: 1,
    steps: [{ ...base, ...extra }],
    cycle_ms: 4000,
    repeat: 'infinite',
    caption_pt: `${VERB_LABELS[verb]} — ${ZONE_LABELS[zone] ?? zone}`,
  };
}

const MOCK_CONFIGS: BiometricExerciseConfig[] = [
  {
    schema_version: 1,
    cycle_ms: 5000,
    repeat: 'infinite',
    caption_pt: 'Masseter stretch L+R (alongamento bilateral)',
    steps: [
      {
        zone: 'masseter_l',
        verb: 'stretch',
        amplitude: 0.18,
        vector: { x: -0.3, y: -1 },
        duration_ms: 1500,
        hold_ms: 1500,
        delay_ms: 0,
        heat_intensity: 0.9,
      },
      {
        zone: 'masseter_r',
        verb: 'stretch',
        amplitude: 0.18,
        vector: { x: 0.3, y: -1 },
        duration_ms: 1500,
        hold_ms: 1500,
        delay_ms: 0,
        heat_intensity: 0.9,
      },
    ],
  },
  {
    schema_version: 1,
    cycle_ms: 5000,
    repeat: 'infinite',
    caption_pt: 'Orbicularis oris — compress + isometric hold',
    steps: [
      {
        zone: 'orbicularis_oris',
        verb: 'compress',
        amplitude: 0.14,
        duration_ms: 1200,
        hold_ms: 0,
        delay_ms: 0,
        heat_intensity: 0.85,
      },
      {
        zone: 'orbicularis_oris',
        verb: 'isometric_hold',
        amplitude: 0.05,
        duration_ms: 800,
        hold_ms: 1500,
        delay_ms: 1300,
        heat_intensity: 1,
      },
    ],
  },
  {
    schema_version: 1,
    cycle_ms: 5000,
    repeat: 'infinite',
    caption_pt: 'Mandibular rotation (rotate around TMJ)',
    steps: [
      {
        zone: 'masseter_l',
        verb: 'rotate_around_pivot',
        angle_deg: 14,
        pivot: 'tmj_l',
        duration_ms: 1600,
        hold_ms: 800,
        delay_ms: 0,
        heat_intensity: 0.8,
      },
      {
        zone: 'masseter_r',
        verb: 'rotate_around_pivot',
        angle_deg: -14,
        pivot: 'tmj_r',
        duration_ms: 1600,
        hold_ms: 800,
        delay_ms: 0,
        heat_intensity: 0.8,
      },
    ],
  },
];

export default function AdminBiometricPreviewPage() {
  const verbCells = useMemo(
    () =>
      VERBS.map((verb) => ({
        verb,
        cells: ZONES_PER_VERB[verb].map((zone) => ({
          zone,
          config: buildSyntheticConfig(zone, verb),
        })),
      })),
    [],
  );

  return (
    <div className="biometric-preview-page">
      <header className="bpp-header">
        <h1>Biometric — Preview de verbos × zonas</h1>
        <p className="bpp-sub">
          Pré-visualização dos 5 verbos de movimento aplicados a zonas
          anatômicas representativas, sobre o avatar de fallback (478
          landmarks).
        </p>
      </header>

      {verbCells.map(({ verb, cells }) => (
        <section key={verb} className="bpp-section">
          <h2 className="bpp-section-title">{VERB_LABELS[verb]}</h2>
          <div className="bpp-grid">
            {cells.map(({ zone, config }) => (
              <div key={`${verb}-${zone}`} className="bpp-cell">
                <BiometricFaceSimulator config={config} size={200} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section className="bpp-section">
        <h2 className="bpp-section-title">PoC: Exercícios reais</h2>
        <div className="bpp-grid">
          {MOCK_CONFIGS.map((config, i) => (
            <div key={`mock-${i}`} className="bpp-cell">
              <BiometricFaceSimulator config={config} size={220} />
            </div>
          ))}
        </div>
      </section>

      <style>{`
        .biometric-preview-page {
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          padding: 24px clamp(16px, 4vw, 40px);
          box-sizing: border-box;
        }
        .bpp-header {
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .bpp-header h1 {
          margin: 0 0 8px;
          font-size: clamp(22px, 3vw, 28px);
          color: var(--text);
        }
        .bpp-sub {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          max-width: 720px;
        }
        .bpp-section {
          margin-top: 28px;
          padding: 20px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: var(--shadow);
        }
        .bpp-section-title {
          margin: 0 0 16px;
          font-size: 16px;
          color: var(--accent);
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .bpp-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: start;
        }
        .bpp-cell {
          display: flex;
          justify-content: center;
        }
        @media (max-width: 1024px) {
          .bpp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .bpp-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
