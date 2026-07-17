import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { FileBarChart, Plus, Trash2, X, Layers } from 'lucide-react';
import { DataService } from '../services/dataService';
import { ReportSummary } from '../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

const ReportsListView: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = () => {
    DataService.getReports().then(setReports).catch(() => setReports([]));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const report = await DataService.createReport({ name: name.trim(), description: description.trim() || null });
      navigate(`/reports/${report.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este relatório? Essa ação não pode ser desfeita.')) return;
    setDeletingId(id);
    try {
      await DataService.deleteReport(id);
      setReports(prev => prev?.filter(r => r.id !== id) ?? null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div style={{ padding: '24px 28px 64px', maxWidth: 1200, margin: '0 auto' }} className="animate-fade-in-up">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileBarChart size={20} style={{ color: 'var(--accent)' }} /> Relatórios
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4 }}>
            Monte relatórios customizados combinando leads, receita, campanhas, GA4 e e-mail
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={15} /> Novo Relatório
        </button>
      </div>

      {creating && createPortal(
        <div onClick={() => !saving && setCreating(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="ds-card" style={{ width: 'min(420px, 100%)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)' }}>Novo Relatório</span>
              <button type="button" onClick={() => setCreating(false)} style={{ background: 'var(--bg-muted)', border: 'none', borderRadius: 8, width: 28, height: 28, cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Nome</span>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="ex: Performance Mensal de Marketing"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Descrição (opcional)</span>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: KPIs de leads, receita e campanhas"
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', fontSize: 13, outline: 'none' }} />
            </label>
            <button type="button" onClick={handleCreate} disabled={!name.trim() || saving}
              style={{ width: '100%', padding: '10px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: !name.trim() || saving ? 'default' : 'pointer', opacity: !name.trim() || saving ? 0.6 : 1 }}>
              {saving ? 'Criando...' : 'Criar e Editar'}
            </button>
          </div>
        </div>,
        document.body
      )}

      {reports === null ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="ds-card" style={{ height: 110 }} />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="ds-card" style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--fg-subtle)' }}>
          <Layers size={28} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontSize: 13, margin: 0 }}>Nenhum relatório criado ainda. Clique em "Novo Relatório" para começar.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {reports.map(r => (
            <div key={r.id} className="ds-card" onClick={() => navigate(`/reports/${r.id}`)}
              style={{ padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-primary)' }}>{r.name}</span>
                <button type="button" onClick={e => { e.stopPropagation(); handleDelete(r.id); }} disabled={deletingId === r.id}
                  style={{ background: 'transparent', border: 'none', color: 'var(--fg-subtle)', cursor: 'pointer', flexShrink: 0, padding: 2 }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {r.description && (
                <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {r.description}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-subtle)', marginTop: 'auto', paddingTop: 8 }}>
                <span>{r._count.widgets} widget{r._count.widgets !== 1 ? 's' : ''}</span>
                <span>Atualizado {fmtDate(r.updatedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ReportsListView;
