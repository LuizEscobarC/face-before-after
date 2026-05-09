/**
 * AdminTemplatesPage.tsx
 * PR-53 — Diagnostic Templates CRUD
 *
 * Read + Edit interface for managing diagnostic templates.
 * Features:
 *   - Filter by metric + size
 *   - List with preview
 *   - Click to edit → inline textarea
 *   - Preview render (text with fake placeholders substituted)
 *   - Save button → PATCH endpoint
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchTemplateMetrics,
  fetchTemplates,
  updateTemplate,
} from '../api';
import type {
  DiagnosticTemplate,
  TemplateMetricOption,
  TemplateRenderPreview,
} from '../types';
import './AdminTemplatesPage.css';

export function AdminTemplatesPage() {
  const [metrics, setMetrics] = useState<TemplateMetricOption[]>([]);
  const [templates, setTemplates] = useState<DiagnosticTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<DiagnosticTemplate[]>([]);

  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<DiagnosticTemplate | null>(null);

  const [editedText, setEditedText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [metricsData, templatesData] = await Promise.all([
          fetchTemplateMetrics(),
          fetchTemplates(),
        ]);
        setMetrics(metricsData);
        setTemplates(templatesData);
        setFilteredTemplates(templatesData);
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      }
    };

    loadData();
  }, []);

  // Filter templates when filters change
  useEffect(() => {
    let filtered = templates;

    if (selectedMetric) {
      filtered = filtered.filter((t) => t.metricId === selectedMetric);
    }
    if (selectedSize) {
      filtered = filtered.filter((t) => t.size === selectedSize);
    }

    setFilteredTemplates(filtered);
    setSelectedTemplate(null);
    setEditedText('');
  }, [selectedMetric, selectedSize, templates]);

  // When a template is selected, load its text
  const handleSelectTemplate = useCallback((template: DiagnosticTemplate) => {
    setSelectedTemplate(template);
    setEditedText(template.templatePt);
    setSaveMessage('');
  }, []);

  // Generate preview with fake data
  const generatePreview = useCallback((text: string): string => {
    const fakeData: TemplateRenderPreview = {
      value: '7.5',
      ideal: '8.0',
      deviationPct: '6.25',
      directionLabel: 'levemente para a esquerda',
      regionPt: 'Eixo Facial',
      severityPt: 'moderado',
    };

    let preview = text;
    preview = preview.replace(/{value}/g, fakeData.value);
    preview = preview.replace(/{ideal}/g, fakeData.ideal);
    preview = preview.replace(/{deviation_pct}/g, fakeData.deviationPct);
    preview = preview.replace(/{direction_label}/g, fakeData.directionLabel);
    preview = preview.replace(/{region_pt}/g, fakeData.regionPt);
    preview = preview.replace(/{severity_pt}/g, fakeData.severityPt);

    return preview;
  }, []);

  // Save handler
  const handleSave = async () => {
    if (!selectedTemplate) return;

    setIsSaving(true);
    setSaveMessage('');

    try {
      await updateTemplate(selectedTemplate.id, editedText);
      setSaveMessage('✓ Template salvo com sucesso!');
      
      // Update local state
      setTemplates((prevTemplates) =>
        prevTemplates.map((t) =>
          t.id === selectedTemplate.id ? { ...t, templatePt: editedText } : t,
        ),
      );
      setSelectedTemplate({ ...selectedTemplate, templatePt: editedText });

      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      setSaveMessage(`✗ Erro: ${err instanceof Error ? err.message : 'Desconhecido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const previewText = selectedTemplate ? generatePreview(editedText) : '';

  return (
    <div className="admin-templates-page">
      <div className="admin-header">
        <h1>✎ Editor de Templates de Diagnóstico</h1>
        <p className="admin-subtitle">Revise e edite textos que aparecem para o usuário final</p>
      </div>

      <div className="admin-container">
        {/* Left Panel: Filters + List */}
        <div className="admin-left-panel">
          <div className="filters-section">
            <h2>Filtros</h2>

            <div className="filter-group">
              <label htmlFor="metric-select">Métrica:</label>
              <select
                id="metric-select"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
              >
                <option value="">— Todas —</option>
                {metrics.map((m) => (
                  <option key={m.metricId} value={m.metricId}>
                    {m.metricId}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="size-select">Tamanho:</label>
              <select
                id="size-select"
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value)}
              >
                <option value="">— Todos —</option>
                <option value="short">short</option>
                <option value="medium">medium</option>
                <option value="long">long</option>
              </select>
            </div>

            <div className="filter-info">
              {filteredTemplates.length} template(s)
            </div>
          </div>

          <div className="templates-list-section">
            <h2>Templates</h2>
            <div className="templates-list">
              {filteredTemplates.length === 0 ? (
                <p className="no-templates">Nenhum template encontrado</p>
              ) : (
                filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className={`template-item ${
                      selectedTemplate?.id === template.id ? 'active' : ''
                    }`}
                    onClick={() => handleSelectTemplate(template)}
                  >
                    <div className="template-item-header">
                      <strong>{template.metricId}</strong>
                      <span className="badge-severity">{template.severity}</span>
                      <span className="badge-size">{template.size}</span>
                    </div>
                    <div className="template-item-preview">
                      {template.templatePt.substring(0, 60)}
                      {template.templatePt.length > 60 ? '…' : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Editor + Preview */}
        <div className="admin-right-panel">
          {selectedTemplate ? (
            <>
              <div className="editor-header">
                <h2>{selectedTemplate.metricId}</h2>
                <div className="editor-badges">
                  <span className="badge">{selectedTemplate.severity}</span>
                  <span className="badge">{selectedTemplate.direction}</span>
                  <span className="badge">{selectedTemplate.size}</span>
                </div>
              </div>

              <div className="editor-body">
                {/* Left: Text Editor */}
                <div className="editor-text-section">
                  <label htmlFor="template-textarea">Texto (template_pt):</label>
                  <textarea
                    id="template-textarea"
                    value={editedText}
                    onChange={(e) => setEditedText(e.target.value)}
                    className="template-textarea"
                    placeholder="Digite o template aqui. Use {value}, {ideal}, {deviation_pct}, etc."
                  />
                  <div className="template-help-text">
                    Placeholders disponíveis: {'{value}'}, {'{ideal}'}, {'{deviation_pct}'},
                    {'{direction_label}'}, {'{region_pt}'}, {'{severity_pt}'}
                  </div>
                </div>

                {/* Right: Preview */}
                <div className="editor-preview-section">
                  <label>Pré-visualização (com dados fake):</label>
                  <div className="preview-box">
                    {previewText || '(Nenhum texto selecionado)'}
                  </div>
                </div>
              </div>

              <div className="editor-footer">
                {saveMessage && (
                  <div className={`save-message ${saveMessage.startsWith('✓') ? 'success' : 'error'}`}>
                    {saveMessage}
                  </div>
                )}
                <button
                  onClick={handleSave}
                  disabled={isSaving || editedText.trim() === ''}
                  className="save-button"
                >
                  {isSaving ? 'Salvando...' : 'Salvar Template'}
                </button>
              </div>
            </>
          ) : (
            <div className="editor-empty">
              <p>Selecione um template para editar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
