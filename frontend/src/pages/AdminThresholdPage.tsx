import { useState, useEffect } from 'react';
import { fetchThresholdConfigs, updateThresholdConfig, activateThresholdConfig } from '../api';
import type { ThresholdConfig } from '../types';
import './admin-shared.css';

export default function AdminThresholdPage() {
  const [items, setItems] = useState<ThresholdConfig[]>([]);
  const [selected, setSelected] = useState<ThresholdConfig | null>(null);
  const [form, setForm] = useState<Partial<ThresholdConfig>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchThresholdConfigs().then(setItems).catch((e) => setMsg(`✗ ${e.message}`));
  }, []);

  const handleSelect = (item: ThresholdConfig) => {
    setSelected(item);
    setForm({ ...item });
    setMsg('');
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const updated = await updateThresholdConfig(selected.version, {
        minConfidenceToDisplayMetric: form.minConfidenceToDisplayMetric,
        minConfidenceToShowGlobalScore: form.minConfidenceToShowGlobalScore,
        scoreBandNoNumberMax: form.scoreBandNoNumberMax,
        scoreBandRefineMax: form.scoreBandRefineMax,
        scoreBandGoodMax: form.scoreBandGoodMax,
        disclaimerTextSnapshot: form.disclaimerTextSnapshot,
      });
      setItems((prev) => prev.map((i) => (i.version === updated.version ? updated : i)));
      setSelected(updated);
      setMsg('✓ Salvo!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async () => {
    if (!selected) return;
    if (!window.confirm(`Ativar configuração "${selected.version}"? As outras versões serão desativadas.`)) return;
    setIsSaving(true);
    try {
      const updated = await activateThresholdConfig(selected.version);
      setItems((prev) => prev.map((i) => ({ ...i, isActive: i.version === updated.version })));
      setSelected(updated);
      setMsg('✓ Ativado!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const numField = (key: keyof ThresholdConfig, label: string, step = 0.01) => (
    <div className="admin-field">
      <label>{label}</label>
      <input
        type="number"
        step={step}
        value={form[key] as number ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [key]: parseFloat(e.target.value) || 0 }))}
      />
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-left-panel">
        <div className="admin-filters">
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--muted)', padding: '4px 0' }}>
            Versões ({items.length})
          </span>
        </div>
        <div className="admin-list">
          {items.map((item) => (
            <div
              key={item.version}
              className={`admin-list-item ${selected?.version === item.version ? 'active' : ''}`}
              onClick={() => handleSelect(item)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="item-title">{item.version}</span>
                {item.isActive && <span className="badge badge-active">ATIVA</span>}
              </div>
              <div className="item-sub">
                conf. min: {item.minConfidenceToDisplayMetric} | banda boa: {item.scoreBandGoodMax}
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="admin-list-empty">Nenhuma configuração.</div>}
        </div>
      </div>

      <div className="admin-right-panel">
        {selected ? (
          <div className="admin-editor">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h2>{selected.version}</h2>
              {selected.isActive && <span className="badge badge-active">ATIVA</span>}
            </div>

            <div className="admin-grid">
              {numField('minConfidenceToDisplayMetric', 'Conf. Mínima para Exibir Métrica')}
              {numField('minConfidenceToShowGlobalScore', 'Conf. Mínima para Score Global')}
            </div>

            <div className="admin-grid-3">
              {numField('scoreBandNoNumberMax', 'Banda Sem Número (max)', 0.5)}
              {numField('scoreBandRefineMax', 'Banda Refine (max)', 0.5)}
              {numField('scoreBandGoodMax', 'Banda Boa (max)', 0.5)}
            </div>

            <div className="admin-field">
              <label>Texto do Disclaimer</label>
              <textarea
                rows={5}
                value={form.disclaimerTextSnapshot ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, disclaimerTextSnapshot: e.target.value }))}
              />
            </div>

            <div className="admin-actions">
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              {!selected.isActive && (
                <button className="btn-secondary" onClick={handleActivate} disabled={isSaving}>
                  Ativar esta versão
                </button>
              )}
              {msg && <span className={`admin-msg ${msg.startsWith('✓') ? 'success' : 'error'}`}>{msg}</span>}
            </div>
          </div>
        ) : (
          <div className="admin-no-selection">Selecione uma configuração para editar.</div>
        )}
      </div>
    </div>
  );
}
