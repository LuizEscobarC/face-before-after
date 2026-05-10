import { useState, useEffect } from 'react';
import { fetchMetricIdealVersions, fetchMetricIdeals, updateMetricIdeal, fetchMetricLabels } from '../api';
import type { MetricIdeal } from '../types';
import './admin-shared.css';

export default function AdminMetricIdealPage() {
  const [versions, setVersions] = useState<{ idealsVersion: string }[]>([]);
  const [items, setItems] = useState<MetricIdeal[]>([]);
  const [selected, setSelected] = useState<MetricIdeal | null>(null);
  const [filterVersion, setFilterVersion] = useState('');
  const [filterMetric, setFilterMetric] = useState('');
  const [form, setForm] = useState<Partial<MetricIdeal>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    fetchMetricIdealVersions().then(setVersions).catch(console.error);
    fetchMetricLabels()
      .then((labels) => setLabelMap(new Map(labels.map((l) => [l.metricId, l.label]))))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchMetricIdeals({ idealsVersion: filterVersion || undefined, metricId: filterMetric || undefined })
      .then(setItems)
      .catch((e) => setMsg(`✗ ${e.message}`));
  }, [filterVersion, filterMetric]);

  const handleSelect = (item: MetricIdeal) => {
    setSelected(item);
    setForm({
      idealCentralValue: item.idealCentralValue,
      greenRangeMin: item.greenRangeMin,
      greenRangeMax: item.greenRangeMax,
      yellowRangeMin: item.yellowRangeMin,
      yellowRangeMax: item.yellowRangeMax,
      populationReferenceNote: item.populationReferenceNote,
    });
    setMsg('');
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const updated = await updateMetricIdeal(selected.id, form);
      setSelected(updated);
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setMsg('✓ Salvo com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const numField = (key: keyof MetricIdeal, label: string) => (
    <div className="admin-field">
      <label>{label}</label>
      <input
        type="number"
        step="0.000001"
        value={form[key] as number ?? ''}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value === '' ? null : parseFloat(e.target.value) }))}
      />
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-left-panel">
        <div className="admin-filters">
          <label>
            Versão
            <select value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)}>
              <option value="">Todas</option>
              {versions.map((v) => <option key={v.idealsVersion} value={v.idealsVersion}>{v.idealsVersion}</option>)}
            </select>
          </label>
          <label>
            Filtrar por métrica
            <input
              type="text"
              value={filterMetric}
              onChange={(e) => setFilterMetric(e.target.value)}
              placeholder="ex: alar_base..."
            />
          </label>
        </div>
        <div className="admin-list">
          {items.map((item) => (
            <div
              key={item.id}
              className={`admin-list-item ${selected?.id === item.id ? 'active' : ''}`}
              onClick={() => handleSelect(item)}
            >
              <div className="item-title">{labelMap.get(item.metricId) || item.metricId}</div>
              <div className="item-sub" style={{ color: 'var(--muted)', fontSize: 11 }}>{item.metricId}</div>
              <div className="item-sub">{item.idealsVersion} · {item.idealType}</div>
              <div className="item-sub">
                central: {item.idealCentralValue ?? '—'} | verde: [{item.greenRangeMin ?? '—'}, {item.greenRangeMax ?? '—'}]
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="admin-list-empty">Nenhum item encontrado.</div>}
        </div>
      </div>

      <div className="admin-right-panel">
        {selected ? (
          <div className="admin-editor">
            <h2>{labelMap.get(selected.metricId) || selected.metricId}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
              <code style={{ background: 'var(--surface2)', padding: '1px 6px', borderRadius: 4 }}>{selected.metricId}</code>
              {' · '}Versão: {selected.idealsVersion} | Tipo: {selected.idealType}
            </p>

            {numField('idealCentralValue', 'Valor Central Ideal')}

            <div className="admin-grid">
              {numField('greenRangeMin', 'Verde Min')}
              {numField('greenRangeMax', 'Verde Max')}
              {numField('yellowRangeMin', 'Amarelo Min')}
              {numField('yellowRangeMax', 'Amarelo Max')}
            </div>

            <div className="admin-field">
              <label>Nota de Referência Populacional</label>
              <textarea
                rows={3}
                value={form.populationReferenceNote ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, populationReferenceNote: e.target.value || null }))}
              />
            </div>

            <div className="admin-actions">
              <button className="btn-primary" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
              {msg && <span className={`admin-msg ${msg.startsWith('✓') ? 'success' : 'error'}`}>{msg}</span>}
            </div>
          </div>
        ) : (
          <div className="admin-no-selection">Selecione um ideal de métrica para editar.</div>
        )}
      </div>
    </div>
  );
}
