import { useState, useEffect } from 'react';
import { fetchGlobalWeightVersions, fetchGlobalWeights, updateGlobalWeight } from '../api';
import type { GlobalWeight } from '../types';
import './admin-shared.css';

const REGION_LABELS: Record<string, string> = {
  global: 'Forma Global',
  forehead: 'Testa',
  eyes: 'Olhos',
  nose: 'Nariz',
  mouth: 'Boca',
  cheekbones: 'Maçãs do Rosto',
  jaw: 'Mandíbula',
  symmetry: 'Simetria',
};

export default function AdminGlobalWeightsPage() {
  const [versions, setVersions] = useState<{ version: string }[]>([]);
  const [items, setItems] = useState<GlobalWeight[]>([]);
  const [filterVersion, setFilterVersion] = useState('');
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchGlobalWeightVersions().then((v) => {
      setVersions(v);
      if (v.length > 0) setFilterVersion(v[v.length - 1].version); // latest by default
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!filterVersion) return;
    fetchGlobalWeights(filterVersion).then((data) => {
      setItems(data);
      const e: Record<string, number> = {};
      data.forEach((w) => (e[w.id] = w.weight));
      setEdits(e);
    }).catch(console.error);
  }, [filterVersion]);

  const handleSave = async (id: string) => {
    setSaving(id);
    try {
      const updated = await updateGlobalWeight(id, edits[id]);
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setMsgs((m) => ({ ...m, [id]: '✓' }));
      setTimeout(() => setMsgs((m) => ({ ...m, [id]: '' })), 2000);
    } catch (e: any) {
      setMsgs((m) => ({ ...m, [id]: `✗ ${e.message}` }));
    } finally {
      setSaving(null);
    }
  };

  const totalWeight = Object.values(edits).reduce((s, w) => s + w, 0);

  return (
    <div style={{ padding: 24, maxWidth: 700, background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)' }}>
      <h1 style={{ fontSize: 22, marginBottom: 16, color: 'var(--accent2)' }}>Global Weights</h1>

      <div className="admin-field" style={{ maxWidth: 220, marginBottom: 20 }}>
        <label>Versão</label>
        <select value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)}>
          <option value="">-- Selecione --</option>
          {versions.map((v) => <option key={v.version} value={v.version}>{v.version}</option>)}
        </select>
      </div>

      {items.length > 0 && (
        <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--muted)' }}>
          Soma total dos pesos: <strong style={{ color: Math.abs(totalWeight - 1) < 0.01 ? '#22d3ee' : '#f59e0b' }}>
            {totalWeight.toFixed(4)}
          </strong>
          {Math.abs(totalWeight - 1) < 0.01 ? ' ✓ soma ≈ 1.0' : ' ⚠ idealmente deve somar 1.0'}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <div key={item.id} style={{
            display: 'grid',
            gridTemplateColumns: '180px 1fr auto auto',
            gap: 10,
            alignItems: 'center',
            padding: '10px 14px',
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                {REGION_LABELS[item.region] || item.region}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.region}</div>
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              max="10"
              value={edits[item.id] ?? item.weight}
              onChange={(e) => setEdits((ed) => ({ ...ed, [item.id]: parseFloat(e.target.value) || 0 }))}
              style={{ padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13 }}
            />
            <button
              className="btn-primary"
              onClick={() => handleSave(item.id)}
              disabled={saving === item.id}
              style={{ padding: '6px 12px', fontSize: 12 }}
            >
              {saving === item.id ? '...' : 'Salvar'}
            </button>
            {msgs[item.id] && (
              <span style={{ fontSize: 11, color: msgs[item.id]?.startsWith('✓') ? '#22d3ee' : '#ef4444' }}>
                {msgs[item.id]}
              </span>
            )}
          </div>
        ))}
        {items.length === 0 && filterVersion && <div className="admin-list-empty">Nenhum peso encontrado.</div>}
      </div>
    </div>
  );
}
