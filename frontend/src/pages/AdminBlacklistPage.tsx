import { useState, useEffect } from 'react';
import {
  fetchBlacklistVersions,
  fetchBlacklistTerms,
  createBlacklistTerm,
  updateBlacklistTerm,
  deleteBlacklistTerm,
} from '../api';
import type { BlacklistTerm } from '../types';
import './admin-shared.css';

const CATEGORIES = ['diagnostic_verb', 'pathology_word', 'guarantee_word', 'medical_intervention', 'pejorative'];

export default function AdminBlacklistPage() {
  const [versions, setVersions] = useState<{ version: string }[]>([]);
  const [items, setItems] = useState<BlacklistTerm[]>([]);
  const [filterVersion, setFilterVersion] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [selected, setSelected] = useState<BlacklistTerm | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetchBlacklistVersions().then((v) => {
      setVersions(v);
      if (v.length > 0) setFilterVersion(v[v.length - 1].version);
    }).catch(console.error);
  }, []);

  const loadTerms = () => {
    fetchBlacklistTerms({ version: filterVersion || undefined, category: filterCategory || undefined })
      .then(setItems)
      .catch((e) => setMsg(`✗ ${e.message}`));
  };

  useEffect(() => { loadTerms(); }, [filterVersion, filterCategory]);

  const handleSelect = (item: BlacklistTerm) => {
    setSelected(item);
    setEditNotes(item.notes ?? '');
    setEditCategory(item.category);
    setMsg('');
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const updated = await updateBlacklistTerm(selected.id, { notes: editNotes, category: editCategory as any });
      setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setSelected(updated);
      setMsg('✓ Salvo!');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Remover termo "${selected.term}"?`)) return;
    try {
      await deleteBlacklistTerm(selected.id);
      setItems((prev) => prev.filter((i) => i.id !== selected.id));
      setSelected(null);
      setMsg('✓ Removido.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    }
  };

  const handleCreate = async () => {
    if (!newTerm.trim() || !newCategory || !filterVersion) {
      setMsg('✗ Preencha termo, categoria e selecione uma versão.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await createBlacklistTerm({
        version: filterVersion,
        term: newTerm.trim(),
        category: newCategory as any,
        notes: newNotes || undefined,
      });
      setItems((prev) => [...prev, created].sort((a, b) => a.term.localeCompare(b.term)));
      setNewTerm(''); setNewNotes(''); setNewCategory('');
      setMsg('✓ Termo adicionado.');
      setTimeout(() => setMsg(''), 2500);
    } catch (e: any) {
      setMsg(`✗ ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-left-panel">
        <div className="admin-filters">
          <label>
            Versão
            <select value={filterVersion} onChange={(e) => setFilterVersion(e.target.value)}>
              <option value="">Todas</option>
              {versions.map((v) => <option key={v.version} value={v.version}>{v.version}</option>)}
            </select>
          </label>
          <label>
            Categoria
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">Todas</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="admin-list">
          {items.map((item) => (
            <div
              key={item.id}
              className={`admin-list-item ${selected?.id === item.id ? 'active' : ''}`}
              onClick={() => handleSelect(item)}
            >
              <div className="item-title">{item.term}</div>
              <div className="item-sub">{item.category} · {item.version}</div>
            </div>
          ))}
          {items.length === 0 && <div className="admin-list-empty">Nenhum termo encontrado.</div>}
        </div>
      </div>

      <div className="admin-right-panel">
        <div className="admin-editor">
          {/* Add new term */}
          <h2>Adicionar Novo Termo</h2>
          <div className="admin-grid">
            <div className="admin-field">
              <label>Termo</label>
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="ex: diagnostica"
              />
            </div>
            <div className="admin-field">
              <label>Categoria</label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                <option value="">-- Selecione --</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="admin-field">
            <label>Notas</label>
            <textarea rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Motivo da proibição..." />
          </div>
          <div className="admin-actions">
            <button className="btn-primary" onClick={handleCreate} disabled={isSaving}>Adicionar</button>
            {msg && <span className={`admin-msg ${msg.startsWith('✓') ? 'success' : 'error'}`}>{msg}</span>}
          </div>

          {/* Edit selected */}
          {selected && (
            <>
              <hr style={{ borderColor: 'var(--border)', margin: '16px 0' }} />
              <h2>Editar: <em style={{ color: 'var(--accent)' }}>{selected.term}</em></h2>
              <div className="admin-field">
                <label>Categoria</label>
                <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="admin-field">
                <label>Notas</label>
                <textarea rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
              <div className="admin-actions">
                <button className="btn-primary" onClick={handleUpdate} disabled={isSaving}>Salvar</button>
                <button className="btn-danger" onClick={handleDelete}>Remover</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
