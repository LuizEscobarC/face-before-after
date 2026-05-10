/**
 * AdminRecommendationsPage
 *
 * Admin panel for managing diagnostic recommendations.
 * Two-panel layout: filter + list (left), editor + preview (right).
 * Users can browse recommendations by category, edit text and metadata,
 * and save changes back to the database.
 */

import { useState, useEffect } from 'react';
import {
  fetchRecommendationCategories,
  fetchRecommendations,
  fetchRecommendation,
  updateRecommendation,
} from '../api';
import type { RecommendationCatalog, RecommendationCategory_Option } from '../types';
import { SvgFaceInstructor } from '../components/SvgFaceInstructor';
import { BiometricFaceSimulator } from '../components/BiometricFaceSimulator';
import type { AnimationConfig } from '../types/animationConfig';
import type { BiometricExerciseConfig } from '../biometric/types';
import './AdminRecommendationsPage.css';

const BIOMETRIC_PRESETS: Array<{ id: string; label: string; config: BiometricExerciseConfig }> = [
  {
    id: 'masseter_stretch',
    label: 'Masseter — alongamento bilateral',
    config: {
      schema_version: 1,
      steps: [
        { zone: 'masseter_l', verb: 'stretch', vector: { x: -0.7, y: 0.3 }, amplitude: 0.18, duration_ms: 1500, hold_ms: 4000, heat_intensity: 1 },
        { zone: 'masseter_r', verb: 'stretch', vector: { x: 0.7, y: 0.3 }, amplitude: 0.18, duration_ms: 1500, hold_ms: 4000, heat_intensity: 1 },
      ],
      cycle_ms: 5500,
      repeat: 'infinite',
      caption_pt: 'Empurre a mandíbula para fora — sinta o masseter alongar bilateralmente.',
    },
  },
  {
    id: 'orbicularis_oris_pucker',
    label: 'Orbicularis oris — beicinho',
    config: {
      schema_version: 1,
      steps: [
        { zone: 'orbicularis_oris', verb: 'compress', vector: { x: 0, y: 0 }, amplitude: 0.25, duration_ms: 1200, hold_ms: 3000, heat_intensity: 1 },
        { zone: 'orbicularis_oris', verb: 'isometric_hold', amplitude: 0.05, duration_ms: 3000, delay_ms: 1200, heat_intensity: 0.6 },
      ],
      cycle_ms: 4200,
      repeat: 'infinite',
      caption_pt: 'Beicinho sustentado — comprima e segure a tensão nos lábios.',
    },
  },
  {
    id: 'mandibular_rotation',
    label: 'Mandíbula — rotação na ATM',
    config: {
      schema_version: 1,
      steps: [
        { zone: 'mentalis', verb: 'rotate_around_pivot', pivot: 'tmj_center', angle_deg: 25, duration_ms: 1500, hold_ms: 3000, heat_intensity: 0.8 },
        { zone: 'masseter_l', verb: 'rotate_around_pivot', pivot: 'tmj_l', angle_deg: 25, duration_ms: 1500, hold_ms: 3000, heat_intensity: 1 },
        { zone: 'masseter_r', verb: 'rotate_around_pivot', pivot: 'tmj_r', angle_deg: 25, duration_ms: 1500, hold_ms: 3000, heat_intensity: 1 },
      ],
      cycle_ms: 4500,
      repeat: 'infinite',
      caption_pt: 'Abra a mandíbula até 2 dedos — rotação articular controlada na ATM.',
    },
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  photo: 'Foto / Captura',
  presentation_only: 'Apenas Informativo',
  posture: 'Postura',
  lifestyle: 'Estilo de Vida',
  exercise: 'Exercício / Mioterapia',
  styling: 'Styling / Visagismo',
  aesthetic_procedure: 'Procedimento Estético (não-invasivo)',
  professional_referral: 'Encaminhamento Profissional',
};

const EVIDENCE_LABELS: Record<string, string> = {
  strong: 'Forte (RCT / consenso)',
  moderate: 'Moderada (prática clínica)',
  anecdotal: 'Popular (sem RCT)',
};

const INVASIVENESS_LABELS: Record<number, string> = {
  0: '0 — Foto / Info',
  1: '1 — Postura / Lifestyle',
  2: '2 — Exercício',
  3: '3 — Styling',
  4: '4 — Procedimento / Profissional',
};

const ANIMATION_PRESETS: Array<{ id: string; label: string; config: AnimationConfig }> = [
  { id: 'brow_lift', label: 'Levantamento de sobrancelha', config: { schema_version: 1, primitives: [{ id: 'brow_lift_both', intensity: 0.8 }], duration_ms: 2000, hold_ms: 500, repeat: 'infinite', heat_regions: [{ region: 'frontalis', pulse: true }], caption_pt: 'Levante as sobrancelhas com firmeza moderada.' } },
  { id: 'jaw_clench', label: 'Masseter isométrico (morder)', config: { schema_version: 1, primitives: [{ id: 'jaw_clench', intensity: 0.7 }], duration_ms: 1500, hold_ms: 5000, repeat: 'infinite', heat_regions: [{ region: 'masseter_l', pulse: true }, { region: 'masseter_r', pulse: true }], caption_pt: 'Cerre os dentes com firmeza moderada — sinta a lateral da mandíbula.' } },
  { id: 'lip_pucker', label: 'Bico / Beijo', config: { schema_version: 1, primitives: [{ id: 'lip_pucker', intensity: 1 }], duration_ms: 2000, repeat: 'infinite', heat_regions: [{ region: 'orbicularis_oris', pulse: true }], caption_pt: 'Faça bico com os lábios como se fosse assobiar.' } },
  { id: 'tongue_mewing', label: 'Mewing (pressão palatal)', config: { schema_version: 1, primitives: [{ id: 'tongue_palate_press', intensity: 0.9 }], duration_ms: 3000, hold_ms: 3000, repeat: 'infinite', show_xray: true, caption_pt: 'Pressione toda a língua no palato com força moderada.' } },
  { id: 'neck_chin_tuck', label: 'Chin tuck (retração cervical)', config: { schema_version: 1, primitives: [{ id: 'neck_chin_tuck', intensity: 1 }], duration_ms: 2000, hold_ms: 2000, repeat: 'infinite', heat_regions: [{ region: 'suboccipital', pulse: true }, { region: 'scm_l', pulse: false }, { region: 'scm_r', pulse: false }], caption_pt: 'Recue o queixo como se fosse criar uma papada — alongue a nuca.' } },
];

export default function AdminRecommendationsPage() {
  // Category filter options
  const [categoryOptions, setCategoryOptions] = useState<RecommendationCategory_Option[]>([]);

  // List state
  const [recommendations, setRecommendations] = useState<RecommendationCatalog[]>([]);
  const [filteredRecommendations, setFilteredRecommendations] = useState<RecommendationCatalog[]>([]);

  // Selected item
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendationCatalog | null>(null);

  // Editor state
  const [editedShortText, setEditedShortText] = useState('');
  const [editedLongText, setEditedLongText] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [editedPriority, setEditedPriority] = useState(1);
  const [editedEffort, setEditedEffort] = useState('low');
  const [editedRiskLevel, setEditedRiskLevel] = useState(0);
  const [editedRequiresProfessional, setEditedRequiresProfessional] = useState(false);
  const [editedProfessionalType, setEditedProfessionalType] = useState('');
  const [editedInvasivenessLevel, setEditedInvasivenessLevel] = useState(0);
  const [editedEvidenceLevel, setEditedEvidenceLevel] = useState<'strong' | 'moderate' | 'anecdotal'>('moderate');
  const [editedClinicalPathway, setEditedClinicalPathway] = useState(false);
  const [editedDisclaimer, setEditedDisclaimer] = useState('');
  const [editedAnimationJson, setEditedAnimationJson] = useState('');
  const [animationParseError, setAnimationParseError] = useState<string | null>(null);
  const [parsedAnimationConfig, setParsedAnimationConfig] = useState<AnimationConfig | null>(null);
  const [editedBiometricConfig, setEditedBiometricConfig] = useState('');
  const [biometricParseError, setBiometricParseError] = useState<string | null>(null);
  const [parsedBiometricConfig, setParsedBiometricConfig] = useState<BiometricExerciseConfig | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState('');

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Load categories on mount
  useEffect(() => {
    (async () => {
      try {
        const categories = await fetchRecommendationCategories();
        setCategoryOptions(categories);
      } catch (err) {
        console.error('Erro ao carregar categorias:', err);
      }
    })();
  }, []);

  // Load recommendations
  useEffect(() => {
    (async () => {
      try {
        const recs = await fetchRecommendations({ category: filterCategory || undefined });
        setRecommendations(recs);
        setFilteredRecommendations(recs);
      } catch (err) {
        console.error('Erro ao carregar recomendações:', err);
        setSaveMessage('Erro ao carregar recomendações.');
      }
    })();
  }, [filterCategory]);

  // When a recommendation is selected, load full details
  const handleSelectRecommendation = async (rec: RecommendationCatalog) => {
    try {
      const full = await fetchRecommendation(rec.id);
      setSelectedRecommendation(full);
      setEditedShortText(full.displayTextShortPt);
      setEditedLongText(full.displayTextLongPt);
      setEditedCategory(full.category);
      setEditedPriority(full.priorityDefault);
      setEditedEffort(full.effortEstimate);
      setEditedRiskLevel(full.riskLevel);
      setEditedRequiresProfessional(full.requiresProfessional);
      setEditedProfessionalType(full.professionalType || '');
      setEditedInvasivenessLevel(full.invasivenessLevel ?? 0);
      setEditedEvidenceLevel(full.evidenceLevel ?? 'moderate');
      setEditedClinicalPathway(full.clinicalPathwayRequired ?? false);
      setEditedDisclaimer(full.disclaimerTemplate ?? '');
      const animJson = full.animationConfig ? JSON.stringify(full.animationConfig, null, 2) : '';
      setEditedAnimationJson(animJson);
      setAnimationParseError(null);
      setParsedAnimationConfig(full.animationConfig ?? null);
      const bioJson = full.biometricConfig ? JSON.stringify(full.biometricConfig, null, 2) : '';
      setEditedBiometricConfig(bioJson);
      setBiometricParseError(null);
      setParsedBiometricConfig((full.biometricConfig as BiometricExerciseConfig | null | undefined) ?? null);
      setSaveMessage('');
    } catch (err) {
      console.error('Erro ao carregar recomendação completa:', err);
      setSaveMessage('Erro ao carregar recomendação.');
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedRecommendation) return;

    if (!editedShortText.trim()) {
      setSaveMessage('Texto curto não pode estar vazio.');
      return;
    }
    if (!editedLongText.trim()) {
      setSaveMessage('Texto longo não pode estar vazio.');
      return;
    }

    setIsSaving(true);
    try {
      if (editedEvidenceLevel === 'anecdotal' && !editedDisclaimer.trim()) {
        setSaveMessage('evidenceLevel=anecdotal exige disclaimer não-vazio.');
        setIsSaving(false);
        return;
      }

      const updated = await updateRecommendation(selectedRecommendation.id, {
        displayTextShortPt: editedShortText,
        displayTextLongPt: editedLongText,
        category: editedCategory,
        priorityDefault: editedPriority,
        effortEstimate: editedEffort,
        riskLevel: editedRiskLevel,
        requiresProfessional: editedRequiresProfessional,
        professionalType: editedProfessionalType || null,
        invasivenessLevel: editedInvasivenessLevel,
        evidenceLevel: editedEvidenceLevel,
        clinicalPathwayRequired: editedClinicalPathway,
        disclaimerTemplate: editedDisclaimer.trim() ? editedDisclaimer : null,
        animationConfig: parsedAnimationConfig,
        biometricConfig: parsedBiometricConfig,
      });

      setSelectedRecommendation(updated);
      setSaveMessage('✓ Recomendação salva com sucesso!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido.';
      setSaveMessage(`✗ ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnimationJsonChange = (value: string) => {
    setEditedAnimationJson(value);
    if (!value.trim()) { setAnimationParseError(null); setParsedAnimationConfig(null); return; }
    try {
      const parsed = JSON.parse(value) as AnimationConfig;
      setParsedAnimationConfig(parsed);
      setAnimationParseError(null);
    } catch {
      setAnimationParseError('JSON inválido — SVG mostrando último estado válido.');
    }
  };

  const handleClearAnimation = () => { setEditedAnimationJson(''); setAnimationParseError(null); setParsedAnimationConfig(null); };

  const handleBiometricJsonChange = (value: string) => {
    setEditedBiometricConfig(value);
    if (!value.trim()) { setBiometricParseError(null); setParsedBiometricConfig(null); return; }
    try {
      const parsed = JSON.parse(value) as BiometricExerciseConfig;
      setParsedBiometricConfig(parsed);
      setBiometricParseError(null);
    } catch {
      setBiometricParseError('JSON inválido — preview mostrando último estado válido.');
    }
  };

  const handleClearBiometric = () => { setEditedBiometricConfig(''); setBiometricParseError(null); setParsedBiometricConfig(null); };

  const handleLoadBiometricPreset = (presetId: string) => {
    const preset = BIOMETRIC_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setEditedBiometricConfig(JSON.stringify(preset.config, null, 2));
    setParsedBiometricConfig(preset.config);
    setBiometricParseError(null);
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = ANIMATION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setEditedAnimationJson(JSON.stringify(preset.config, null, 2));
    setParsedAnimationConfig(preset.config);
    setAnimationParseError(null);
  };

  return (
    <div className="admin-recommendations-page">
      {/* Left panel: filters + list */}
      <div className="recommendations-left-panel">
        <div className="recommendations-filters">
          <label>
            <span>Categoria</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="">Todas</option>
              {categoryOptions.map((opt) => (
                <option key={opt.category} value={opt.category}>
                  {CATEGORY_LABELS[opt.category] || opt.category}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="recommendations-list">
          {filteredRecommendations.map((rec) => (
            <div
              key={rec.id}
              className={`recommendation-item ${selectedRecommendation?.id === rec.id ? 'active' : ''}`}
              onClick={() => handleSelectRecommendation(rec)}
            >
              <div className="rec-id">{rec.id}</div>
              <div className="rec-category">{CATEGORY_LABELS[rec.category] || rec.category}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{rec.category}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                {INVASIVENESS_LABELS[rec.invasivenessLevel] ?? `nível ${rec.invasivenessLevel}`}
                {' · '}
                {EVIDENCE_LABELS[rec.evidenceLevel] ?? rec.evidenceLevel}
                {rec.requiresAnecdotalDisclaimer ? ' ⚠' : ''}
              </div>
              <div className="rec-preview">{rec.displayTextShortPt.substring(0, 60)}...</div>
            </div>
          ))}
          {filteredRecommendations.length === 0 && (
            <div className="no-recommendations">Nenhuma recomendação encontrada.</div>
          )}
        </div>
      </div>

      {/* Right panel: editor + preview */}
      <div className="recommendations-right-panel">
        {selectedRecommendation ? (
          <div className="recommendation-editor">
            <h2>{selectedRecommendation.id}</h2>

            <div className="editor-section">
              <label>
                <span>Texto Curto (≤120 chars)</span>
                <textarea
                  value={editedShortText}
                  onChange={(e) => setEditedShortText(e.target.value)}
                  rows={3}
                />
              </label>
            </div>

            <div className="editor-section">
              <label>
                <span>Texto Longo (parágrafo)</span>
                <textarea
                  value={editedLongText}
                  onChange={(e) => setEditedLongText(e.target.value)}
                  rows={5}
                />
              </label>
            </div>

            <div className="editor-row">
              <label>
                <span>Categoria</span>
                <select
                  value={editedCategory}
                  onChange={(e) => setEditedCategory(e.target.value)}
                >
                  <option value="">-- Selecione --</option>
                  {categoryOptions.map((opt) => (
                    <option key={opt.category} value={opt.category}>
                      {CATEGORY_LABELS[opt.category] || opt.category}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Prioridade (1-5)</span>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={editedPriority}
                  onChange={(e) => setEditedPriority(parseInt(e.target.value))}
                />
              </label>

              <label>
                <span>Esforço</span>
                <select
                  value={editedEffort}
                  onChange={(e) => setEditedEffort(e.target.value)}
                >
                  <option value="minimal">minimal</option>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="very_high">very_high</option>
                </select>
              </label>
            </div>

            <div className="editor-row">
              <label>
                <span>Nível de Risco (0-1)</span>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={editedRiskLevel}
                  onChange={(e) => setEditedRiskLevel(parseFloat(e.target.value))}
                />
              </label>

              <label>
                <span>Requer Profissional?</span>
                <input
                  type="checkbox"
                  checked={editedRequiresProfessional}
                  onChange={(e) => setEditedRequiresProfessional(e.target.checked)}
                />
              </label>

              {editedRequiresProfessional && (
                <label>
                  <span>Tipo de Profissional</span>
                  <input
                    type="text"
                    value={editedProfessionalType}
                    onChange={(e) => setEditedProfessionalType(e.target.value)}
                    placeholder="e.g., orthodontist"
                  />
                </label>
              )}
            </div>

            <div className="editor-row">
              <label>
                <span>Nível de Invasividade (0-4)</span>
                <select
                  value={editedInvasivenessLevel}
                  onChange={(e) => setEditedInvasivenessLevel(parseInt(e.target.value, 10))}
                >
                  {[0, 1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>{INVASIVENESS_LABELS[n]}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Nível de Evidência</span>
                <select
                  value={editedEvidenceLevel}
                  onChange={(e) => setEditedEvidenceLevel(e.target.value as 'strong' | 'moderate' | 'anecdotal')}
                >
                  {(['strong', 'moderate', 'anecdotal'] as const).map((ev) => (
                    <option key={ev} value={ev}>{EVIDENCE_LABELS[ev]}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Caminho clínico obrigatório?</span>
                <input
                  type="checkbox"
                  checked={editedClinicalPathway}
                  onChange={(e) => setEditedClinicalPathway(e.target.checked)}
                />
              </label>
            </div>

            <div className="editor-section">
              <label>
                <span>
                  Disclaimer{' '}
                  {editedEvidenceLevel === 'anecdotal' && (
                    <span style={{ color: '#f59e0b' }}>(obrigatório para evidência popular)</span>
                  )}
                </span>
                <textarea
                  value={editedDisclaimer}
                  onChange={(e) => setEditedDisclaimer(e.target.value)}
                  rows={3}
                  placeholder="Texto adicional informativo, não-prescritivo. Suporta {professional_type_pt}."
                />
              </label>
            </div>

            {/* ── Animação SVG ── */}
            <div className="editor-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  Animação SVG
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                    ({editedCategory === 'exercise' ? 'recomendado para exercícios' : 'opcional'})
                  </span>
                </span>
                <span style={{ fontSize: 11, color: parsedAnimationConfig ? '#22d3ee' : animationParseError ? '#ef4444' : 'var(--muted)' }}>
                  {parsedAnimationConfig ? '✓ Config válida' : animationParseError ? '✗ JSON inválido' : 'sem animação'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'start' }}>
                {/* Left: JSON editor + toolbar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      style={{ flex: 1, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }}
                      value=""
                      onChange={(e) => { if (e.target.value) handleLoadPreset(e.target.value); }}
                    >
                      <option value="">Carregar template…</option>
                      {ANIMATION_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <button
                      onClick={handleClearAnimation}
                      style={{ padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
                    >
                      Limpar
                    </button>
                  </div>
                  <textarea
                    value={editedAnimationJson}
                    onChange={(e) => handleAnimationJsonChange(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    placeholder={`{\n  "schema_version": 1,\n  "primitives": [{"id": "brow_lift_both"}],\n  "duration_ms": 2000,\n  "repeat": "infinite"\n}`}
                    style={{
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: animationParseError ? '1px solid #ef4444' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      resize: 'vertical',
                      width: '100%',
                    }}
                  />
                  {animationParseError && <div style={{ color: '#ef4444', fontSize: 11 }}>{animationParseError}</div>}
                </div>
                {/* Right: live preview */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Preview ao vivo</span>
                  {parsedAnimationConfig ? (
                    <SvgFaceInstructor
                      config={parsedAnimationConfig}
                      width={200}
                      showCaption={!!parsedAnimationConfig.caption_pt}
                    />
                  ) : (
                    <div style={{
                      width: 200,
                      aspectRatio: '100 / 115',
                      background: 'var(--surface2)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                      fontSize: 12,
                      textAlign: 'center',
                      padding: 12,
                    }}>
                      {editedAnimationJson ? 'JSON inválido' : 'Sem animação configurada'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Biometric Config (PR-D) ── */}
            <div className="editor-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>
                  Biometric Config
                  <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 6 }}>
                    (simulador anatômico — wireframe + heatmap)
                  </span>
                </span>
                <span style={{ fontSize: 11, color: parsedBiometricConfig ? '#22d3ee' : biometricParseError ? '#ef4444' : 'var(--muted)' }}>
                  {parsedBiometricConfig ? '✓ Config válida' : biometricParseError ? '✗ JSON inválido' : 'sem config'}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 12, alignItems: 'start' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      style={{ flex: 1, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12 }}
                      value=""
                      onChange={(e) => { if (e.target.value) handleLoadBiometricPreset(e.target.value); }}
                    >
                      <option value="">Carregar template…</option>
                      {BIOMETRIC_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    <button
                      onClick={handleClearBiometric}
                      style={{ padding: '6px 12px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
                    >
                      Limpar
                    </button>
                  </div>
                  <textarea
                    value={editedBiometricConfig}
                    onChange={(e) => handleBiometricJsonChange(e.target.value)}
                    rows={14}
                    spellCheck={false}
                    placeholder={`{\n  "schema_version": 1,\n  "steps": [{"zone": "masseter_l", "verb": "stretch", "duration_ms": 1500}],\n  "cycle_ms": 5500,\n  "repeat": "infinite"\n}`}
                    style={{
                      fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
                      fontSize: 12,
                      lineHeight: 1.5,
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      border: biometricParseError ? '1px solid #ef4444' : '1px solid var(--border)',
                      borderRadius: 8,
                      padding: 10,
                      resize: 'vertical',
                      width: '100%',
                    }}
                  />
                  {biometricParseError && <div style={{ color: '#ef4444', fontSize: 11 }}>{biometricParseError}</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>Preview ao vivo</span>
                  {parsedBiometricConfig ? (
                    <BiometricFaceSimulator
                      config={parsedBiometricConfig}
                      size={220}
                      showCaption={!!parsedBiometricConfig.caption_pt}
                    />
                  ) : (
                    <div style={{
                      width: 220,
                      height: 220,
                      background: 'var(--surface2)',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--muted)',
                      fontSize: 12,
                      textAlign: 'center',
                      padding: 12,
                    }}>
                      {editedBiometricConfig ? 'JSON inválido' : 'Sem biometric config'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="editor-actions">
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              {saveMessage && (
                <div className={`save-message ${saveMessage.includes('✓') ? 'success' : 'error'}`}>
                  {saveMessage}
                </div>
              )}
            </div>

            {/* Preview section */}
            <div className="preview-section">
              <h3>Prévia</h3>
              <div className="preview-box">
                <div className="preview-short">{editedShortText}</div>
                <div className="preview-long">{editedLongText}</div>
                <div className="preview-meta">
                  <span>Categoria: {editedCategory}</span>
                  <span>Prioridade: {editedPriority}</span>
                  <span>Esforço: {editedEffort}</span>
                  <span>Risco: {editedRiskLevel.toFixed(1)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-selection">Selecione uma recomendação para editar.</div>
        )}
      </div>
    </div>
  );
}
