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
import './AdminRecommendationsPage.css';

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
