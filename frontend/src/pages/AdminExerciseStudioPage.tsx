/**
 * AdminExerciseStudioPage — unified studio that replaces the standalone
 * Animation/Biometric previews. Sidebar with exercise list, central preview
 * (anatomical face + heat + hands + recording), tabbed JSON editors, and
 * webcam-driven timeline capture.
 *
 * Routes: /admin/exercise-studio
 */

import { useEffect, useMemo, useState } from 'react';
import {
  fetchRecommendations,
  fetchRecommendation,
  updateRecommendation,
} from '../api';
import type { RecommendationCatalog } from '../types';
import type {
  AnimationConfig,
  ActionVector,
} from '../types/animationConfig';
import type { BiometricExerciseConfig } from '../biometric/types';
import { ExerciseStudioPreview } from '../components/ExerciseStudioPreview';
import { FaceCalibrationModal } from '../components/FaceCalibrationModal';
import { useFaceCalibration } from '../contexts/FaceCalibrationContext';
import { STUDIO_STYLES, type StudioStyle } from '../components/ExerciseStudioPreview/styles';

// ─────────────────────────────────────────────────────────────────────────
// Hands presets — common positions for the SVG face.
// ─────────────────────────────────────────────────────────────────────────
const HANDS_PRESETS: Array<{ id: string; label: string; vectors: ActionVector[] }> = [
  {
    id: 'masseter_bilateral',
    label: 'Mãos no masseter (bilateral)',
    vectors: [
      { type: 'hand', x: 14, y: 78, angle: 75, spread: 0.9, scale: 0.48, action: 'massage' },
      { type: 'hand', x: 86, y: 78, angle: -75, spread: 0.9, scale: 0.48, flip: true, action: 'massage' },
      { type: 'arrow', x1: 50, y1: 97, x2: 50, y2: 115 },
    ],
  },
  {
    id: 'frontal_isometria',
    label: 'Pressão na testa (isometria frontal)',
    vectors: [
      { type: 'hand', x: 26, y: 28, angle: 172, spread: 0.4, scale: 0.48, action: 'press' },
      { type: 'hand', x: 74, y: 28, angle: -172, spread: 0.4, scale: 0.48, flip: true, action: 'press' },
      { type: 'arrow_muscle', x1: 50, y1: 20, x2: 50, y2: 5 },
    ],
  },
  {
    id: 'lip_pull',
    label: 'Tração do lábio superior',
    vectors: [
      { type: 'hand', x: 37, y: 72, angle: 184, spread: 0.08, scale: 0.44, action: 'pull' },
      { type: 'hand', x: 63, y: 72, angle: -184, spread: 0.08, scale: 0.44, flip: true, action: 'pull' },
      { type: 'arrow', x1: 37, y1: 75, x2: 37, y2: 92 },
      { type: 'arrow', x1: 63, y1: 75, x2: 63, y2: 92 },
    ],
  },
];

const SECTION_TABS = ['animation', 'biometric', 'hands'] as const;
type SectionTab = (typeof SECTION_TABS)[number];

const TAB_LABELS: Record<SectionTab, string> = {
  animation: 'Animação',
  biometric: 'Biometric',
  hands: 'Mãos & Setas',
};

// ─────────────────────────────────────────────────────────────────────────
function safeJsonParse<T>(text: string): { value: T | null; error: string | null } {
  if (!text.trim()) return { value: null, error: null };
  try {
    return { value: JSON.parse(text) as T, error: null };
  } catch (err) {
    return { value: null, error: err instanceof Error ? err.message : 'JSON inválido' };
  }
}

// ─────────────────────────────────────────────────────────────────────────
export default function AdminExerciseStudioPage() {
  const [items, setItems] = useState<RecommendationCatalog[]>([]);
  const [selected, setSelected] = useState<RecommendationCatalog | null>(null);
  const [tab, setTab] = useState<SectionTab>('animation');
  const [styleId, setStyleId] = useState<StudioStyle['id']>('scifi');
  const [playing, setPlaying] = useState(true);
  const [showHands, setShowHands] = useState(true);
  const [calibrateOpen, setCalibrateOpen] = useState(false);
  const { hasBaseline } = useFaceCalibration();

  // Editor state — JSON text + parsed snapshots.
  const [animationJson, setAnimationJson] = useState('');
  const [biometricJson, setBiometricJson] = useState('');
  const [handsJson, setHandsJson] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // ── Load list ────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const recs = await fetchRecommendations({ category: 'exercise' });
        setItems(recs);
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  // ── Load full record on selection ─────────────────────────────────────
  const handleSelect = async (rec: RecommendationCatalog) => {
    try {
      const full = await fetchRecommendation(rec.id);
      setSelected(full);
      const anim = (full.animationConfig as AnimationConfig | null) ?? null;
      setAnimationJson(anim ? JSON.stringify(anim, null, 2) : '');
      setBiometricJson(
        full.biometricConfig ? JSON.stringify(full.biometricConfig, null, 2) : '',
      );
      setHandsJson(
        anim?.action_vectors ? JSON.stringify(anim.action_vectors, null, 2) : '',
      );
      setSaveMsg('');
    } catch (err) {
      console.error(err);
      setSaveMsg('Erro ao carregar exercício.');
    }
  };

  // ── Parsed snapshots (driven by editor text) ─────────────────────────
  const parsedAnimation = useMemo(
    () => safeJsonParse<AnimationConfig>(animationJson),
    [animationJson],
  );
  const parsedBiometric = useMemo(
    () => safeJsonParse<BiometricExerciseConfig>(biometricJson),
    [biometricJson],
  );
  const parsedHands = useMemo(
    () => safeJsonParse<ActionVector[]>(handsJson),
    [handsJson],
  );

  // Merge action_vectors (from hands tab) into animation config for preview.
  const previewAnimation: AnimationConfig | null = useMemo(() => {
    if (!parsedAnimation.value) return null;
    if (!parsedHands.value || parsedHands.value.length === 0)
      return parsedAnimation.value;
    return { ...parsedAnimation.value, action_vectors: parsedHands.value };
  }, [parsedAnimation.value, parsedHands.value]);

  // ── Save ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selected) return;
    if (parsedAnimation.error) {
      setSaveMsg(`Animation JSON inválido: ${parsedAnimation.error}`);
      return;
    }
    if (parsedBiometric.error) {
      setSaveMsg(`Biometric JSON inválido: ${parsedBiometric.error}`);
      return;
    }
    if (parsedHands.error) {
      setSaveMsg(`Hands JSON inválido: ${parsedHands.error}`);
      return;
    }
    setIsSaving(true);
    setSaveMsg('');
    try {
      // Compose final animationConfig with action_vectors merged in.
      let finalAnimation: AnimationConfig | null = parsedAnimation.value;
      if (finalAnimation && parsedHands.value && parsedHands.value.length > 0) {
        finalAnimation = { ...finalAnimation, action_vectors: parsedHands.value };
      } else if (finalAnimation && (!parsedHands.value || parsedHands.value.length === 0)) {
        // Drop empty action_vectors.
        const { action_vectors: _av, ...rest } = finalAnimation;
        void _av;
        finalAnimation = rest as AnimationConfig;
      }
      const updated = await updateRecommendation(selected.id, {
        animationConfig: finalAnimation,
        biometricConfig: parsedBiometric.value,
      });
      setSelected(updated);
      setSaveMsg('✓ Salvo com sucesso.');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg(`✗ ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const applyHandsPreset = (presetId: string) => {
    const preset = HANDS_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setHandsJson(JSON.stringify(preset.vectors, null, 2));
  };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 420px',
        gap: 16,
        padding: 16,
        height: '100vh',
        boxSizing: 'border-box',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* ── Left: exercise list ─────────────────────────────────────── */}
      <aside
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 12,
          overflow: 'auto',
        }}
      >
        <h2 style={{ fontSize: 14, margin: '4px 8px 12px', color: 'var(--muted)' }}>
          Exercícios ({items.length})
        </h2>
        {items.map((rec) => (
          <button
            key={rec.id}
            onClick={() => handleSelect(rec)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              marginBottom: 6,
              background:
                selected?.id === rec.id ? 'rgba(99,102,241,0.18)' : 'var(--surface2)',
              border:
                selected?.id === rec.id
                  ? '1px solid #6366f1'
                  : '1px solid var(--border)',
              borderRadius: 10,
              color: 'var(--text)',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>{rec.id}</div>
            <div style={{ color: 'var(--muted)', fontSize: 11 }}>
              {rec.displayTextShortPt?.substring(0, 60)}
              {rec.displayTextShortPt && rec.displayTextShortPt.length > 60 ? '…' : ''}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div style={{ color: 'var(--muted)', fontSize: 12, padding: 12 }}>
            Nenhum exercício carregado.
          </div>
        )}
      </aside>

      {/* ── Center: preview + controls ──────────────────────────────── */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          minWidth: 0,
        }}
      >
        {!selected && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--border)',
              borderRadius: 16,
              color: 'var(--muted)',
            }}
          >
            Selecione um exercício à esquerda para começar.
          </div>
        )}
        {selected && (
          <>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <button onClick={() => setPlaying((p) => !p)} style={ctrlBtn}>
                {playing ? '⏸ Pausar' : '▶ Tocar'}
              </button>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={showHands}
                  onChange={(e) => setShowHands(e.target.checked)}
                />
                Mostrar mãos
              </label>
              <div style={{ flex: 1 }} />
              <select
                value={styleId}
                onChange={(e) => setStyleId(e.target.value as StudioStyle['id'])}
                style={ctrlSelect}
              >
                {Object.values(STUDIO_STYLES).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button onClick={() => setCalibrateOpen(true)} style={calibrateBtn}>
                {hasBaseline ? '✓ Rosto Calibrado' : '⊕ Calibrar Rosto'}
              </button>
              <button onClick={handleSave} disabled={isSaving} style={saveBtn}>
                {isSaving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>

            {saveMsg && (
              <div
                style={{
                  fontSize: 12,
                  color: saveMsg.startsWith('✓') ? '#22d3ee' : '#ef4444',
                }}
              >
                {saveMsg}
              </div>
            )}

            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: STUDIO_STYLES[styleId].bg,
                borderRadius: 16,
                padding: 24,
                minHeight: 0,
              }}
            >
              <div style={{ width: 'min(520px, 100%)' }}>
                <ExerciseStudioPreview
                  animationConfig={previewAnimation}
                  biometricConfig={parsedBiometric.value}
                  styleId={styleId}
                  playing={playing}
                  hideHands={!showHands}
                  showCaption
                />
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Right: tabbed JSON editors ──────────────────────────────── */}
      <aside
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {SECTION_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: tab === t ? 'rgba(99,102,241,0.18)' : 'transparent',
                border:
                  tab === t ? '1px solid #6366f1' : '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--text)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {tab === 'animation' && (
          <EditorPanel
            value={animationJson}
            onChange={setAnimationJson}
            error={parsedAnimation.error}
            placeholder='{ "schema_version": 1, "primitives": [{"id":"brow_lift_both"}], "duration_ms": 2000, "repeat": "infinite" }'
            hint="Primitives + duração + heat regions. action_vectors fica na aba Mãos."
          />
        )}
        {tab === 'biometric' && (
          <EditorPanel
            value={biometricJson}
            onChange={setBiometricJson}
            error={parsedBiometric.error}
            placeholder='{ "schema_version": 1, "steps": [{"zone":"masseter_l","verb":"stretch","duration_ms":1500}], "cycle_ms": 5000, "repeat": "infinite" }'
            hint="Zonas anatômicas + verbos biomecânicos. Heat blob aparece automaticamente."
          />
        )}
        {tab === 'hands' && (
          <>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) applyHandsPreset(e.target.value);
              }}
              style={{
                ...ctrlSelect,
                width: '100%',
                marginBottom: 8,
              }}
            >
              <option value="">Carregar preset…</option>
              {HANDS_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <EditorPanel
              value={handsJson}
              onChange={setHandsJson}
              error={parsedHands.error}
              placeholder='[{ "type":"hand", "x":50, "y":78, "angle":0, "spread":0.5, "action":"press" }]'
              hint="Array de mãos (type:hand) e setas (type:arrow|arrow_muscle). Sobrepõe ao SVG."
            />
          </>
        )}
      </aside>

      <FaceCalibrationModal
        open={calibrateOpen}
        onClose={() => setCalibrateOpen(false)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function EditorPanel({
  value,
  onChange,
  error,
  placeholder,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  error: string | null;
  placeholder: string;
  hint: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder={placeholder}
        style={{
          flex: 1,
          minHeight: 280,
          fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
          fontSize: 12,
          lineHeight: 1.5,
          background: 'var(--bg)',
          color: 'var(--text)',
          border: error ? '1px solid #ef4444' : '1px solid var(--border)',
          borderRadius: 8,
          padding: 10,
          resize: 'none',
        }}
      />
      <div style={{ marginTop: 6, fontSize: 11, color: error ? '#ef4444' : 'var(--muted)' }}>
        {error ?? hint}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
const ctrlBtn: React.CSSProperties = {
  padding: '8px 14px',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
};

const ctrlSelect: React.CSSProperties = {
  padding: '8px 12px',
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 12,
};

const calibrateBtn: React.CSSProperties = {
  ...ctrlBtn,
  background: 'transparent',
  border: '1px solid #6366f1',
  color: '#a5b4fc',
};

const saveBtn: React.CSSProperties = {
  ...ctrlBtn,
  background: '#6366f1',
  color: '#fff',
  border: '1px solid #6366f1',
  fontWeight: 600,
};
