import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  RefreshCw,
  Flame,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  TrendingUp,
  ExternalLink,
  Download,
  Upload,
  Settings2,
  Trash2,
  X,
  Pencil,
  Clipboard,
  Minus,
  Link2,
  Power,
  RotateCw,
  Send,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { Lead, LeadListResult, LeadStatus, FunnelCounts, LeadCustomFieldDef, LeadWebhookSource, LeadWebhookLog, LeadWebhookInspection, LeadClassificationRule, LeadRuleCondition, LeadRuleAction } from '../types';
import { DataService } from '../services/dataService';
import { SegmentView } from './SegmentView';

// ─── Constants ────────────────────────────────────────────────────────────────

type StatusMeta = { value: LeadStatus; label: string; badgeClass: string; dotColor: string };

const STATUSES: StatusMeta[] = [
  { value: 'LEAD',         label: 'Lead',           badgeClass: '',        dotColor: 'var(--sl-400)' },
  { value: 'MQL',          label: 'MQL',            badgeClass: '',        dotColor: 'var(--af-500)' },
  { value: 'SQL',          label: 'SQL',            badgeClass: '',        dotColor: '#818cf8' },
  { value: 'SCHEDULED',    label: 'Agendado',       badgeClass: '',        dotColor: '#f59e0b' },
  { value: 'DEMO',         label: 'Demo',           badgeClass: '',        dotColor: '#f97316' },
  { value: 'PROPOSAL',     label: 'Proposta',       badgeClass: 'warning', dotColor: '#a855f7' },
  { value: 'CLIENT',       label: 'Cliente',        badgeClass: 'success', dotColor: 'var(--green-500)' },
  { value: 'LOST',         label: 'Perdido',        badgeClass: 'danger',  dotColor: 'var(--red-500)' },
  { value: 'DISQUALIFIED', label: 'Desqualificado', badgeClass: '',        dotColor: 'var(--fg-subtle)' },
];

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s])) as Record<LeadStatus, StatusMeta>;
// Fallback for legacy OPPORTUNITY records in DB — maps to Proposta silently
(STATUS_MAP as Record<string, StatusMeta>)['OPPORTUNITY'] = { value: 'PROPOSAL', label: 'Proposta', badgeClass: 'warning', dotColor: '#a855f7' };

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: LeadStatus }> = ({ status }) => {
  const s = STATUS_MAP[status];
  return (
    <span className={`ds-badge ${s.badgeClass}`}>
      <span className="dot" style={{ background: s.dotColor }} />
      {s.label}
    </span>
  );
};

const FunnelBar: React.FC<{
  counts: FunnelCounts;
  activeStatus: LeadStatus | undefined;
  onFilter: (status: LeadStatus | undefined) => void;
}> = ({ counts, activeStatus, onFilter }) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="ds-card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={14} style={{ color: 'var(--fg-muted)' }} />
          <span style={{ fontSize: 11, color: 'var(--fg-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em' }}>Funil</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{total.toLocaleString('pt-BR')} leads</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {STATUSES.map(s => {
          const count = counts[s.value] ?? 0;
          const isActive = activeStatus === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onFilter(isActive ? undefined : s.value)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 'var(--r-md)',
                fontSize: 12, fontWeight: 500,
                border: `1px solid ${isActive ? s.dotColor : 'var(--border)'}`,
                background: isActive ? `${s.dotColor}18` : 'transparent',
                color: isActive ? s.dotColor : 'var(--fg-muted)',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dotColor, flexShrink: 0 }} />
              <span>{s.label}</span>
              <span style={{ fontWeight: 700, color: isActive ? s.dotColor : 'var(--fg-secondary)' }}>{count}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
};

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

const IMPORT_COLUMNS = [
  { key: 'email',          label: 'Email *',                          required: true },
  { key: 'name',           label: 'Nome',                             required: false },
  { key: 'phone',          label: 'Telefone',                         required: false },
  { key: 'company',        label: 'Empresa',                          required: false },
  { key: 'jobTitle',       label: 'Cargo',                            required: false },
  { key: 'city',           label: 'Cidade',                           required: false },
  { key: 'state',          label: 'Estado',                           required: false },
  { key: 'tags',           label: 'Tags (separadas por vírgula)',      required: false },
  { key: 'source',         label: 'Origem',                           required: false },
  { key: 'first_seen_at',  label: 'Data de chegada (AAAA-MM-DD)',      required: false },
];

function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if ((ch === ',' || ch === ';') && !inQuote) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
  return { headers, rows };
}

function autoMap(headers: string[]): Record<string, string> {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
  const aliases: Record<string, string> = {
    email: 'email', mail: 'email',
    nome: 'name', name: 'name',
    telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone',
    empresa: 'company', company: 'company', organization: 'company',
    cargo: 'jobTitle', jobtitle: 'jobTitle', role: 'jobTitle',
    cidade: 'city', city: 'city',
    estado: 'state', state: 'state', uf: 'state',
    tags: 'tags', tag: 'tags',
    origem: 'source', source: 'source', canal: 'source',
  };
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const target = aliases[normalize(h)];
    if (target) mapping[h] = target;
  }
  return mapping;
}

const CsvImportModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [step, setStep]           = useState<'upload' | 'map' | 'importing' | 'done'>('upload');
  const [headers, setHeaders]     = useState<string[]>([]);
  const [preview, setPreview]     = useState<Record<string, string>[]>([]);
  const [allRows, setAllRows]     = useState<Record<string, string>[]>([]);
  const [mapping, setMapping]     = useState<Record<string, string>>({});
  const [result, setResult]       = useState<{ total: number; created: number; updated: number; errors: number; errorDetails: { row: number; email: string; error: string }[] } | null>(null);
  const [dragOver, setDragOver]   = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    DataService.listCustomFieldDefs().then(setCustomFieldDefs).catch(() => {});
  }, []);

  const allImportColumns = [
    ...IMPORT_COLUMNS,
    ...customFieldDefs.map((cf: LeadCustomFieldDef) => ({ key: cf.name, label: `${cf.label} (campo personalizado)`, required: false })),
  ];

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string;
      const { headers: h, rows } = parseCsvText(text);
      if (h.length === 0) { alert('Arquivo inválido ou vazio.'); return; }
      setHeaders(h);
      setAllRows(rows);
      setPreview(rows.slice(0, 5));
      setMapping(autoMap(h));
      setStep('map');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    setStep('importing');
    const mappedRows = allRows.map(row => {
      const out: Record<string, string> = {};
      for (const [col, target] of Object.entries(mapping)) {
        if (target && row[col] !== undefined) out[target] = row[col];
      }
      return out;
    });

    const CHUNK = 500;
    const chunks: Record<string, string>[][] = [];
    for (let i = 0; i < mappedRows.length; i += CHUNK) chunks.push(mappedRows.slice(i, i + CHUNK));

    setImportProgress({ done: 0, total: mappedRows.length });

    const totals = { total: 0, created: 0, updated: 0, errors: 0, errorDetails: [] as { row: number; email: string; error: string }[] };
    let offset = 0;
    try {
      for (const chunk of chunks) {
        const res = await DataService.importLeads(chunk);
        totals.total   += res.total;
        totals.created += res.created;
        totals.updated += res.updated;
        totals.errors  += res.errors;
        totals.errorDetails.push(...res.errorDetails.map(e => ({ ...e, row: e.row + offset })));
        offset += chunk.length;
        setImportProgress({ done: offset, total: mappedRows.length });
      }
      setResult(totals);
      setStep('done');
    } catch (err) {
      alert('Erro na importação: ' + (err instanceof Error ? err.message : String(err)));
      setStep('map');
    }
  };

  const hasEmailMapping = Object.values(mapping).includes('email');

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const boxStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 680, maxHeight: '90vh',
    overflow: 'auto', display: 'flex', flexDirection: 'column',
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  };

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={boxStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Upload size={17} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>Importar Leads (CSV)</h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* STEP: upload */}
          {step === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 12, padding: '48px 24px', textAlign: 'center',
                cursor: 'pointer', background: dragOver ? 'var(--accent-soft)' : 'var(--bg-subtle)',
                transition: 'all .15s',
              }}
            >
              <FileText size={36} style={{ color: 'var(--fg-muted)', marginBottom: 12 }} />
              <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: 'var(--fg-primary)' }}>
                Arraste um arquivo CSV aqui ou clique para selecionar
              </p>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--fg-muted)' }}>
                Formatos aceitos: .csv com separador vírgula ou ponto-e-vírgula
              </p>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--fg-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', display: 'inline-block' }}>
                Limite: <strong>5.000 leads por importação.</strong> Para bases maiores, divida o CSV em lotes de até 5.000 linhas.
              </p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          )}

          {/* STEP: map */}
          {step === 'map' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                    {allRows.length} linhas detectadas
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>
                    Mapeie as colunas do CSV para os campos do sistema.
                  </p>
                </div>
                <button type="button" onClick={() => setStep('upload')} style={{ fontSize: 12, color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Trocar arquivo
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {headers.map(col => (
                  <div key={col} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--fg-secondary)', background: 'var(--bg-subtle)', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {col}
                      {preview[0]?.[col] && <span style={{ color: 'var(--fg-subtle)', marginLeft: 6 }}>— {preview[0][col]}</span>}
                    </div>
                    <select
                      value={mapping[col] ?? ''}
                      onChange={e => setMapping(m => ({ ...m, [col]: e.target.value }))}
                      style={{ fontSize: 12, padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: 'var(--fg-primary)', outline: 'none', width: '100%' }}
                    >
                      <option value="">— Ignorar —</option>
                      {allImportColumns.map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {allRows.length > 5000 && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 10 }}>
                  <AlertCircle size={15} style={{ color: 'var(--red-500)', flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, color: 'var(--red-600)' }}>
                    Este arquivo tem <strong>{allRows.length.toLocaleString('pt-BR')} linhas</strong>, mas o limite por importação é de <strong>5.000 leads</strong>.
                    Divida o CSV em lotes de até 5.000 linhas e importe um de cada vez.
                  </span>
                </div>
              )}

              {!hasEmailMapping && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 10 }}>
                  <AlertCircle size={15} style={{ color: 'var(--red-500)', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: 'var(--red-600)' }}>Mapeie ao menos uma coluna para o campo <strong>Email</strong>.</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!hasEmailMapping}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: hasEmailMapping ? 'var(--accent)' : 'var(--bg-muted)', color: hasEmailMapping ? 'white' : 'var(--fg-subtle)', fontSize: 13, fontWeight: 700, cursor: hasEmailMapping ? 'pointer' : 'not-allowed' }}
                >
                  Importar {allRows.length} leads
                </button>
              </div>
            </>
          )}

          {/* STEP: importing */}
          {step === 'importing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '32px 0' }}>
              <RefreshCw size={32} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite' }} />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)' }}>
                Importando {importProgress.done.toLocaleString('pt-BR')} / {importProgress.total.toLocaleString('pt-BR')} leads...
              </p>
              {importProgress.total > 0 && (
                <div style={{ width: '100%', maxWidth: 320, height: 6, background: 'var(--border)', borderRadius: 99 }}>
                  <div style={{ height: '100%', borderRadius: 99, background: 'var(--accent)', width: `${Math.round((importProgress.done / importProgress.total) * 100)}%`, transition: 'width .3s' }} />
                </div>
              )}
            </div>
          )}

          {/* STEP: done */}
          {step === 'done' && result && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle size={24} style={{ color: 'var(--green-500)' }} />
                <div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--fg-primary)' }}>Importação concluída</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>{result.total} linhas processadas</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Criados', value: result.created, color: 'var(--green-600)' },
                  { label: 'Atualizados', value: result.updated, color: 'var(--accent)' },
                  { label: 'Erros', value: result.errors, color: result.errors > 0 ? 'var(--red-600)' : 'var(--fg-subtle)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '14px 10px', background: 'var(--bg-subtle)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color }}>{value}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>{label}</p>
                  </div>
                ))}
              </div>
              {result.errorDetails.length > 0 && (
                <div style={{ background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 10, padding: 12 }}>
                  <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--red-700)' }}>Linhas com erro:</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflow: 'auto' }}>
                    {result.errorDetails.map(e => (
                      <p key={e.row} style={{ margin: 0, fontSize: 11, color: 'var(--red-600)', fontFamily: 'monospace' }}>
                        Linha {e.row}: {e.email} — {e.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => { onDone(); onClose(); }}
                  style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Ver leads importados
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── New Lead Modal ───────────────────────────────────────────────────────────

const NEW_LEAD_FIELDS: Array<{ key: keyof NewLeadForm; label: string; required?: boolean }> = [
  { key: 'email',    label: 'Email *', required: true },
  { key: 'name',      label: 'Nome' },
  { key: 'phone',     label: 'Telefone' },
  { key: 'company',   label: 'Empresa' },
  { key: 'jobTitle',  label: 'Cargo' },
  { key: 'city',      label: 'Cidade' },
  { key: 'state',     label: 'Estado' },
  { key: 'tags',      label: 'Tags (separadas por vírgula)' },
  { key: 'source',    label: 'Origem' },
];

type NewLeadForm = {
  email: string; name: string; phone: string; company: string;
  jobTitle: string; city: string; state: string; tags: string; source: string;
};

const EMPTY_NEW_LEAD: NewLeadForm = {
  email: '', name: '', phone: '', company: '', jobTitle: '', city: '', state: '', tags: '', source: '',
};

const NewLeadModal: React.FC<{ onClose: () => void; onDone: () => void }> = ({ onClose, onDone }) => {
  const [form, setForm]       = useState<NewLeadForm>(EMPTY_NEW_LEAD);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  const handleSubmit = async () => {
    if (!isValidEmail) { setError('Informe um email válido.'); return; }
    setSaving(true);
    setError(null);
    try {
      const row: Record<string, string> = {};
      for (const { key } of NEW_LEAD_FIELDS) {
        if (form[key].trim()) row[key] = form[key].trim();
      }
      const res = await DataService.importLeads([row]);
      if (res.errors > 0) {
        setError(res.errorDetails[0]?.error ?? 'Não foi possível salvar o lead.');
        return;
      }
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  };
  const boxStyle: React.CSSProperties = {
    background: 'var(--bg-surface)', borderRadius: 16, border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-md)', width: '100%', maxWidth: 480, maxHeight: '90vh',
    overflow: 'auto', display: 'flex', flexDirection: 'column',
  };
  const headerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0,
  };
  const inputStyle: React.CSSProperties = {
    fontSize: 13, padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-subtle)', color: 'var(--fg-primary)', outline: 'none', width: '100%',
  };

  return ReactDOM.createPortal(
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={boxStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plus size={17} style={{ color: 'var(--accent)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)' }}>Novo Lead</h2>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {NEW_LEAD_FIELDS.map(({ key, label, required }) => (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)' }}>{label}</label>
              <input
                type={key === 'email' ? 'email' : 'text'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={inputStyle}
                autoFocus={key === 'email'}
                required={required}
              />
            </div>
          ))}

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 10 }}>
              <AlertCircle size={15} style={{ color: 'var(--red-500)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--red-600)' }}>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValidEmail || saving}
              style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: (isValidEmail && !saving) ? 'var(--accent)' : 'var(--bg-muted)', color: (isValidEmail && !saving) ? 'white' : 'var(--fg-subtle)', fontSize: 13, fontWeight: 700, cursor: (isValidEmail && !saving) ? 'pointer' : 'not-allowed' }}
            >
              {saving ? 'Salvando...' : 'Salvar lead'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main view ────────────────────────────────────────────────────────────────

const CACHE_KEY = 'lead-hub-result-v1';
const CACHE_TTL = 60_000; // 60s

function readCache(): LeadListResult | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: LeadListResult; ts: number };
    if (Date.now() - ts > CACHE_TTL) return null;
    return data;
  } catch { return null; }
}

function writeCache(data: LeadListResult) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

const LeadHubView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeView, setActiveView] = useState<'leads' | 'webhooks' | 'segments'>('leads');
  const cached = readCache();
  const [result, setResult]         = useState<LeadListResult | null>(cached);
  const [funnel, setFunnel]         = useState<FunnelCounts | null>(null);
  const [loading, setLoading]       = useState(!cached);
  const [loadError, setLoadError]   = useState(false);
  const [search, setSearch]         = useState(searchParams.get('search') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | undefined>(
    (searchParams.get('status') as LeadStatus) || undefined
  );
  const [page, setPage]             = useState(1);
  const [showFieldManager, setShowFieldManager] = useState(false);
  const [showImport, setShowImport]             = useState(false);
  const [showNewLead, setShowNewLead]           = useState(false);
  const [fieldDefs, setFieldDefs] = useState<LeadCustomFieldDef[]>([]);
  const [customFilterField, setCustomFilterField] = useState('');
  const [customFilterValue, setCustomFilterValue] = useState('');
  const [tagFilter, setTagFilter]   = useState(searchParams.get('tag') ?? '');
  const [isHotFilter, setIsHotFilter] = useState(searchParams.get('hot') === '1');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [dateFrom, setDateFrom]     = useState(searchParams.get('from') ?? '');
  const [dateTo, setDateTo]         = useState(searchParams.get('to') ?? '');
  const [conversionSource, setConversionSource] = useState(searchParams.get('source') ?? '');
  const [conversionSources, setConversionSources] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'lastSeenAt' | 'firstSeenAt' | 'conversionsCount' | 'name'>('lastSeenAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, customFilterField, customFilterValue, tagFilter, isHotFilter, dateFrom, dateTo, conversionSource, sortBy, sortDir]);

  useEffect(() => {
    DataService.listCustomFieldDefs()
      .then(defs => setFieldDefs(defs.filter(def => def.visible)))
      .catch(err => console.error('Erro ao carregar campos customizados:', err));
  }, [showFieldManager]);

  useEffect(() => {
    DataService.getAllLeadTags().then(setAvailableTags).catch(() => {});
    DataService.getConversionSources().then(setConversionSources).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const isDefaultQuery = !debouncedSearch && !statusFilter && !isHotFilter && !tagFilter &&
        !customFilterField && !dateFrom && !dateTo && !conversionSource && page === 1 &&
        sortBy === 'lastSeenAt' && sortDir === 'desc';

      const [listRes, funnelRes] = await Promise.all([
        DataService.listLeads({
          search: debouncedSearch || undefined,
          status: statusFilter,
          isHot: isHotFilter || undefined,
          tag: tagFilter || undefined,
          customField: customFilterField || undefined,
          customValue: customFilterValue || undefined,
          startDate: dateFrom || undefined,
          endDate: dateTo || undefined,
          conversionSource: conversionSource || undefined,
          orderBy: sortBy,
          orderDir: sortDir,
          page,
          pageSize: 25,
        }),
        DataService.getFunnelCounts().catch(err => {
          console.warn('Lead hub funnel counts load skipped:', err);
          return null;
        }),
      ]);
      setResult(listRes);
      if (isDefaultQuery) writeCache(listRes);
      if (funnelRes) setFunnel(funnelRes);
    } catch (err) {
      console.error('Erro ao carregar leads:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, isHotFilter, tagFilter, customFilterField, customFilterValue, dateFrom, dateTo, conversionSource, sortBy, sortDir, page]);

  useEffect(() => { load(); }, [load]);

  const handleStatusFilter = useCallback((status: LeadStatus | undefined) => setStatusFilter(status), []);
  const openLead = useCallback((id: string) => {
    navigate(`/leads/${encodeURIComponent(id)}`);
  }, [navigate]);

  const formatDate = (iso: string | null): string => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const leads = result?.leads ?? [];
  const selectedCustomFilter = fieldDefs.find(def => def.name === customFilterField);

  const btnStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
    borderRadius: 'var(--r-md)', border: '1px solid var(--border)',
    fontSize: 12, color: 'var(--fg-muted)', background: 'transparent', cursor: 'pointer', transition: 'all .15s',
  };

  return (
    <>
    <div style={{ padding: '24px 28px 64px', maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-fade-in-up">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Banco de Leads</h1>
          <p style={{ fontSize: 13, color: 'var(--fg-muted)', marginTop: 4, marginBottom: 0 }}>Perfis unificados de todos os contatos e clientes.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={() => setShowFieldManager(true)} style={btnStyle} title="Gerenciar campos personalizados">
            <Settings2 size={13} /> Campos
          </button>
          <button type="button" onClick={() => setShowNewLead(true)} style={btnStyle} title="Adicionar um lead manualmente">
            <Plus size={13} /> Novo Lead
          </button>
          <button type="button" onClick={() => setShowImport(true)} style={btnStyle} title="Importar leads via CSV">
            <Upload size={13} /> Importar
          </button>
          <button type="button" onClick={() => DataService.exportLeadsCsv({ status: statusFilter, search: debouncedSearch, customField: customFilterField, customValue: customFilterValue, startDate: dateFrom || undefined, endDate: dateTo || undefined })} style={btnStyle} title="Exportar CSV">
            <Download size={13} /> Exportar
          </button>
          <button type="button" onClick={load} disabled={loading} style={{ ...btnStyle, padding: 8 }} aria-label="Recarregar">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'leads',    label: 'Leads' },
          { id: 'segments', label: 'Segmentos' },
          { id: 'webhooks', label: 'Webhooks de entrada' },
        ].map(item => {
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id as 'leads' | 'webhooks' | 'segments')}
              style={{
                padding: '9px 12px',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color: active ? 'var(--accent)' : 'var(--fg-muted)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {activeView === 'webhooks' ? (
        <LeadWebhooksPanel />
      ) : activeView === 'segments' ? (
        <SegmentView />
      ) : (
      <>
      {/* Funnel bar */}
      {funnel
        ? <FunnelBar counts={funnel} activeStatus={statusFilter} onFilter={handleStatusFilter} />
        : <div className="ds-card animate-pulse" style={{ height: 96 }} />
      }

      {/* Search & filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, email, empresa..."
            style={{ width: '100%', paddingLeft: 36, paddingRight: 12, paddingTop: 8, paddingBottom: 8, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: 13, color: 'var(--fg-primary)', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Date range filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            title="Data inicial (chegada do lead)"
            style={{ padding: '7px 10px', background: 'var(--bg-surface)', border: `1px solid ${dateFrom ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', fontSize: 12, color: dateFrom ? 'var(--fg-primary)' : 'var(--fg-muted)', outline: 'none', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>–</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            title="Data final (chegada do lead)"
            style={{ padding: '7px 10px', background: 'var(--bg-surface)', border: `1px solid ${dateTo ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', fontSize: 12, color: dateTo ? 'var(--fg-primary)' : 'var(--fg-muted)', outline: 'none', cursor: 'pointer' }}
          />
          {(dateFrom || dateTo) && (
            <button type="button" onClick={() => { setDateFrom(''); setDateTo(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', padding: 4, display: 'flex' }} title="Limpar datas">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Tag filter */}
        {availableTags.length > 0 && (
          <div style={{ border: `1px solid ${tagFilter ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', padding: '2px 8px', minHeight: 36, display: 'flex', alignItems: 'center', minWidth: 160 }}>
            <CustomSelect
              value={tagFilter}
              placeholder="Tag"
              options={[{ value: '', label: 'Todas as tags' }, ...availableTags.map(t => ({ value: t, label: t }))]}
              onChange={setTagFilter}
            />
          </div>
        )}

        {/* Conversion source filter */}
        {conversionSources.length > 0 && (
          <div style={{ border: `1px solid ${conversionSource ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', padding: '2px 8px', minHeight: 36, display: 'flex', alignItems: 'center', minWidth: 180 }}>
            <CustomSelect
              value={conversionSource}
              placeholder="Conversão"
              options={[{ value: '', label: 'Todas as conversões' }, ...conversionSources.map(s => ({ value: s, label: s }))]}
              onChange={setConversionSource}
            />
          </div>
        )}

        {/* isHot filter */}
        <button
          type="button"
          onClick={() => setIsHotFilter(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: `1px solid ${isHotFilter ? '#fb923c' : 'var(--border)'}`, background: isHotFilter ? 'rgba(251,146,60,0.1)' : 'transparent', color: isHotFilter ? '#fb923c' : 'var(--fg-muted)', fontSize: 12, fontWeight: isHotFilter ? 700 : 400, cursor: 'pointer' }}
          title="Filtrar leads quentes"
        >
          <Flame size={13} /> Quentes
        </button>

        {(statusFilter || tagFilter || isHotFilter || conversionSource) && (
          <button type="button" onClick={() => { setStatusFilter(undefined); setTagFilter(''); setIsHotFilter(false); setConversionSource(''); }} style={btnStyle}>
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="ds-table-wrap" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="ds-table">
            <thead>
              <tr>
                <th>
                  <button type="button" onClick={() => { if (sortBy === 'name') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('name'); setSortDir('asc'); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: sortBy === 'name' ? 'var(--accent)' : 'inherit', fontWeight: 'inherit', fontSize: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', padding: 0 }}>
                    Contato {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>Empresa</th>
                <th>Status</th>
                <th>Origem</th>
                <th className="num">
                  <button type="button" onClick={() => { if (sortBy === 'conversionsCount') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('conversionsCount'); setSortDir('desc'); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: sortBy === 'conversionsCount' ? 'var(--accent)' : 'inherit', fontWeight: 'inherit', fontSize: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', padding: 0, marginLeft: 'auto' }}>
                    Conversões {sortBy === 'conversionsCount' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => { if (sortBy === 'lastSeenAt') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortBy('lastSeenAt'); setSortDir('desc'); } }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: sortBy === 'lastSeenAt' ? 'var(--accent)' : 'inherit', fontWeight: 'inherit', fontSize: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit', padding: 0 }}>
                    Conversão {sortBy === 'lastSeenAt' ? (sortDir === 'asc' ? '↑' : '↓') : '↓'}
                  </button>
                </th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div style={{ height: 14, background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" /></td>
                    ))}
                  </tr>
                ))
              ) : loadError ? (
                <tr>
                  <td colSpan={7} style={{ padding: '64px 16px', textAlign: 'center' }}>
                    <AlertCircle size={28} style={{ margin: '0 auto 10px', color: '#ef4444', display: 'block' }} />
                    <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '0 0 12px' }}>Erro ao carregar leads</p>
                    <button onClick={load} style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <RotateCw size={13}/> Tentar novamente
                    </button>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '64px 16px', textAlign: 'center' }}>
                    <Users size={28} style={{ margin: '0 auto 10px', color: 'var(--fg-subtle)', display: 'block' }} />
                    <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0 }}>Nenhum lead encontrado</p>
                    {(search || statusFilter) && (
                      <p style={{ fontSize: 12, color: 'var(--fg-subtle)', marginTop: 4 }}>Tente ajustar os filtros</p>
                    )}
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <LeadRow key={lead.id} lead={lead} formatDate={formatDate} onOpen={() => openLead(lead.id)} />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {result && result.totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              {((page - 1) * 25) + 1}–{Math.min(page * 25, result.total)} de {result.total.toLocaleString('pt-BR')}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: 6, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'transparent', cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
                <ChevronLeft size={14} />
              </button>
              <button type="button" onClick={() => setPage(p => Math.min(result.totalPages, p + 1))} disabled={page === result.totalPages}
                style={{ padding: 6, borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'transparent', cursor: 'pointer', opacity: page === result.totalPages ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

    </div>

    {/* Profile panel — fora do div animado para position:fixed funcionar no viewport */}
    {showFieldManager && (
      <CustomFieldManager onClose={() => setShowFieldManager(false)} />
    )}
    {showImport && (
      <CsvImportModal onClose={() => setShowImport(false)} onDone={load} />
    )}
    {showNewLead && (
      <NewLeadModal onClose={() => setShowNewLead(false)} onDone={load} />
    )}

    </>
  );
};

// ─── Lead table row ───────────────────────────────────────────────────────────

const FIELD_TYPES: Array<{ value: LeadCustomFieldDef['fieldType']; label: string }> = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Numero' },
  { value: 'boolean', label: 'Sim/Nao' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Selecao' },
  { value: 'url', label: 'URL' },
];

const slugFieldName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const WEBHOOK_TYPES = [
  { value: 'rich_content', label: 'Conteudo rico' },
  { value: 'tool', label: 'Ferramenta' },
  { value: 'diagnostic', label: 'Diagnostico' },
  { value: 'contact_form', label: 'Formulario de contato' },
  { value: 'event', label: 'Evento' },
  { value: 'external', label: 'Integracao externa' },
  { value: 'other', label: 'Outro' },
];

const WEBHOOK_HEALTH: Record<LeadWebhookSource['healthStatus'], { label: string; color: string; helper: string }> = {
  ready: { label: 'Pronto', color: 'var(--green-500)', helper: 'Recebendo e processando leads.' },
  waiting_test: { label: 'Aguardando teste', color: 'var(--yellow-500)', helper: 'Envie um POST para detectar campos.' },
  needs_mapping: { label: 'Precisa mapear', color: 'var(--yellow-600)', helper: 'Mapeie os campos recebidos.' },
  missing_email_mapping: { label: 'Falta email', color: 'var(--red-500)', helper: 'Mapeie o campo de email do lead.' },
  error: { label: 'Com erro', color: 'var(--red-500)', helper: 'Veja o ultimo log de erro.' },
  inactive: { label: 'Inativo', color: 'var(--fg-subtle)', helper: 'Webhook desativado.' },
};

const RULE_FIELDS = [
  { value: 'lead.jobTitle', label: 'Cargo' },
  { value: 'lead.company', label: 'Empresa' },
  { value: 'lead.name', label: 'Nome' },
  { value: 'lead.email', label: 'Email' },
  { value: 'customFields.principal_desafio', label: 'Principal desafio' },
  { value: 'customFields.segmento', label: 'Segmento' },
  { value: 'score', label: 'Score' },
  { value: 'tags', label: 'Tags' },
];

const RULE_OPERATORS: Array<{ value: LeadRuleCondition['operator']; label: string }> = [
  { value: 'contains_any', label: 'contem qualquer um' },
  { value: 'contains', label: 'contem' },
  { value: 'equals', label: 'igual a' },
  { value: 'filled', label: 'esta preenchido' },
  { value: 'tag_exists', label: 'tag existe' },
  { value: 'score_gt', label: 'score maior que' },
];

const RULE_ACTIONS: Array<{ value: LeadRuleAction['type']; label: string }> = [
  { value: 'add_tag', label: 'Adicionar tag' },
  { value: 'remove_tag', label: 'Remover tag' },
  { value: 'add_score', label: 'Somar score' },
  { value: 'set_custom_field', label: 'Atualizar campo personalizado' },
  { value: 'set_status', label: 'Alterar status' },
  { value: 'rd_create_conversion', label: 'Criar conversao no RD Station' },
];

const INTERNAL_ACTIONS_LIST = [
  { value: 'add_tag',           label: 'Adicionar tag',                 group: 'Tags' },
  { value: 'remove_tag',        label: 'Remover tag',                   group: 'Tags' },
  { value: 'add_score',         label: 'Somar score',                   group: 'Pontuação' },
  { value: 'set_status',        label: 'Mudar status',                  group: 'Status' },
  { value: 'set_custom_field',  label: 'Atualizar campo personalizado', group: 'Campos' },
  { value: 'set_persona',       label: 'Definir persona',               group: 'Classificação' },
  { value: 'set_pain',          label: 'Definir dor',                   group: 'Classificação' },
  { value: 'move_funnel_stage', label: 'Mover etapa do funil',          group: 'Funil' },
];

const EXTERNAL_ACTIONS_LIST = [
  { value: 'rd_create_conversion',  label: 'Criar conversão no RD Station',  group: 'CRM & Marketing' },
  { value: 'pipedrive_create_deal', label: 'Criar negócio no Pipedrive',      group: 'CRM & Marketing' },
  { value: 'whatsapp_flow',         label: 'Enviar para fluxo de WhatsApp',   group: 'Comunicação' },
  { value: 'notify_team',           label: 'Notificar time interno',          group: 'Comunicação' },
  { value: 'send_meta_event',       label: 'Enviar evento para Meta/Google',  group: 'Mídia Paga' },
];

const EXTERNAL_TYPE_SET = new Set(EXTERNAL_ACTIONS_LIST.map(a => a.value));
const COMING_SOON_ACTIONS = new Set(['whatsapp_flow', 'notify_team', 'send_meta_event']);

// ─── Pipedrive field definitions ─────────────────────────────────────────────

type PipedriveFieldType = 'varchar' | 'text' | 'monetary' | 'enum' | 'set';
type PipedriveFieldDef = { key: string; label: string; type: PipedriveFieldType; options?: Array<{ id: number; label: string }> };

const PIPEDRIVE_DEAL_FIELDS: PipedriveFieldDef[] = [
  { key: 'title',  label: 'Título do negócio',   type: 'varchar' },
  { key: 'value',  label: 'Valor do negócio',     type: 'monetary' },
  { key: '9459f9b49acca8552e69c0ee0898f751b05b4fe6', label: 'Canal Origem', type: 'enum', options: [
    { id: 66, label: 'Inbound' }, { id: 67, label: 'Indicação Parceiro' }, { id: 68, label: 'Eventos' },
    { id: 69, label: 'Outbound' }, { id: 70, label: 'Indicação Cliente' }, { id: 96, label: 'Espontânea do Cliente' },
    { id: 139, label: 'Time Cuidar (Venda CS)' }, { id: 145, label: 'Direção' },
  ]},
  { key: '973cdb7b69d83ee7dafb4d5e433bb02e4fa33820', label: 'Detalhamento MKT', type: 'enum', options: [
    { id: 75, label: 'Mídia Paga' }, { id: 76, label: 'Inbound Marketing' }, { id: 77, label: 'Eventos e Ativações' },
    { id: 78, label: 'Campanhas Institucionais' }, { id: 79, label: 'Base Ativa' }, { id: 80, label: 'Tráfego Espontâneo' },
  ]},
  { key: 'cfd4bf93806bfadbb695db78bd807bb9cb26662c', label: 'Referência da Origem', type: 'varchar' },
  { key: '2d1b008a20ba8918943ebef88ed0a9f44a269133', label: 'Qualificador', type: 'enum', options: [
    { id: 49, label: 'Aline Dantas' }, { id: 65, label: 'Pedro Paiva' }, { id: 53, label: 'Tiago Fernandes' },
    { id: 52, label: 'Cléssia Lima' }, { id: 119, label: 'Darlan Barros' }, { id: 175, label: 'Samuel Idalino' },
    { id: 178, label: 'Angelina Rodrigues' }, { id: 179, label: 'Marco Veppo' }, { id: 180, label: 'Luis Antonio' },
    { id: 181, label: 'Mayara Machado' }, { id: 182, label: 'Jonathan Rodrigues' }, { id: 183, label: 'Rebeca Nogueira' },
    { id: 202, label: 'Deogenes Brito' }, { id: 216, label: 'Beatriz Diniz' },
  ]},
  { key: 'd0c46ae25c4019c285fbcecdf6a36f12f3aefcc0', label: 'Vendedor', type: 'enum', options: [
    { id: 81, label: 'Aline Dantas' }, { id: 84, label: 'Mikaely Dias' }, { id: 85, label: 'Pedro Paiva' },
    { id: 86, label: 'Tiago Fernandes' }, { id: 117, label: 'Darlan Barros' }, { id: 141, label: 'Time Cuidar' },
    { id: 148, label: 'Luis Antonio' }, { id: 149, label: 'Angelina Rodrigues' }, { id: 150, label: 'Iluama Cavalcanti' },
    { id: 151, label: 'Marco Veppo' }, { id: 152, label: 'Mayara Machado' }, { id: 197, label: 'Deogenes Brito' },
    { id: 203, label: 'Jonathan Rodrigues' }, { id: 204, label: 'Rebeca Nogueira' },
  ]},
  { key: '1d44a1c1a505d689fa71d5e06b7f813f6a7dffff', label: 'Produto da Venda', type: 'set', options: [
    { id: 97, label: 'Showroom Digital' }, { id: 98, label: 'Landing Page' }, { id: 99, label: 'Portal de Grupo' },
    { id: 100, label: 'Portal de Consórcio' }, { id: 101, label: 'Portal de Assinatura' }, { id: 102, label: 'Portal de Seminovos' },
    { id: 103, label: 'Autopilot' }, { id: 104, label: 'Autobot' }, { id: 105, label: 'NitroAds' },
    { id: 106, label: 'CRM Autopilot' }, { id: 107, label: 'IA Autopilot' }, { id: 108, label: 'Campanha Autopilot' },
    { id: 109, label: 'Automação Autopilot' }, { id: 154, label: '360' }, { id: 155, label: 'Portal de Blindagem' },
    { id: 156, label: 'Showroom 2.0' }, { id: 194, label: 'Setup' },
  ]},
  { key: '4a5f006a09009d88b1eedfe13222b267c1507f8a', label: 'Valor de setup', type: 'monetary' },
];

const LEAD_SOURCE_FIELDS = [
  { key: 'name',            label: 'Nome' },
  { key: 'email',           label: 'E-mail' },
  { key: 'phone',           label: 'Telefone' },
  { key: 'company',         label: 'Empresa' },
  { key: 'jobTitle',        label: 'Cargo' },
  { key: 'firstSource',     label: 'UTM Source' },
  { key: 'firstMedium',     label: 'UTM Medium' },
  { key: 'firstCampaign',   label: 'Campanha UTM' },
  { key: 'firstLandingPage',label: 'Landing Page' },
  { key: 'score',           label: 'Score' },
  { key: 'notes',           label: 'Observações' },
  { key: 'city',            label: 'Cidade' },
  { key: 'state',           label: 'Estado' },
];

type PipedriveMapping = { fieldKey: string; sourceType: 'skip' | 'lead_field' | 'fixed'; leadField: string; fixedValue: string };

const NOTE_VARIABLES = [
  { label: 'Nome',         token: '{nome}' },
  { label: 'Empresa',      token: '{empresa}' },
  { label: 'E-mail',       token: '{email}' },
  { label: 'Telefone',     token: '{telefone}' },
  { label: 'Cargo',        token: '{cargo}' },
  { label: 'UTM Source',   token: '{origem}' },
  { label: 'Campanha',     token: '{campanha}' },
  { label: 'Landing Page', token: '{landing_page}' },
  { label: 'Score',        token: '{score}' },
];

const DEFAULT_PIPEDRIVE_MAPPINGS: PipedriveMapping[] = PIPEDRIVE_DEAL_FIELDS.map(f => {
  if (f.key === 'title')
    return { fieldKey: f.key, sourceType: 'fixed',      leadField: '',              fixedValue: '{nome} — {empresa}' };
  if (f.key === '9459f9b49acca8552e69c0ee0898f751b05b4fe6') // Canal Origem
    return { fieldKey: f.key, sourceType: 'fixed',      leadField: '',              fixedValue: '66' }; // Inbound
  if (f.key === '973cdb7b69d83ee7dafb4d5e433bb02e4fa33820') // Detalhamento MKT
    return { fieldKey: f.key, sourceType: 'lead_field', leadField: 'firstMedium',   fixedValue: '' };
  if (f.key === 'cfd4bf93806bfadbb695db78bd807bb9cb26662c') // Referência da Origem
    return { fieldKey: f.key, sourceType: 'lead_field', leadField: 'firstCampaign', fixedValue: '' };
  return { fieldKey: f.key, sourceType: 'skip', leadField: '', fixedValue: '' };
});

const RD_INCLUDE_OPTIONS: Array<{ value: string; label: string; also?: string[] }> = [
  { value: 'name',         label: 'Nome' },
  { value: 'phone',        label: 'Telefone' },
  { value: 'company',      label: 'Empresa' },
  { value: 'jobTitle',     label: 'Cargo' },
  { value: 'source',       label: 'Fonte / UTM', also: ['campaign', 'landingPage'] },
  { value: 'customFields', label: 'Campos personalizados' },
  { value: 'tags',         label: 'Tags' },
];

const parseList = (value: string) =>
  value.split(/[\n,]/).map(item => item.trim()).filter(Boolean);

const ToggleSwitch: React.FC<{ checked: boolean; onChange: () => void }> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    style={{
      position: 'relative',
      width: 34,
      height: 19,
      borderRadius: 10,
      border: 'none',
      background: checked ? '#22c55e' : 'var(--bg-muted)',
      cursor: 'pointer',
      padding: 0,
      transition: 'background .18s',
      flexShrink: 0,
    }}
  >
    <span
      style={{
        position: 'absolute',
        top: 2,
        left: checked ? 17 : 2,
        width: 15,
        height: 15,
        borderRadius: '50%',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,.25)',
        transition: 'left .18s',
        display: 'block',
        pointerEvents: 'none',
      }}
    />
  </button>
);

// ─── Rule form types ─────────────────────────────────────────────────────────

type ConditionDraft = {
  id: string;
  field: string;
  operator: LeadRuleCondition['operator'];
  chips: string[];
  rawInput: string;
  connector: 'and' | 'or';
};

type ActionDraft = {
  id: string;
  type: string;
  tagKey: string;
  tagValue: string;
  points: number;
  customFieldName: string;
  customFieldValue: string;
  status: LeadStatus;
  rdIdentifier: string;
  rdName: string;
  rdExtraTags: string;
  rdIncludeFields: string[];
  rdCustomFieldMappings: Array<{ sourceField: string; rdField: string }>;
  rdDedupe: boolean;
  persona: string;
  pain: string;
  funnelStage: string;
  whatsappFlow: string;
  pipedrivePipeline: 'novo_cliente' | 'upsell';
  pipedriveFieldMappings: PipedriveMapping[];
  pipedriveNote: string;
  notifyChannel: string;
  notifyMessage: string;
  metaEventName: string;
  metaPixelId: string;
};

const TAG_KEYS = ['persona', 'fluxo', 'interesse', 'origem', 'categoria', 'segmento', 'vertical'];

const EXTENDED_RULE_FIELDS = [
  ...RULE_FIELDS,
  { value: 'lead.emailDomain', label: 'Domínio do e-mail' },
  { value: 'lead.phone', label: 'Telefone' },
  { value: 'lead.city', label: 'Cidade' },
  { value: 'lead.state', label: 'Estado' },
];

const EXTENDED_RULE_OPERATORS: Array<{ value: string; label: string; hasValue: boolean; multiValue: boolean }> = [
  { value: 'contains_any', label: 'contém qualquer um de', hasValue: true,  multiValue: true  },
  { value: 'contains',     label: 'contém',                hasValue: true,  multiValue: false },
  { value: 'equals',       label: 'é igual a',             hasValue: true,  multiValue: false },
  { value: 'ends_with',    label: 'termina com',           hasValue: true,  multiValue: false },
  { value: 'starts_with',  label: 'começa com',            hasValue: true,  multiValue: false },
  { value: 'filled',       label: 'está preenchido',       hasValue: false, multiValue: false },
  { value: 'tag_exists',   label: 'tem a tag',             hasValue: true,  multiValue: false },
  { value: 'score_gt',     label: 'score maior que',       hasValue: true,  multiValue: false },
];

const getOperatorsForField = (field: string) => {
  if (field === 'score') return EXTENDED_RULE_OPERATORS.filter(o => ['score_gt', 'filled'].includes(o.value));
  if (field === 'tags')  return EXTENDED_RULE_OPERATORS.filter(o => ['tag_exists', 'contains_any', 'contains', 'equals', 'filled'].includes(o.value));
  return EXTENDED_RULE_OPERATORS.filter(o => !['tag_exists', 'score_gt'].includes(o.value));
};

const newCondition = (): ConditionDraft => ({
  id: Math.random().toString(36).slice(2),
  field: '',
  operator: 'contains_any',
  chips: [],
  rawInput: '',
  connector: 'and',
});

const newAction = (type = ''): ActionDraft => ({
  id: Math.random().toString(36).slice(2),
  type,
  tagKey: '',
  tagValue: '',
  points: 10,
  customFieldName: '',
  customFieldValue: '',
  status: 'MQL',
  rdIdentifier: '',
  rdName: '',
  rdExtraTags: '',
  rdIncludeFields: ['name', 'phone', 'company', 'jobTitle', 'tags', 'source', 'campaign', 'landingPage'],
  rdCustomFieldMappings: [],
  rdDedupe: true,
  persona: '',
  pain: '',
  funnelStage: '',
  whatsappFlow: '',
  pipedrivePipeline: 'novo_cliente',
  pipedriveFieldMappings: [],
  pipedriveNote: '',
  notifyChannel: '',
  notifyMessage: '',
  metaEventName: '',
  metaPixelId: '',
});

// ─── Tag chip input ───────────────────────────────────────────────────────────

const NoteTemplateEditor: React.FC<{
  value: string;
  onChange: (v: string) => void;
  customFieldDefs?: LeadCustomFieldDef[];
}> = ({ value, onChange, customFieldDefs = [] }) => {
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const insertVar = (token: string) => {
    const el = ref.current;
    if (!el) { onChange(value + token); return; }
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const next  = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const chipStyle: React.CSSProperties = {
    padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border)',
    background: 'var(--bg-muted)', color: 'var(--fg-secondary)',
    fontSize: 11, cursor: 'pointer', fontWeight: 500, transition: 'all .1s',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea
        ref={ref}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Ex: Lead chegou via campanha com score alto. Use os botões abaixo para inserir campos."
        rows={4}
        style={{ padding: '7px 9px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 46 }}>Lead</span>
          {NOTE_VARIABLES.map(v => (
            <button key={v.token} type="button" onClick={() => insertVar(v.token)} style={chipStyle}>{v.label}</button>
          ))}
        </div>
        {customFieldDefs.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: 'var(--fg-subtle)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 46 }}>Custom</span>
            {customFieldDefs.map(cf => (
              <button key={cf.name} type="button" onClick={() => insertVar(`{cf.${cf.name}}`)} style={{ ...chipStyle, borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' }}>
                {cf.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const TagChipInput: React.FC<{
  chips: string[];
  input: string;
  onInputChange: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder?: string;
}> = ({ chips, input, onInputChange, onAdd, onRemove, placeholder }) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      onInputChange('');
    } else if (e.key === 'Backspace' && !input && chips.length > 0) {
      onRemove(chips.length - 1);
    }
  };
  return (
    <div
      style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', minHeight: 36, cursor: 'text' }}
      onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
    >
      {chips.map((chip, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px 2px 6px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--fg-secondary)', fontWeight: 500 }}>
          {chip}
          <button type="button" onClick={ev => { ev.stopPropagation(); onRemove(i); }} style={{ border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', padding: 0, display: 'inline-flex', lineHeight: 1, marginLeft: 2 }}>
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={chips.length === 0 ? (placeholder ?? 'Digite e Enter...') : ''}
        style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: 'var(--fg-primary)', minWidth: 110, flex: 1, padding: '1px 0' }}
      />
    </div>
  );
};

// ─── Tag suggest input (chip input + live tag suggestions dropdown) ───────────

const TagSuggestInput: React.FC<{
  chips: string[];
  input: string;
  suggestions: string[];
  onInputChange: (v: string) => void;
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder?: string;
}> = ({ chips, input, suggestions, onInputChange, onAdd, onRemove, placeholder }) => {
  const [open, setOpen] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = suggestions.filter(
    t => !chips.includes(t) && (!input || t.toLowerCase().includes(input.toLowerCase()))
  );

  const addTag = (tag: string) => { onAdd(tag); onInputChange(''); setOpen(false); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault(); addTag(input.trim());
    } else if (e.key === 'Backspace' && !input && chips.length > 0) {
      onRemove(chips.length - 1);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center', padding: '5px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', minHeight: 36, cursor: 'text' }}
        onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
      >
        {chips.map((chip, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px 2px 6px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--fg-secondary)', fontWeight: 500 }}>
            {chip}
            <button type="button" onClick={ev => { ev.stopPropagation(); onRemove(i); }} style={{ border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', padding: 0, display: 'inline-flex', lineHeight: 1, marginLeft: 2 }}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={e => { onInputChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={chips.length === 0 ? (placeholder ?? 'Selecione ou digite...') : ''}
          style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, color: 'var(--fg-primary)', minWidth: 110, flex: 1, padding: '1px 0' }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 300, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', maxHeight: 240, overflowY: 'auto' }}>
          {filtered.map(tag => (
            <button key={tag} type="button"
              onMouseDown={e => { e.preventDefault(); addTag(tag); }}
              style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'transparent', color: 'var(--fg-primary)', fontSize: 13, cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-muted)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >{tag}</button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Custom select dropdown ──────────────────────────────────────────────────

const CustomSelect: React.FC<{
  value: string;
  placeholder: string;
  options: Array<{ value: string; label: string; group?: string }>;
  onChange: (value: string) => void;
  selectedColor?: string;
}> = ({ value, placeholder, options, onChange, selectedColor = 'var(--accent)' }) => {
  const [open, setOpen] = useState(false);
  const [openUp, setOpenUp] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    if (ref.current) {
      const rect = ref.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenUp(spaceBelow < 340);
    }
    setOpen(v => !v);
  };

  const selected = options.find(o => o.value === value);

  const grouped = options.reduce<Record<string, typeof options>>((acc, opt) => {
    const g = opt.group ?? '';
    if (!acc[g]) acc[g] = [];
    acc[g].push(opt);
    return acc;
  }, {});

  const dropdownPos: React.CSSProperties = openUp
    ? { bottom: 'calc(100% + 8px)', top: 'auto' }
    : { top: 'calc(100% + 8px)', bottom: 'auto' };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, zIndex: open ? 1000 : 'auto' }}>
      <button
        type="button"
        onClick={handleOpen}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: '0 4px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ fontSize: 13, fontWeight: selected ? 700 : 400, color: selected ? selectedColor : 'var(--fg-subtle)', flex: 1 }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={13} style={{ color: 'var(--fg-muted)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{ position: 'absolute', ...dropdownPos, left: -12, zIndex: 1001, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', minWidth: 260, maxHeight: 320, overflowY: 'auto' }}>
          {Object.entries(grouped).map(([group, opts]) => (
            <div key={group}>
              {group && (
                <div style={{ padding: '10px 14px 5px', fontSize: 10, fontWeight: 800, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                  {group}
                </div>
              )}
              {opts.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{ display: 'flex', alignItems: 'center', width: '100%', padding: '9px 16px', border: 'none', background: opt.value === value ? `${selectedColor}14` : 'transparent', color: opt.value === value ? selectedColor : 'var(--fg-primary)', fontSize: 13, fontWeight: opt.value === value ? 600 : 400, cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
                  onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--bg-muted)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = opt.value === value ? `${selectedColor}14` : 'transparent'; }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Action card ─────────────────────────────────────────────────────────────

const actionInputStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
  background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 12, fontWeight: 500,
  outline: 'none', width: '100%',
};

const LabeledField: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--fg-secondary)', ...style }}>
    {label}{children}
  </label>
);

const ActionCard: React.FC<{
  act: ActionDraft;
  actionList: Array<{ value: string; label: string; group?: string }>;
  accentColor: string;
  canDelete: boolean;
  customFieldDefs: LeadCustomFieldDef[];
  onUpdate: (ch: Partial<ActionDraft>) => void;
  onDelete: () => void;
}> = ({ act, actionList, accentColor, canDelete, customFieldDefs, onUpdate, onDelete }) => {
  const iStyle = actionInputStyle;
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: 'var(--bg-muted)', borderBottom: act.type ? '1px solid var(--border)' : 'none', borderLeft: `3px solid ${accentColor}`, borderRadius: act.type ? '8px 8px 0 0' : 8 }}>
        <CustomSelect
          value={act.type}
          placeholder="Selecione uma ação..."
          options={actionList}
          onChange={type => onUpdate({ type })}
          selectedColor={accentColor}
        />
        {canDelete && (
          <button type="button" onClick={onDelete} style={{ border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', padding: 4, display: 'flex', flexShrink: 0 }}>
            <X size={14} />
          </button>
        )}
      </div>
      <div style={{ padding: 14 }}>
        {(act.type === 'add_tag' || act.type === 'remove_tag') && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <LabeledField label="Chave">
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', padding: '2px 6px', minHeight: 34, display: 'flex', alignItems: 'center' }}>
                <CustomSelect
                  value={act.tagKey}
                  placeholder="Selecionar campo"
                  options={TAG_KEYS.map(k => ({ value: k, label: k }))}
                  onChange={tagKey => onUpdate({ tagKey })}
                />
              </div>
            </LabeledField>
            <LabeledField label="Valor">
              <input value={act.tagValue} onChange={e => onUpdate({ tagValue: e.target.value })} placeholder="ex: decisor" style={iStyle} />
            </LabeledField>
          </div>
        )}
        {act.type === 'add_score' && (
          <LabeledField label="Pontos a somar" style={{ maxWidth: 150 }}>
            <input type="number" value={act.points} onChange={e => onUpdate({ points: Number(e.target.value) || 0 })} style={iStyle} />
          </LabeledField>
        )}
        {act.type === 'set_status' && (
          <LabeledField label="Novo status" style={{ maxWidth: 220 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', padding: '2px 6px', minHeight: 34, display: 'flex', alignItems: 'center' }}>
              <CustomSelect
                value={act.status}
                placeholder="Selecionar status"
                options={STATUSES.map(s => ({ value: s.value, label: s.label }))}
                onChange={status => onUpdate({ status: status as LeadStatus })}
                selectedColor={accentColor}
              />
            </div>
          </LabeledField>
        )}
        {act.type === 'set_custom_field' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <LabeledField label="Nome do campo">
              <input value={act.customFieldName} onChange={e => onUpdate({ customFieldName: e.target.value })} placeholder="ex: icp_score" style={iStyle} />
            </LabeledField>
            <LabeledField label="Valor">
              <input value={act.customFieldValue} onChange={e => onUpdate({ customFieldValue: e.target.value })} placeholder="ex: alto" style={iStyle} />
            </LabeledField>
          </div>
        )}
        {act.type === 'set_persona' && (
          <LabeledField label="Persona" style={{ maxWidth: 300 }}>
            <input value={act.persona} onChange={e => onUpdate({ persona: e.target.value })} placeholder="ex: Decisor C-Level" style={iStyle} />
          </LabeledField>
        )}
        {act.type === 'set_pain' && (
          <LabeledField label="Dor identificada" style={{ maxWidth: 300 }}>
            <input value={act.pain} onChange={e => onUpdate({ pain: e.target.value })} placeholder="ex: Custo alto" style={iStyle} />
          </LabeledField>
        )}
        {act.type === 'move_funnel_stage' && (
          <LabeledField label="Etapa destino" style={{ maxWidth: 300 }}>
            <input value={act.funnelStage} onChange={e => onUpdate({ funnelStage: e.target.value })} placeholder="ex: Consideração" style={iStyle} />
          </LabeledField>
        )}
        {act.type === 'rd_create_conversion' && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <LabeledField label="Identificador *">
                <input value={act.rdIdentifier} onChange={e => onUpdate({ rdIdentifier: e.target.value })} placeholder="ex: interesse_decisor" style={iStyle} />
              </LabeledField>
              <LabeledField label="Nome da conversão *">
                <input value={act.rdName} onChange={e => onUpdate({ rdName: e.target.value })} placeholder="ex: Lead Qualificado" style={iStyle} />
              </LabeledField>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Dados a incluir no RD</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {RD_INCLUDE_OPTIONS.map(opt => {
                  const checked = act.rdIncludeFields.includes(opt.value);
                  return (
                    <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: 'var(--fg-secondary)', fontWeight: 500, userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const extras = opt.also ?? [];
                          const fields = e.target.checked
                            ? [...new Set([...act.rdIncludeFields, opt.value, ...extras])]
                            : act.rdIncludeFields.filter(f => f !== opt.value && !extras.includes(f));
                          onUpdate({ rdIncludeFields: fields });
                        }}
                        style={{ width: 14, height: 14, accentColor: '#8b5cf6', cursor: 'pointer' }}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
              {act.rdIncludeFields.includes('customFields') && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Mapeamento de campos personalizados</div>
                  {act.rdCustomFieldMappings.map((mapping, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 16px 1fr 28px', alignItems: 'center', gap: 6 }}>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', padding: '2px 6px', minHeight: 32, display: 'flex', alignItems: 'center' }}>
                        <CustomSelect
                          value={mapping.sourceField}
                          placeholder="Campo AutoForce"
                          options={customFieldDefs.map(f => ({ value: f.name, label: f.label }))}
                          onChange={sourceField => {
                            const updated = act.rdCustomFieldMappings.map((m, i) => i === idx ? { ...m, sourceField } : m);
                            onUpdate({ rdCustomFieldMappings: updated });
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'center' }}>→</span>
                      <input
                        value={mapping.rdField}
                        onChange={e => {
                          const updated = act.rdCustomFieldMappings.map((m, i) => i === idx ? { ...m, rdField: e.target.value } : m);
                          onUpdate({ rdCustomFieldMappings: updated });
                        }}
                        placeholder="Campo no RD Station (ex: CF_segmento)"
                        style={iStyle}
                      />
                      <button type="button" onClick={() => onUpdate({ rdCustomFieldMappings: act.rdCustomFieldMappings.filter((_, i) => i !== idx) })}
                        style={{ border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', padding: 4, display: 'flex', justifyContent: 'center' }}>
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  <button type="button"
                    onClick={() => onUpdate({ rdCustomFieldMappings: [...act.rdCustomFieldMappings, { sourceField: '', rdField: '' }] })}
                    style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer' }}>
                    <Plus size={11} /> Adicionar campo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {act.type === 'pipedrive_create_deal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Pipeline */}
            <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', maxWidth: 220 }}>
              Pipeline
              <select
                value={act.pipedrivePipeline}
                onChange={e => onUpdate({ pipedrivePipeline: e.target.value as 'novo_cliente' | 'upsell' })}
                style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 12, outline: 'none' }}
              >
                <option value="novo_cliente">Novo Cliente (etapa inicial: MQL)</option>
                <option value="upsell">Upsell (etapa inicial: SQL)</option>
              </select>
            </label>

            {/* Field mapping table */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 130px 1fr', gap: 0, background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', padding: '6px 10px' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Campo no Pipedrive</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Origem</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Valor</span>
              </div>
              {(act.pipedriveFieldMappings.length === 0 ? DEFAULT_PIPEDRIVE_MAPPINGS : act.pipedriveFieldMappings).map((mapping, idx) => {
                const fieldDef = PIPEDRIVE_DEAL_FIELDS.find(f => f.key === mapping.fieldKey);
                if (!fieldDef) return null;
                const updateMapping = (patch: Partial<PipedriveMapping>) => {
                  const mappings = act.pipedriveFieldMappings.length === 0 ? DEFAULT_PIPEDRIVE_MAPPINGS : act.pipedriveFieldMappings;
                  onUpdate({ pipedriveFieldMappings: mappings.map((m, i) => i === idx ? { ...m, ...patch } : m) });
                };
                const ss: React.CSSProperties = { padding: '5px 6px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 11, outline: 'none', width: '100%' };
                return (
                  <div key={mapping.fieldKey} style={{ display: 'grid', gridTemplateColumns: '160px 130px 1fr', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)', alignItems: 'center', background: idx % 2 === 0 ? 'transparent' : 'var(--bg-muted)' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-secondary)' }}>{fieldDef.label}</span>
                    <select value={mapping.sourceType} onChange={e => updateMapping({ sourceType: e.target.value as PipedriveMapping['sourceType'], leadField: '', fixedValue: '' })} style={ss}>
                      <option value="skip">— não preencher</option>
                      <option value="lead_field">Campo do lead</option>
                      <option value="fixed">Valor fixo</option>
                    </select>
                    <div>
                      {mapping.sourceType === 'lead_field' && (
                        <select value={mapping.leadField} onChange={e => updateMapping({ leadField: e.target.value })} style={ss}>
                          <option value="">Selecione...</option>
                          {LEAD_SOURCE_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                        </select>
                      )}
                      {mapping.sourceType === 'fixed' && (fieldDef.type === 'enum' || fieldDef.type === 'set') && fieldDef.options && (
                        fieldDef.type === 'set' ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {fieldDef.options.map(opt => {
                              const selected = mapping.fixedValue.split(',').includes(String(opt.id));
                              return (
                                <button key={opt.id} type="button" onClick={() => {
                                  const ids = mapping.fixedValue.split(',').filter(Boolean);
                                  const next = selected ? ids.filter(i => i !== String(opt.id)) : [...ids, String(opt.id)];
                                  updateMapping({ fixedValue: next.join(',') });
                                }} style={{ padding: '2px 8px', borderRadius: 4, border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`, background: selected ? 'var(--accent-soft)' : 'transparent', color: selected ? 'var(--accent)' : 'var(--fg-muted)', fontSize: 11, cursor: 'pointer', fontWeight: selected ? 700 : 400 }}>
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <select value={mapping.fixedValue} onChange={e => updateMapping({ fixedValue: e.target.value })} style={ss}>
                            <option value="">Selecione...</option>
                            {fieldDef.options.map(opt => <option key={opt.id} value={String(opt.id)}>{opt.label}</option>)}
                          </select>
                        )
                      )}
                      {mapping.sourceType === 'fixed' && (fieldDef.type === 'varchar' || fieldDef.type === 'text') && (
                        <input value={mapping.fixedValue} onChange={e => updateMapping({ fixedValue: e.target.value })}
                          placeholder={fieldDef.key === 'title' ? '{nome} — {empresa}' : 'Valor fixo'}
                          style={ss} />
                      )}
                      {mapping.sourceType === 'fixed' && fieldDef.type === 'monetary' && (
                        <input type="number" value={mapping.fixedValue} onChange={e => updateMapping({ fixedValue: e.target.value })}
                          placeholder="0,00" style={ss} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Note template */}
            <div style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Nota no negócio (opcional)</span>
              <NoteTemplateEditor value={act.pipedriveNote} onChange={v => onUpdate({ pipedriveNote: v })} customFieldDefs={customFieldDefs} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--fg-subtle)', margin: 0 }}>
              Automático: nome, e-mail, telefone, empresa e cargo → Pessoa · organização criada pelo nome da empresa
            </p>
          </div>
        )}
        {COMING_SOON_ACTIONS.has(act.type) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 6, background: 'var(--bg-muted)', border: '1px dashed var(--border)' }}>
            <span style={{ fontSize: 16 }}>🔜</span>
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Em breve</span>
              <span style={{ fontSize: 12, color: 'var(--fg-subtle)', marginLeft: 6 }}>Esta integração estará disponível em breve.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Rule form page (inline, no modal/portal) ────────────────────────────────

const RuleFormPage: React.FC<{
  editingRule: LeadClassificationRule | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editingRule, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditions, setConditions] = useState<ConditionDraft[]>([newCondition()]);
  const [internalActions, setInternalActions] = useState<ActionDraft[]>([]);
  const [externalActions, setExternalActions] = useState<ActionDraft[]>([]);
  const [activationMode, setActivationMode] = useState<'future' | 'existing'>('future');
  const [priority, setPriority] = useState(50);
  const [saving, setSaving] = useState(false);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<LeadCustomFieldDef[]>([]);

  useEffect(() => {
    DataService.getAllLeadTags().then(setAvailableTags).catch(() => {});
    DataService.listCustomFieldDefs().then(setCustomFieldDefs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editingRule) return;
    setName(editingRule.name);
    setDescription(editingRule.description ?? '');
    setPriority(editingRule.priority ?? 50);
    if (editingRule.conditions.length > 0) {
      setConditions(editingRule.conditions.map((c, i) => ({
        id: String(i + 1),
        field: c.field,
        operator: c.operator,
        chips: c.values ?? (c.value ? [c.value] : []),
        rawInput: '',
        connector: c.connector ?? 'and',
      })));
    }
    if (editingRule.actions.length > 0) {
      const all = editingRule.actions.map((a, i) => {
        const act = a as any;
        const d = newAction(a.type);
        d.id = String(i + 1);
        if (a.type === 'add_tag' || a.type === 'remove_tag') {
          const parts = (act.value ?? '').split(':');
          d.tagKey = parts[0] ?? '';
          d.tagValue = parts.slice(1).join(':');
        } else if (a.type === 'add_score') {
          d.points = act.points ?? 10;
        } else if (a.type === 'set_status') {
          d.status = act.status ?? 'MQL';
        } else if (a.type === 'set_custom_field') {
          d.customFieldName = act.field ?? '';
          d.customFieldValue = act.value ?? '';
        } else if (a.type === 'rd_create_conversion') {
          d.rdIdentifier = act.conversionIdentifier ?? '';
          d.rdName = act.conversionName ?? '';
        } else if (a.type === 'pipedrive_create_deal') {
          d.pipedrivePipeline = act.pipeline ?? 'novo_cliente';
          const saved: PipedriveMapping[] = Array.isArray(act.fieldMappings) ? act.fieldMappings : [];
          d.pipedriveFieldMappings = DEFAULT_PIPEDRIVE_MAPPINGS.map(def => saved.find(s => s.fieldKey === def.fieldKey) ?? def);
          d.pipedriveNote = act.note ?? '';
        }
        return d;
      });
      const internal = all.filter(a => !EXTERNAL_TYPE_SET.has(a.type));
      const external = all.filter(a => EXTERNAL_TYPE_SET.has(a.type));
      setInternalActions(internal);
      setExternalActions(external);
    }
  }, [editingRule]);

  const updateCond = (id: string, ch: Partial<ConditionDraft>) =>
    setConditions(prev => prev.map(c => c.id === id ? { ...c, ...ch } : c));
  const addChip = (id: string, v: string) =>
    setConditions(prev => prev.map(c => c.id === id ? { ...c, chips: [...c.chips, v] } : c));
  const removeChip = (id: string, i: number) =>
    setConditions(prev => prev.map(c => c.id === id ? { ...c, chips: c.chips.filter((_, j) => j !== i) } : c));

  const buildConditions = (): LeadRuleCondition[] =>
    conditions.filter(c => c.field !== '' && (c.chips.length > 0 || c.operator === 'filled')).map(c => {
      if (c.operator === 'filled') return { field: c.field, operator: c.operator };
      if (c.operator === 'contains_any') return { field: c.field, operator: c.operator, values: c.chips };
      if (c.operator === 'score_gt') return { field: 'score', operator: c.operator, value: c.chips[0] ?? '0' };
      return { field: c.field, operator: c.operator as LeadRuleCondition['operator'], value: c.chips[0] ?? '' };
    }).map((condition, index) => ({
      ...condition,
      connector: index === 0 ? 'and' : conditions[index].connector,
    }));

  const buildActions = (): LeadRuleAction[] =>
    [...internalActions, ...externalActions].filter(a => a.type !== '' && !COMING_SOON_ACTIONS.has(a.type)).map(a => {
      if (a.type === 'add_tag' || a.type === 'remove_tag')
        return { type: a.type as LeadRuleAction['type'], value: a.tagKey ? `${a.tagKey}:${a.tagValue}` : a.tagValue };
      if (a.type === 'add_score') return { type: 'add_score', points: a.points };
      if (a.type === 'set_status') return { type: 'set_status', status: a.status };
      if (a.type === 'set_custom_field') return { type: 'set_custom_field', field: a.customFieldName, value: a.customFieldValue } as any;
      if (a.type === 'rd_create_conversion') return { type: a.type, conversionIdentifier: a.rdIdentifier, conversionName: a.rdName, includeFields: a.rdIncludeFields, customFieldMappings: a.rdCustomFieldMappings.filter(m => m.sourceField && m.rdField) } as any;
      if (a.type === 'set_persona') return { type: a.type, value: a.persona } as any;
      if (a.type === 'set_pain') return { type: a.type, value: a.pain } as any;
      if (a.type === 'move_funnel_stage') return { type: a.type, value: a.funnelStage } as any;
      if (a.type === 'whatsapp_flow') return { type: a.type, flowId: a.whatsappFlow } as any;
      if (a.type === 'pipedrive_create_deal') return { type: a.type, pipeline: a.pipedrivePipeline, fieldMappings: a.pipedriveFieldMappings.filter(m => m.sourceType !== 'skip'), note: a.pipedriveNote || undefined } as any;
      if (a.type === 'notify_team') return { type: a.type, channel: a.notifyChannel, message: a.notifyMessage } as any;
      if (a.type === 'send_meta_event') return { type: a.type, eventName: a.metaEventName, pixelId: a.metaPixelId } as any;
      return { type: a.type as LeadRuleAction['type'], value: '' };
    });

  const hasValidAction = () => buildActions().length > 0;

  const handleSave = async (isActive: boolean, runExisting = false) => {
    if (!name.trim() || !hasValidAction()) return;
    const actions = buildActions();
    if (runExisting && actions.some(action => action.type === 'rd_create_conversion')) {
      const confirmed = window.confirm('Esta regra tem acao externa e pode enviar conversoes para o RD Station para leads existentes. Deseja continuar?');
      if (!confirmed) return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), description: description.trim(),
        priority, isActive, trigger: 'webhook_received',
        conditions: buildConditions(), actions,
      };
      let savedRule: LeadClassificationRule;
      if (editingRule) {
        savedRule = await DataService.updateLeadRule(editingRule.id, payload);
      } else {
        savedRule = await DataService.createLeadRule(payload);
      }
      if (isActive && runExisting) {
        const result = await DataService.runLeadRuleForExistingLeads(savedRule.id, { limit: 500 });
        window.alert(`Regra ativada e executada. Avaliados: ${result.evaluated}. Com match: ${result.matched}. Erros: ${result.errors}.`);
      }
      onSaved();
    } catch (err) {
      console.error('Erro ao salvar regra', err);
    } finally {
      setSaving(false);
    }
  };

  const previewText = () => {
    const cParts = conditions.map((c, i) => {
      const fLabel = EXTENDED_RULE_FIELDS.find(f => f.value === c.field)?.label ?? c.field;
      const opInfo = EXTENDED_RULE_OPERATORS.find(o => o.value === c.operator);
      const vText = c.chips.length > 0 ? c.chips.join(' ou ') : '…';
      const prefix = i === 0 ? '' : (c.connector === 'or' ? 'ou ' : 'e ');
      return `${prefix}${fLabel} ${opInfo?.label ?? c.operator}${opInfo?.hasValue ? ` ${vText}` : ''}`;
    });
    const describe = (a: ActionDraft): string => {
      if (!a.type || COMING_SOON_ACTIONS.has(a.type)) return '';
      if (a.type === 'add_tag') return `tag ${a.tagKey} = ${a.tagValue || '…'}`;
      if (a.type === 'remove_tag') return `remover tag ${a.tagKey}${a.tagValue ? `:${a.tagValue}` : ''}`;
      if (a.type === 'add_score') return `+${a.points} pts`;
      if (a.type === 'set_status') return `status → ${STATUS_MAP[a.status as LeadStatus]?.label ?? a.status}`;
      if (a.type === 'set_custom_field') return `${a.customFieldName || '…'} = ${a.customFieldValue || '…'}`;
      if (a.type === 'set_persona') return `persona = ${a.persona || '…'}`;
      if (a.type === 'set_pain') return `dor = ${a.pain || '…'}`;
      if (a.type === 'move_funnel_stage') return `→ etapa ${a.funnelStage || '…'}`;
      if (a.type === 'rd_create_conversion') return `RD: "${a.rdName || a.rdIdentifier || '…'}"`;
      if (a.type === 'whatsapp_flow') return `WhatsApp: "${a.whatsappFlow || '…'}"`;
      if (a.type === 'pipedrive_create_deal') return `Pipedrive: pipeline ${a.pipedrivePipeline === 'upsell' ? 'Upsell' : 'Novo Cliente'}`;
      if (a.type === 'notify_team') return `notificar ${a.notifyChannel || 'time'}`;
      if (a.type === 'send_meta_event') return `evento "${a.metaEventName || '…'}"`;
      return a.type;
    };
    return { cParts, intParts: internalActions.map(describe).filter(Boolean), extParts: externalActions.map(describe).filter(Boolean) };
  };

  const { cParts, intParts, extParts } = previewText();
  const hasConditionData = name.trim() || conditions.some(c => c.chips.length > 0 || c.operator === 'filled');

  const ddStyle: React.CSSProperties = {
    padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
    background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 12, fontWeight: 500,
    outline: 'none', cursor: 'pointer',
  };
  const sectionBox: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 10, overflow: 'visible' };
  const sectionHead = (color: string): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '11px 14px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)',
    borderLeft: `3px solid ${color}`,
  });
  const badge = (color: string): React.CSSProperties => ({
    width: 20, height: 20, borderRadius: '50%', background: color, color: 'white',
    fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  });
  const addBtn = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
    border: `1px dashed ${color}`, borderRadius: 'var(--r-md)', background: `${color}10`,
    color, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  });
  const actionConnector = (color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '-2px 0' }}>
      <div style={{ width: 20, borderTop: `1px solid ${color}` }} />
      <span style={{ padding: '2px 8px', borderRadius: 4, background: color, color: 'white', fontSize: 11, fontWeight: 800, letterSpacing: '.04em' }}>
        E
      </span>
      <div style={{ flex: 1, borderTop: `1px solid ${color}` }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', minHeight: '100%' }}>

      {/* Sticky header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', flexShrink: 0 }}>
        <button
          type="button" onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          <ChevronLeft size={15} /> Regras
        </button>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(240px, .85fr)', gap: 12, alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--fg-primary)' }}>
            Nome da regra *
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Decisor com interesse em trafego"
              style={{
                width: '100%',
                minHeight: 38,
                padding: '8px 11px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--fg-primary)',
                fontSize: 14,
                fontWeight: 600,
                outline: 'none',
              }}
            />
          </label>
          <label style={{ display: 'grid', gap: 5, fontSize: 12, fontWeight: 800, color: 'var(--fg-primary)' }}>
            Descricao
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Opcional"
              style={{
                width: '100%',
                minHeight: 38,
                padding: '8px 11px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-surface)',
                color: 'var(--fg-primary)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>
        </div>
        <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--fg-subtle)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Prioridade
          <input
            type="number" min={1} max={100} value={priority}
            onChange={e => setPriority(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            title="1 = mais alta, 100 = mais baixa"
            style={{ width: 64, padding: '7px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 13, fontWeight: 600, outline: 'none', textAlign: 'center' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button type="button" disabled={saving || !name.trim() || !hasValidAction()} onClick={() => handleSave(false)}
            style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving || !name.trim() || !hasValidAction() ? 0.5 : 1 }}>
            Salvar rascunho
          </button>
          <button type="button" disabled={saving || !name.trim() || !hasValidAction()} onClick={() => handleSave(true, activationMode === 'existing')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving || !name.trim() || !hasValidAction() ? 0.5 : 1 }}>
            {saving ? <RefreshCw size={14} className="animate-spin" /> : '✓'} Ativar regra
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', alignItems: 'start' }}>

        {/* Left: form — grows naturally, parent scrolls */}
        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, borderRight: '1px solid var(--border)' }}>

            {/* CONDIÇÕES */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)', padding: 14, display: 'grid', gap: 10 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)' }}>Ao ativar</h3>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>Escolha se a regra vale apenas daqui para frente ou se roda agora na base atual.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { value: 'future' as const, title: 'Somente novos leads', desc: 'Executa quando novos leads entrarem ou forem atualizados pelo webhook.' },
                  { value: 'existing' as const, title: 'Novos e leads existentes', desc: 'Ativa a regra e roda agora nos leads que ja estao no banco.' },
                ].map(option => {
                  const selected = activationMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setActivationMode(option.value)}
                      style={{
                        textAlign: 'left',
                        padding: 12,
                        borderRadius: 9,
                        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                        background: selected ? 'rgba(59,130,246,.10)' : 'var(--bg-muted)',
                        color: 'var(--fg-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>{option.title}</span>
                      <span style={{ display: 'block', marginTop: 4, fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4 }}>{option.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={sectionBox}>
              <div style={sectionHead('#3b82f6')}>
                <span style={badge('#3b82f6')}>1</span>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-secondary)' }}>Condições</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 8 }}>Define quando a regra dispara</span>
                </div>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conditions.map((cond, ci) => {
                  const opInfo = EXTENDED_RULE_OPERATORS.find(o => o.value === cond.operator);
                  return (
                    <div key={cond.id}>
                      {ci > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                          {(['and', 'or'] as const).map(logic => (
                            <button key={logic} type="button" onClick={() => updateCond(cond.id, { connector: logic })}
                              style={{ padding: '2px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', textTransform: 'uppercase', letterSpacing: '.04em', background: cond.connector === logic ? '#3b82f6' : 'var(--bg-muted)', color: cond.connector === logic ? 'white' : 'var(--fg-muted)' }}>
                              {logic === 'and' ? 'E' : 'OU'}
                            </button>
                          ))}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, background: 'var(--bg-muted)', borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--fg-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>{ci === 0 ? 'Quando o campo' : 'o campo'}</span>
                          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', padding: '2px 6px', minHeight: 32, display: 'flex', alignItems: 'center', minWidth: 160 }}>
                            <CustomSelect
                              value={cond.field}
                              placeholder="Selecionar campo"
                              options={EXTENDED_RULE_FIELDS}
                              onChange={field => {
                                const ops = getOperatorsForField(field);
                                const op = ops.find(o => o.value === cond.operator) ? cond.operator : ops[0].value;
                                updateCond(cond.id, { field, operator: op as LeadRuleCondition['operator'], chips: [] });
                              }}
                            />
                          </div>
                          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', padding: '2px 6px', minHeight: 32, display: 'flex', alignItems: 'center' }}>
                            <CustomSelect
                              value={cond.operator}
                              placeholder="Operador"
                              options={getOperatorsForField(cond.field).map(o => ({ value: o.value, label: o.label }))}
                              onChange={op => updateCond(cond.id, { operator: op as LeadRuleCondition['operator'], chips: [] })}
                            />
                          </div>
                          {conditions.length > 1 && (
                            <button type="button" onClick={() => setConditions(prev => prev.filter(c => c.id !== cond.id))}
                              style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', padding: 4, display: 'inline-flex' }}>
                              <X size={13} />
                            </button>
                          )}
                        </div>
                        {opInfo?.hasValue && (
                          cond.field === 'tags' ? (
                            <TagSuggestInput
                              chips={cond.chips} input={cond.rawInput}
                              suggestions={availableTags}
                              onInputChange={v => updateCond(cond.id, { rawInput: v })}
                              onAdd={v => addChip(cond.id, v)}
                              onRemove={i => removeChip(cond.id, i)}
                              placeholder="Selecione ou digite uma tag..."
                            />
                          ) : (
                            <TagChipInput
                              chips={cond.chips} input={cond.rawInput}
                              onInputChange={v => updateCond(cond.id, { rawInput: v })}
                              onAdd={v => addChip(cond.id, v)}
                              onRemove={i => removeChip(cond.id, i)}
                              placeholder={opInfo.multiValue ? 'Digite e Enter para adicionar...' : 'Valor e Enter...'}
                            />
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
                <button type="button" onClick={() => setConditions(prev => [...prev, newCondition()])} style={addBtn('#3b82f6')}>
                  <Plus size={12} /> Adicionar critério
                </button>
              </div>
            </div>

            {/* AÇÕES INTERNAS */}
            <div style={sectionBox}>
              <div style={sectionHead('#22c55e')}>
                <span style={badge('#22c55e')}>2</span>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-secondary)' }}>Ações internas</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 8 }}>Atualiza o banco de leads</span>
                </div>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {internalActions.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0, fontStyle: 'italic' }}>
                    Opcional — adicione se precisar classificar, pontuar ou atualizar dados do lead dentro do sistema.
                  </p>
                )}
                {internalActions.map((act, index) => (
                  <React.Fragment key={act.id}>
                    {index > 0 && actionConnector('#22c55e')}
                    <ActionCard
                      act={act}
                      actionList={INTERNAL_ACTIONS_LIST}
                      accentColor="#22c55e"
                      canDelete={true}
                      customFieldDefs={customFieldDefs}
                      onUpdate={ch => setInternalActions(prev => prev.map(a => a.id === act.id ? { ...a, ...ch } : a))}
                      onDelete={() => setInternalActions(prev => prev.filter(a => a.id !== act.id))}
                    />
                  </React.Fragment>
                ))}
                <button type="button" onClick={() => setInternalActions(prev => [...prev, newAction()])} style={addBtn('#22c55e')}>
                  <Plus size={12} /> Adicionar ação interna
                </button>
              </div>
            </div>

            {/* AÇÕES EXTERNAS */}
            <div style={sectionBox}>
              <div style={sectionHead('#8b5cf6')}>
                <span style={badge('#8b5cf6')}>3</span>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--fg-secondary)' }}>Ações externas</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)', marginLeft: 8 }}>Aciona outras ferramentas</span>
                </div>
              </div>
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {externalActions.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0, fontStyle: 'italic' }}>
                    Opcional — adicione se precisar integrar com RD Station, WhatsApp, Pipedrive ou outros.
                  </p>
                )}
                {externalActions.map((act, index) => (
                  <React.Fragment key={act.id}>
                    {index > 0 && actionConnector('#8b5cf6')}
                    <ActionCard
                      act={act}
                      actionList={EXTERNAL_ACTIONS_LIST}
                      accentColor="#8b5cf6"
                      canDelete={true}
                      customFieldDefs={customFieldDefs}
                      onUpdate={ch => setExternalActions(prev => prev.map(a => a.id === act.id ? { ...a, ...ch } : a))}
                      onDelete={() => setExternalActions(prev => prev.filter(a => a.id !== act.id))}
                    />
                  </React.Fragment>
                ))}
                <button type="button" onClick={() => setExternalActions(prev => [...prev, newAction()])} style={addBtn('#8b5cf6')}>
                  <Plus size={12} /> Adicionar ação externa
                </button>
              </div>
            </div>
          </div>

          {/* Right: preview — sticky so it stays visible while left scrolls */}
          <div style={{ position: 'sticky', top: 57, alignSelf: 'start', maxHeight: 'calc(100vh - 57px)', overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-muted)' }}>

            {/* Live preview */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                <span style={{ fontSize: 13, color: 'var(--accent)' }}>⊙</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Preview ao vivo</span>
              </div>
              <div style={{ padding: 14 }}>
                {hasConditionData ? (
                  <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                    {name.trim() && <p style={{ margin: '0 0 10px', fontWeight: 700, color: 'var(--fg-primary)', fontSize: 13 }}>{name}</p>}
                    {cParts.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '.06em' }}>Condições</span>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--fg-muted)' }}>{cParts.join(', ')}</p>
                      </div>
                    )}
                    {intParts.length > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '.06em' }}>Internas</span>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 14 }}>
                          {intParts.map((t, i) => <li key={i} style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 2 }}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                    {extParts.length > 0 && (
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: '.06em' }}>Externas</span>
                        <ul style={{ margin: '4px 0 0', paddingLeft: 14 }}>
                          {extParts.map((t, i) => <li key={i} style={{ fontSize: 12, color: 'var(--fg-muted)', marginBottom: 2 }}>{t}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--fg-subtle)', margin: 0, fontStyle: 'italic' }}>Preencha os campos para ver o preview.</p>
                )}
                {editingRule && editingRule.runCount > 0 && (
                  <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 8, background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: '#3b82f6' }}>{editingRule.runCount.toLocaleString('pt-BR')} execuções</p>
                      <p style={{ margin: 0, fontSize: 11, color: 'var(--fg-muted)' }}>histórico desta regra</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Legenda */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>ⓘ</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Como funciona</span>
              </div>
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { color: '#3b82f6', text: 'Condições definem quando a regra dispara — baseadas nos dados do lead.' },
                  { color: '#22c55e', text: 'Ações internas atualizam tags, score, status e campos sem acionar ferramentas externas.' },
                  { color: '#8b5cf6', text: 'Ações externas integram com RD Station, WhatsApp, Pipedrive e plataformas de mídia.' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0, marginTop: 4 }} />
                    <span style={{ fontSize: 11.5, color: 'var(--fg-muted)', lineHeight: 1.5 }}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

// ─── Rules panel ──────────────────────────────────────────────────────────────

export const LeadRulesPanel: React.FC = () => {
  const [rules, setRules] = useState<LeadClassificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<LeadClassificationRule | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'paused' | 'draft'>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'priority' | 'executions'>('newest');
  const [runningRuleId, setRunningRuleId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      setRules(await DataService.listLeadRules());
    } catch (err) {
      console.error('Erro ao carregar regras', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);

  const totalActive = rules.filter(r => r.isActive).length;
  const totalPaused = rules.filter(r => !r.isActive).length;

  const lastExecution = [...rules]
    .filter(r => r.lastRunAt)
    .sort((a, b) => new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime())[0];

  const timeAgo = (iso: string): string => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `há ${s} segundo${s !== 1 ? 's' : ''}`;
    const m = Math.floor(s / 60);
    if (m < 60) return `há ${m} minuto${m !== 1 ? 's' : ''}`;
    const h = Math.floor(m / 60);
    if (h < 24) return `há ${h} hora${h !== 1 ? 's' : ''}`;
    const d = Math.floor(h / 24);
    return `há ${d} dia${d !== 1 ? 's' : ''}`;
  };

  const getExecUnit = (rule: LeadClassificationRule): string => {
    return 'execucoes';
  };

  const filteredRules = rules
    .filter(rule => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!rule.name.toLowerCase().includes(q) && !(rule.description ?? '').toLowerCase().includes(q)) return false;
      }
      if (activeFilter === 'active') return rule.isActive;
      if (activeFilter === 'paused') return !rule.isActive;
      if (activeFilter === 'draft') return false;
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortOrder === 'priority') return a.priority - b.priority;
      if (sortOrder === 'executions') return b.runCount - a.runCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const openNewForm = () => { setEditingRule(null); setShowForm(true); };
  const openEditForm = (rule: LeadClassificationRule) => { setEditingRule(rule); setShowForm(true); };

  const toggleRule = async (rule: LeadClassificationRule) => {
    await DataService.updateLeadRule(rule.id, { isActive: !rule.isActive });
    await loadRules();
  };

  const deleteRule = async (rule: LeadClassificationRule) => {
    if (!window.confirm(`Excluir a regra "${rule.name}"?`)) return;
    await DataService.deleteLeadRule(rule.id);
    await loadRules();
  };

  const runExistingLeads = async (rule: LeadClassificationRule) => {
    const hasExternalAction = rule.actions.some(action => action.type === 'rd_create_conversion');
    const message = hasExternalAction
      ? `Executar "${rule.name}" nos leads existentes? Essa regra tem ação externa e pode enviar conversões para o RD Station.`
      : `Executar "${rule.name}" nos leads existentes?`;
    if (!window.confirm(message)) return;

    setRunningRuleId(rule.id);
    try {
      const result = await DataService.runLeadRuleForExistingLeads(rule.id, { limit: 500 });
      window.alert(`Regra executada. Avaliados: ${result.evaluated}. Com match: ${result.matched}. Erros: ${result.errors}.`);
      await loadRules();
    } catch (error) {
      console.error('Erro ao executar regra em leads existentes', error);
      window.alert('Nao foi possivel executar a regra. Veja o console/backend para detalhes.');
    } finally {
      setRunningRuleId(null);
    }
  };

  const FILTERS = [
    { key: 'all' as const,    label: 'Todos',     count: rules.length },
    { key: 'active' as const, label: 'Ativos',    count: totalActive },
    { key: 'paused' as const, label: 'Pausados',  count: totalPaused },
    { key: 'draft' as const,  label: 'Rascunho',  count: 0 },
  ];

  const iconBtnStyle: React.CSSProperties = {
    padding: 6,
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-sm)',
    background: 'transparent',
    color: 'var(--fg-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
  };

  if (showForm) {
    return (
      <RuleFormPage
        editingRule={editingRule}
        onClose={() => setShowForm(false)}
        onSaved={() => { setShowForm(false); loadRules(); }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Stats */}
      <div className="ds-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--bg-muted)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Filter size={16} style={{ color: 'var(--fg-muted)' }} />
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600, marginBottom: 2 }}>Total de regras</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-primary)', lineHeight: 1 }}>{loading ? '—' : rules.length}</span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)' }}>{totalActive} ativas · {totalPaused} pausadas</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }} />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar regra por nome ou campo..."
            style={{ width: 260, paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', color: 'var(--fg-primary)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 5 }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              style={{
                padding: '5px 11px',
                borderRadius: 20,
                border: `1px solid ${activeFilter === f.key ? 'var(--fg-tertiary, var(--fg-subtle))' : 'var(--border)'}`,
                background: activeFilter === f.key ? 'var(--bg-muted)' : 'transparent',
                color: activeFilter === f.key ? 'var(--fg-primary)' : 'var(--fg-muted)',
                fontSize: 12,
                fontWeight: activeFilter === f.key ? 600 : 400,
                cursor: 'pointer',
                transition: 'all .12s',
              }}
            >
              {f.label} {f.count}
            </button>
          ))}
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', padding: '2px 8px', minHeight: 34, display: 'flex', alignItems: 'center', minWidth: 160 }}>
          <CustomSelect
            value={sortOrder}
            placeholder="Ordenar"
            options={[
              { value: 'newest',     label: 'Mais recentes' },
              { value: 'oldest',     label: 'Mais antigos' },
              { value: 'priority',   label: 'Prioridade' },
              { value: 'executions', label: 'Mais executadas' },
            ]}
            onChange={v => setSortOrder(v as typeof sortOrder)}
          />
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={openNewForm}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          <Plus size={14} /> Nova regra
        </button>
      </div>

      {/* Table */}
      <div className="ds-table-wrap" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>Carregando regras...</div>
        ) : filteredRules.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <Filter size={28} style={{ margin: '0 auto 10px', color: 'var(--fg-subtle)', display: 'block' }} />
            <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: 0 }}>
              {searchQuery || activeFilter !== 'all' ? 'Nenhuma regra encontrada com esses filtros.' : 'Nenhuma regra criada ainda.'}
            </p>
            {!searchQuery && activeFilter === 'all' && (
              <button type="button" onClick={openNewForm} style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <Plus size={13} /> Criar primeira regra
              </button>
            )}
          </div>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Regra</th>
                <th style={{ textAlign: 'right', width: 160 }}>Execuções</th>
                <th style={{ width: 80 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredRules.map(rule => (
                <tr key={rule.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <ToggleSwitch checked={rule.isActive} onChange={() => toggleRule(rule)} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: rule.isActive ? 'var(--fg-primary)' : 'var(--fg-muted)' }}>{rule.name}</p>
                        {rule.description && (
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--fg-subtle)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 500 }}>{rule.description}</p>
                        )}
                        {!rule.isActive && (
                          <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-subtle)', fontStyle: 'italic' }}>Pausado · revisitar quando necessário</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {rule.isActive ? (
                      <span style={{ fontSize: 13 }}>
                        <strong style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>{rule.runCount.toLocaleString('pt-BR')}</strong>
                        {' '}
                        <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{getExecUnit(rule)}</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--fg-subtle)' }}>0 pausada</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button type="button" onClick={() => openEditForm(rule)} title="Editar" style={iconBtnStyle}>
                        <Pencil size={13} />
                      </button>
                      <button type="button" onClick={() => runExistingLeads(rule)} title="Executar em leads existentes" style={iconBtnStyle} disabled={runningRuleId === rule.id}>
                        <RotateCw size={13} className={runningRuleId === rule.id ? 'animate-spin' : undefined} />
                      </button>
                      <button type="button" onClick={() => deleteRule(rule)} title="Excluir" style={iconBtnStyle}>
                        <Minus size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && rules.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>
              Mostrando {filteredRules.length} de {rules.length} regra{rules.length !== 1 ? 's' : ''}
            </span>
            {lastExecution?.lastRunAt && (
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Última execução {timeAgo(lastExecution.lastRunAt)}</span>
            )}
          </div>
        )}
      </div>
    </div>

  );
};

const LeadWebhooksPanel: React.FC = () => {
  const [webhooks, setWebhooks] = useState<LeadWebhookSource[]>([]);
  const [logs, setLogs] = useState<Record<string, LeadWebhookLog[]>>({});
  const [selectedLogs, setSelectedLogs] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [editingWebhook, setEditingWebhook] = useState<LeadWebhookSource | null>(null);
  const [mappingSource, setMappingSource] = useState<LeadWebhookSource | null>(null);
  const [inspection, setInspection] = useState<LeadWebhookInspection | null>(null);
  const [visualMappings, setVisualMappings] = useState<Record<string, string>>({});
  const [mappingLoading, setMappingLoading] = useState(false);
  const [mappingSaving, setMappingSaving] = useState(false);
  const [mappingTesting, setMappingTesting] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('rich_content');
  const [description, setDescription] = useState('');
  const [autoTags, setAutoTags] = useState<string[]>([]);
  const [tagKeyInput, setTagKeyInput] = useState('');
  const [tagValInput, setTagValInput] = useState('');
  const [defaultSource, setDefaultSource] = useState('');
  const [defaultCampaign, setDefaultCampaign] = useState('');
  const [fieldDefs, setFieldDefs] = useState<LeadCustomFieldDef[]>([]);

  const loadWebhooks = useCallback(async () => {
    setLoading(true);
    try {
      setWebhooks(await DataService.listLeadWebhooks());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadWebhooks(); }, [loadWebhooks]);
  useEffect(() => {
    DataService.listCustomFieldDefs()
      .then(defs => setFieldDefs(defs.filter(d => d.visible)))
      .catch(() => {});
  }, []);

  const resetForm = () => {
    setEditingWebhook(null);
    setName('');
    setType('rich_content');
    setDescription('');
    setAutoTags([]);
    setTagKeyInput('');
    setTagValInput('');
    setDefaultSource('');
    setDefaultCampaign('');
  };

  const startEdit = (webhook: LeadWebhookSource) => {
    setEditingWebhook(webhook);
    setName(webhook.name);
    setType(webhook.type ?? 'rich_content');
    setDescription(webhook.description ?? '');
    setAutoTags([...(webhook.automaticTags ?? [])]);
    setTagKeyInput('');
    setTagValInput('');
    setDefaultSource((webhook as any).defaultSource ?? '');
    setDefaultCampaign((webhook as any).defaultCampaign ?? '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createWebhook = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        automaticTags: autoTags,
        defaultSource: defaultSource.trim() || undefined,
        defaultCampaign: defaultCampaign.trim() || undefined,
      };
      if (editingWebhook) {
        await DataService.updateLeadWebhook(editingWebhook.id, payload);
      } else {
        const created = await DataService.createLeadWebhook(payload);
        await navigator.clipboard?.writeText(created.webhookUrl);
      }
      resetForm();
      await loadWebhooks();
    } finally {
      setSaving(false);
    }
  };

  const deleteWebhook = async (webhook: LeadWebhookSource) => {
    if (!window.confirm(`Excluir o webhook "${webhook.name}"? Esta ação não pode ser desfeita.`)) return;
    await DataService.deleteLeadWebhook(webhook.id);
    await loadWebhooks();
  };

  const copyUrl = async (url: string) => {
    await navigator.clipboard?.writeText(url);
  };

  const toggleActive = async (webhook: LeadWebhookSource) => {
    await DataService.updateLeadWebhook(webhook.id, { isActive: !webhook.isActive });
    await loadWebhooks();
  };

  const regenerate = async (webhook: LeadWebhookSource) => {
    const ok = window.confirm(`Regenerar a URL do webhook "${webhook.name}"? A URL antiga vai parar de funcionar.`);
    if (!ok) return;
    const updated = await DataService.regenerateLeadWebhookUrl(webhook.id);
    await navigator.clipboard?.writeText(updated.webhookUrl);
    await loadWebhooks();
  };

  const openLogs = async (webhook: LeadWebhookSource) => {
    if (selectedLogs === webhook.id) {
      setSelectedLogs(null);
      return;
    }
    setSelectedLogs(webhook.id);
    if (!logs[webhook.id]) {
      setLogs(prev => ({ ...prev, [webhook.id]: [] }));
      const items = await DataService.listLeadWebhookLogs(webhook.id, 20);
      setLogs(prev => ({ ...prev, [webhook.id]: items }));
    }
  };

  const normalizeLogPayload = (payload: unknown): Record<string, unknown> => {
    if (!payload || typeof payload !== 'object') return {};
    if (Array.isArray(payload)) {
      return Object.fromEntries(
        payload
          .filter(item => item && typeof item === 'object' && !Array.isArray(item))
          .map(item => {
            const record = item as Record<string, unknown>;
            const key = String(record.name || record.key || record.field || record.fieldName || record.id || '').trim();
            return key ? [key, record.value ?? record.answer ?? record.content ?? record.text ?? ''] : null;
          })
          .filter((entry): entry is [string, unknown] => Boolean(entry))
      );
    }

    const record = payload as Record<string, unknown>;
    const output: Record<string, unknown> = { ...record };
    for (const key of ['fields', 'answers', 'questions', 'formData', 'data', 'body', 'payload']) {
      const child = record[key];
      if (Array.isArray(child)) {
        Object.assign(output, normalizeLogPayload(child));
      } else if (child && typeof child === 'object' && !Array.isArray(child)) {
        Object.assign(output, child as Record<string, unknown>);
      }
    }
    return output;
  };

  const flattenLogPayloadFields = (payload: unknown, prefix = '', output: string[] = []): string[] => {
    if (!payload || typeof payload !== 'object') return output;
    if (Array.isArray(payload)) {
      return flattenLogPayloadFields(normalizeLogPayload(payload), prefix, output);
    }
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        flattenLogPayloadFields(value, path, output);
      } else {
        output.push(path);
      }
    });
    return output;
  };

  const inferMappingTarget = (field: string): string => {
    const normalized = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalized.endsWith('email')) return 'lead.email';
    if (normalized.endsWith('nome') || normalized.endsWith('name')) return 'lead.name';
    if (normalized.includes('telefone') || normalized.includes('phone') || normalized.includes('whatsapp')) return 'lead.phone';
    if (normalized.includes('empresa') || normalized.includes('company')) return 'lead.company';
    if (normalized.includes('cargo') || normalized.includes('jobtitle')) return 'lead.jobTitle';
    if (normalized.includes('segmento')) return 'answers.segmento';
    if (normalized.includes('utmsource')) return 'conversion.utmSource';
    if (normalized.includes('utmmedium')) return 'conversion.utmMedium';
    if (normalized.includes('utmcampaign')) return 'conversion.utmCampaign';
    if (normalized.includes('utmcontent')) return 'conversion.utmContent';
    if (normalized.includes('utmterm')) return 'conversion.utmTerm';
    return '';
  };

  const buildInspectionFromLogs = async (webhookId: string, base: LeadWebhookInspection): Promise<LeadWebhookInspection> => {
    if (base.detectedFields.length > 0) return base;
    const items = await DataService.listLeadWebhookLogs(webhookId, 25);
    setLogs(prev => ({ ...prev, [webhookId]: items }));
    const sample = items.find(log => flattenLogPayloadFields(normalizeLogPayload(log.payload)).length > 0);
    if (!sample) return base;
    const payload = normalizeLogPayload(sample.payload);
    const detectedFields = flattenLogPayloadFields(payload);
    const suggestedMappings = Object.fromEntries(
      detectedFields
        .map(field => [field, base.currentMappings[field] || inferMappingTarget(field)])
        .filter(([, target]) => target)
    );
    return {
      ...base,
      detectedFields,
      suggestedMappings,
      normalizedPreview: base.normalizedPreview || payload,
      lastPayload: payload,
      sampleLogId: sample.id,
      sampleLogReceivedAt: sample.receivedAt,
      lastLogStatus: base.lastLogStatus || sample.status,
      lastLogError: base.lastLogError || sample.error,
    };
  };

  const inspectWebhookForMapping = async (webhook: LeadWebhookSource): Promise<LeadWebhookInspection> => {
    const emptyInspection: LeadWebhookInspection = {
      sourceId: webhook.id,
      publicId: webhook.publicId,
      detectedFields: [],
      currentMappings: webhook.fieldMappings || {},
      suggestedMappings: {},
      normalizedPreview: null,
      lastPayload: null,
      lastLogStatus: null,
      lastLogError: null,
    };

    let data = emptyInspection;
    let inspectError: unknown = null;

    try {
      data = webhook.publicId
        ? await DataService.inspectLeadWebhookByPublicId(webhook.publicId)
        : await DataService.inspectLeadWebhook(webhook.id);
    } catch (error) {
      inspectError = error;
      try {
        data = await DataService.inspectLeadWebhook(webhook.id);
        inspectError = null;
      } catch (fallbackError) {
        inspectError = fallbackError;
      }
    }

    try {
      const withLogs = await buildInspectionFromLogs(webhook.id, data);
      if (withLogs.detectedFields.length > 0) {
        setMappingError(null);
        return withLogs;
      }
      if (inspectError) {
        setMappingError(inspectError instanceof Error ? inspectError.message : String(inspectError));
      }
      return withLogs;
    } catch (logsError) {
      const message = logsError instanceof Error ? logsError.message : String(logsError);
      setMappingError(inspectError instanceof Error ? `${inspectError.message} | Logs: ${message}` : message);
      return data;
    }
  };

  const openMapping = async (webhook: LeadWebhookSource) => {
    setMappingSource(webhook);
    setInspection(null);
    setVisualMappings({});
    setMappingError(null);
    setMappingLoading(true);
    try {
      const data = await inspectWebhookForMapping(webhook);
      setInspection(data);
      setVisualMappings({ ...data.suggestedMappings, ...data.currentMappings });
    } finally {
      setMappingLoading(false);
    }
  };

  const sendMappingTest = async () => {
    if (!mappingSource) return;
    setMappingTesting(true);
    setMappingLoading(true);
    setMappingError(null);
    try {
      await DataService.testLeadWebhook(mappingSource.id);
      const data = await inspectWebhookForMapping(mappingSource);
      setInspection(data);
      setVisualMappings({ ...data.suggestedMappings, ...data.currentMappings });
      await loadWebhooks();
    } finally {
      setMappingTesting(false);
      setMappingLoading(false);
    }
  };

  const saveVisualMappings = async () => {
    if (!mappingSource) return;
    setMappingSaving(true);
    setMappingError(null);
    try {
      const clean = Object.fromEntries(
        Object.entries(visualMappings).filter(([, target]) => target)
      );
      await DataService.updateLeadWebhook(mappingSource.id, { fieldMappings: clean });
      await loadWebhooks();
      const data = await inspectWebhookForMapping(mappingSource);
      setInspection(data);
      setVisualMappings({ ...data.suggestedMappings, ...data.currentMappings });
    } finally {
      setMappingSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--fg-primary)',
    fontSize: 13,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--fg-subtle)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  };

  const iconBtn = (color = 'var(--fg-muted)'): React.CSSProperties => ({
    border: '1px solid var(--border)',
    background: 'transparent',
    color,
    borderRadius: 'var(--r-sm)',
    padding: 7,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

  const destinationOptions = [
    { value: '', label: 'Ignorar campo' },
    { value: 'lead.email', label: 'Email do lead' },
    { value: 'lead.name', label: 'Nome do lead' },
    { value: 'lead.phone', label: 'Telefone' },
    { value: 'lead.company', label: 'Empresa' },
    { value: 'lead.jobTitle', label: 'Cargo' },
    { value: 'lead.city', label: 'Cidade' },
    { value: 'lead.state', label: 'Estado' },
    { value: 'conversion.externalId', label: 'ID externo da conversao' },
    { value: 'conversion.formName', label: 'Nome do formulario' },
    { value: 'conversion.landingPage', label: 'Landing page' },
    { value: 'conversion.campaignName', label: 'Nome da campanha' },
    { value: 'conversion.utmSource', label: 'UTM Source' },
    { value: 'conversion.utmMedium', label: 'UTM Medium' },
    { value: 'conversion.utmCampaign', label: 'UTM Campaign' },
    { value: 'conversion.utmContent', label: 'UTM Content' },
    { value: 'conversion.utmTerm', label: 'UTM Term' },
    ...fieldDefs.map(def => ({ value: `customFields.${def.name}`, label: `Campo personalizado: ${def.label}` })),
  ];

  if (mappingSource) {
    const rawPayloadText = inspection?.lastPayload
      ? JSON.stringify(inspection.lastPayload, null, 2)
      : '';
    const hasReceivedPayload = Boolean(rawPayloadText && rawPayloadText !== '{}');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', minHeight: '100%' }}>
        {/* Sticky header */}
        <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', flexShrink: 0 }}>
          <button type="button" onClick={() => setMappingSource(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
            <ChevronLeft size={15} /> Webhooks
          </button>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)' }}>Mapear campos</span>
            <span style={{ fontSize: 13, color: 'var(--fg-muted)', marginLeft: 8 }}>{mappingSource.name}</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>Envie um teste sempre que o formulário mudar.</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={sendMappingTest} disabled={mappingTesting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--fg-secondary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mappingTesting ? 0.6 : 1 }}>
              {mappingTesting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />} Enviar teste
            </button>
            <button type="button" onClick={() => setMappingSource(null)}
              style={{ padding: '8px 14px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="button" onClick={saveVisualMappings} disabled={mappingSaving || !inspection?.detectedFields.length}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: mappingSaving || !inspection?.detectedFields.length ? 0.5 : 1 }}>
              {mappingSaving ? <RefreshCw size={14} className="animate-spin" /> : <Settings2 size={14} />} Salvar mapeamento
            </button>
          </div>
        </div>

        {/* Two-column body */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', alignItems: 'start' }}>
          <div style={{ padding: '24px 28px', borderRight: '1px solid var(--border)' }}>
            {mappingLoading ? (
              <div style={{ padding: 32, color: 'var(--fg-muted)', fontSize: 13 }}>Carregando último payload...</div>
            ) : !inspection || inspection.detectedFields.length === 0 ? (
              <div style={{ border: '1px dashed var(--border)', borderRadius: 12, padding: 40, textAlign: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)', margin: 0 }}>Nenhum campo recebido ainda</h3>
                <p style={{ fontSize: 13, color: 'var(--fg-muted)', margin: '8px 0 0' }}>Copie a URL do webhook, envie um teste pelo formulário e volte aqui para mapear os campos detectados automaticamente.</p>
                {mappingError && (
                  <div style={{ marginTop: 14, border: '1px solid var(--danger)', borderRadius: 10, background: 'rgba(239,68,68,0.08)', color: 'var(--danger)', padding: 12, fontSize: 12, textAlign: 'left', wordBreak: 'break-word' }}>
                    Falha ao carregar campos: {mappingError}
                  </div>
                )}
                {inspection && (
                  <div style={{ marginTop: 18, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-surface)', textAlign: 'left' }}>
                    <div style={{ padding: '10px 12px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-secondary)' }}>Diagnostico do ultimo envio</span>
                      <span style={{ fontSize: 11, color: 'var(--fg-muted)' }}>
                        {inspection.sampleLogReceivedAt ? new Date(inspection.sampleLogReceivedAt).toLocaleString('pt-BR') : 'sem data'}
                      </span>
                    </div>
                    <div style={{ padding: 12, display: 'grid', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--fg-muted)' }}>
                        <span>Status: <strong style={{ color: 'var(--fg-secondary)' }}>{inspection.lastLogStatus || '-'}</strong></span>
                        {inspection.lastLogError && <span>Erro: <strong style={{ color: 'var(--danger)' }}>{inspection.lastLogError}</strong></span>}
                      </div>
                      <pre style={{ margin: 0, maxHeight: 280, overflow: 'auto', padding: 12, borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--fg-secondary)', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {hasReceivedPayload ? rawPayloadText : '{}'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '10px 14px', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 800, textTransform: 'uppercase' }}>Campo recebido</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-subtle)', fontWeight: 800, textTransform: 'uppercase' }}>Destino no sistema</span>
                </div>
                {inspection.detectedFields.map(field => {
                  const rawValue = (inspection.lastPayload as Record<string, unknown>)?.[field];
                  const displayValue = rawValue !== undefined && rawValue !== null && rawValue !== ''
                    ? String(rawValue).slice(0, 120)
                    : null;
                  return (
                    <div key={field} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--fg-secondary)', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{field}</span>
                        {displayValue && (
                          <span style={{ fontSize: 11, color: 'var(--fg-muted)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }} title={String(rawValue)}>
                            {displayValue}
                          </span>
                        )}
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', padding: '2px 8px', minHeight: 36, display: 'flex', alignItems: 'center' }}>
                        <CustomSelect
                          value={visualMappings[field] ?? ''}
                          placeholder="Ignorar campo"
                          options={destinationOptions}
                          onChange={v => setVisualMappings(prev => ({ ...prev, [field]: v }))}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: sticky preview */}
          <div style={{ position: 'sticky', top: 57, alignSelf: 'start', maxHeight: 'calc(100vh - 57px)', overflowY: 'auto', padding: 20 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Preview normalizado</span>
              </div>
              <div style={{ padding: 14 }}>
                <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--fg-muted)' }}>Como o sistema vai interpretar o último envio.</p>
                <pre style={{ margin: 0, fontSize: 11, color: 'var(--fg-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {inspection ? JSON.stringify(inspection.normalizedPreview, null, 2) : '—'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 18, alignItems: 'start' }}>
      <form onSubmit={createWebhook} className="ds-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)', margin: 0 }}>
              {editingWebhook ? 'Editar webhook' : 'Criar webhook'}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '4px 0 0' }}>
              {editingWebhook ? `Editando: ${editingWebhook.name}` : 'Gere uma URL secreta para receber leads de formularios e ferramentas.'}
            </p>
          </div>
          {editingWebhook && (
            <button type="button" onClick={resetForm} style={{ flexShrink: 0, padding: '5px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg-muted)', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Nome</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Ebook Performance 2026" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Tipo</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', padding: '2px 8px', minHeight: 38, display: 'flex', alignItems: 'center' }}>
            <CustomSelect
              value={type}
              placeholder="Selecionar tipo"
              options={WEBHOOK_TYPES}
              onChange={setType}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Descrição</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Formulário da página de vendas do ebook" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={labelStyle}>Tags automáticas</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-surface)', minHeight: 36 }}>
            {autoTags.map((tag, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px 2px 6px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, color: 'var(--fg-secondary)', fontWeight: 500 }}>
                {tag}
                <button type="button" onClick={() => setAutoTags(prev => prev.filter((_, j) => j !== i))} style={{ border: 'none', background: 'transparent', color: 'var(--fg-subtle)', cursor: 'pointer', padding: 0, display: 'inline-flex', lineHeight: 1 }}>
                  <X size={10} />
                </button>
              </span>
            ))}
            {autoTags.length === 0 && <span style={{ fontSize: 12, color: 'var(--fg-subtle)', fontStyle: 'italic' }}>Nenhuma tag ainda</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 6 }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', background: 'var(--bg-surface)', padding: '2px 6px', minHeight: 32, display: 'flex', alignItems: 'center' }}>
              <CustomSelect
                value={tagKeyInput}
                placeholder="Prefixo (opc.)"
                options={[{ value: '', label: 'Sem prefixo' }, ...TAG_KEYS.map(k => ({ value: k, label: k }))]}
                onChange={setTagKeyInput}
              />
            </div>
            <input
              value={tagValInput}
              onChange={e => setTagValInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && tagValInput.trim()) {
                  e.preventDefault();
                  const tag = tagKeyInput ? `${tagKeyInput}:${tagValInput.trim()}` : tagValInput.trim();
                  setAutoTags(prev => [...prev, tag]);
                  setTagValInput('');
                }
              }}
              placeholder="Ex: Ebook de vendas (Enter para adicionar)"
              style={{ ...inputStyle, fontSize: 12 }}
            />
            <button
              type="button"
              onClick={() => {
                if (!tagValInput.trim()) return;
                const tag = tagKeyInput ? `${tagKeyInput}:${tagValInput.trim()}` : tagValInput.trim();
                setAutoTags(prev => [...prev, tag]);
                setTagValInput('');
              }}
              style={{ padding: '6px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', background: 'var(--bg-muted)', color: 'var(--fg-secondary)', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Add
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Origem padrão</label>
            <input value={defaultSource} onChange={e => setDefaultSource(e.target.value)} placeholder="ebook" style={inputStyle} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={labelStyle}>Campanha padrão</label>
            <input value={defaultCampaign} onChange={e => setDefaultCampaign(e.target.value)} placeholder="performance-2026" style={inputStyle} />
          </div>
        </div>

        <button type="submit" disabled={saving || !name.trim()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 12px', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--accent)', color: 'white', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: saving || !name.trim() ? .55 : 1 }}>
          {saving ? <RefreshCw size={14} className="animate-spin" /> : editingWebhook ? <Pencil size={14} /> : <Link2 size={14} />}
          {editingWebhook ? 'Salvar alterações' : 'Criar e copiar URL'}
        </button>
      </form>

      <div className="ds-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-primary)', margin: 0 }}>Webhooks criados</h2>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '3px 0 0' }}>Copie a URL e cole no formulario, n8n, Make ou ferramenta.</p>
          </div>
          <button type="button" onClick={loadWebhooks} style={iconBtn()} title="Recarregar">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 24, color: 'var(--fg-muted)', fontSize: 13 }}>Carregando webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>Nenhum webhook criado ainda.</div>
        ) : (
          webhooks.map(webhook => {
            const webhookLogs = logs[webhook.id] ?? [];
            const health = WEBHOOK_HEALTH[webhook.healthStatus] ?? WEBHOOK_HEALTH.waiting_test;
            return (
              <div key={webhook.id} style={{ borderBottom: '1px solid var(--border)', padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`ds-badge ${webhook.healthStatus === 'ready' ? 'success' : webhook.healthStatus === 'error' || webhook.healthStatus === 'missing_email_mapping' ? 'danger' : 'warning'}`}>
                        <span className="dot" style={{ background: health.color }} />
                        {health.label}
                      </span>
                      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--fg-primary)' }}>{webhook.name}</h3>
                    </div>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{webhook.webhookUrl}</p>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--fg-subtle)' }}>
                      {webhook.totalLogs} envios - {webhook.successCount} sucesso - {webhook.errorCount} erro - {webhook.mappingCount} campos mapeados
                      {webhook.lastLog ? ` - ultimo: ${webhook.lastLog.status} em ${new Date(webhook.lastLog.receivedAt).toLocaleString('pt-BR')}` : ''}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: health.color }}>{health.helper}</p>
                    {webhook.automaticTags.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        {webhook.automaticTags.map(tag => <span key={tag} className="ds-badge">{tag}</span>)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button type="button" onClick={() => copyUrl(webhook.webhookUrl)} style={iconBtn()} title="Copiar URL"><Clipboard size={14} /></button>
                    <button type="button" onClick={() => openMapping(webhook)} style={iconBtn('var(--accent)')} title="Mapear campos"><Settings2 size={14} /></button>
                    <button type="button" onClick={() => openLogs(webhook)} style={iconBtn()} title="Ver logs"><ExternalLink size={14} /></button>
                    <button type="button" onClick={() => startEdit(webhook)} style={iconBtn('var(--fg-secondary)')} title="Editar webhook"><Pencil size={14} /></button>
                    <button type="button" onClick={() => regenerate(webhook)} style={iconBtn('var(--yellow-600)')} title="Regenerar URL"><RotateCw size={14} /></button>
                    <button type="button" onClick={() => toggleActive(webhook)} style={iconBtn(webhook.isActive ? 'var(--red-500)' : 'var(--green-500)')} title={webhook.isActive ? 'Desativar' : 'Ativar'}><Power size={14} /></button>
                    <button type="button" onClick={() => deleteWebhook(webhook)} style={iconBtn('var(--red-500)')} title="Excluir webhook"><Trash2 size={14} /></button>
                  </div>
                </div>

                {selectedLogs === webhook.id && (
                  <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                    {webhookLogs.length === 0 ? (
                      <div style={{ padding: 14, fontSize: 12, color: 'var(--fg-muted)' }}>Nenhum log encontrado.</div>
                    ) : webhookLogs.map(log => {
                      const open = expandedLog === log.id;
                      return (
                        <div key={log.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <button
                            type="button"
                            onClick={() => setExpandedLog(open ? null : log.id)}
                            style={{ width: '100%', padding: '10px 12px', border: 'none', background: 'transparent', display: 'grid', gridTemplateColumns: '110px 1fr 160px', gap: 10, alignItems: 'center', textAlign: 'left', cursor: 'pointer' }}
                          >
                            <span className={`ds-badge ${log.status === 'success' ? 'success' : log.status === 'error' ? 'danger' : ''}`}>{log.status}</span>
                            <span style={{ fontSize: 12, color: log.error ? 'var(--red-500)' : 'var(--fg-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {log.error || log.leadEmail || 'Payload recebido'}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--fg-subtle)', textAlign: 'right' }}>{new Date(log.receivedAt).toLocaleString('pt-BR')}</span>
                          </button>
                          {open && (
                            <div style={{ padding: 12, background: 'var(--bg-subtle)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                              {[
                                { label: 'Recebido', value: log.payload },
                                { label: 'Normalizado', value: log.normalized },
                                { label: 'Resultado', value: log.result },
                              ].map(block => (
                                <div key={block.label} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
                                  <div style={{ padding: '7px 9px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 800, color: 'var(--fg-subtle)', textTransform: 'uppercase' }}>{block.label}</div>
                                  <pre style={{ margin: 0, padding: 10, maxHeight: 260, overflow: 'auto', fontSize: 11, color: 'var(--fg-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {JSON.stringify(block.value ?? {}, null, 2)}
                                  </pre>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const CustomFieldManager: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [fields, setFields] = useState<LeadCustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [fieldType, setFieldType] = useState<LeadCustomFieldDef['fieldType']>('text');
  const [placeholder, setPlaceholder] = useState('');
  const [optionsText, setOptionsText] = useState('');
  const [required, setRequired] = useState(false);
  const [visible, setVisible] = useState(true);
  const [sortOrder, setSortOrder] = useState('0');
  const [editingField, setEditingField] = useState<LeadCustomFieldDef | null>(null);

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      setFields(await DataService.listCustomFieldDefs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleLabelChange = (next: string) => {
    setLabel(next);
    setName(current => current ? current : slugFieldName(next));
  };

  const resetForm = () => {
    setLabel('');
    setName('');
    setFieldType('text');
    setPlaceholder('');
    setOptionsText('');
    setRequired(false);
    setVisible(true);
    setSortOrder('0');
    setEditingField(null);
  };

  const startEdit = (field: LeadCustomFieldDef) => {
    setEditingField(field);
    setLabel(field.label);
    setName(field.name);
    setFieldType(field.fieldType);
    setPlaceholder(field.placeholder ?? '');
    setOptionsText(field.options.join('\n'));
    setRequired(field.required);
    setVisible(field.visible);
    setSortOrder(String(field.sortOrder ?? 0));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanLabel = label.trim();
    const cleanName = slugFieldName(name || cleanLabel);
    if (!cleanLabel || !cleanName) return;

    setSaving(true);
    try {
      const options = optionsText.split('\n').map(item => item.trim()).filter(Boolean);
      const parsedSortOrder = Number(sortOrder);
      const nextSortOrder = Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0;
      if (editingField) {
        await DataService.updateCustomFieldDef(editingField.id, {
          label: cleanLabel,
          fieldType,
          options: fieldType === 'select' ? options : [],
          placeholder: placeholder.trim() || undefined,
          required,
          visible,
          sortOrder: nextSortOrder,
        });
      } else {
        await DataService.createCustomFieldDef({
          label: cleanLabel,
          name: cleanName,
          fieldType,
          options: fieldType === 'select' ? options : [],
          placeholder: placeholder.trim() || undefined,
          required,
          visible,
          sortOrder: nextSortOrder,
        });
      }
      resetForm();
      await loadFields();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field: LeadCustomFieldDef) => {
    const ok = window.confirm(`Remover o campo "${field.label}"? Os valores ja salvos nos leads nao serao apagados automaticamente.`);
    if (!ok) return;
    await DataService.deleteCustomFieldDef(field.id);
    await loadFields();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-subtle)',
    color: 'var(--fg-primary)',
    fontSize: 13,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    color: 'var(--fg-subtle)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '.04em',
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,.42)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 880,
        maxHeight: '86vh',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        boxShadow: '0 24px 70px rgba(0,0,0,.28)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-primary)', margin: 0 }}>Campos personalizados</h2>
            <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '3px 0 0' }}>Crie e edite campos extras para aparecerem no perfil dos leads.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" style={{ border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', padding: 6 }}>
            <X size={17} />
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: 18, display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) 1fr', gap: 18 }}>
          <form onSubmit={handleSubmit} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, alignSelf: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Nome visivel</label>
              <input value={label} onChange={e => handleLabelChange(e.target.value)} placeholder="Ex: Modelo de interesse" style={inputStyle} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Chave tecnica</label>
              <input
                value={name}
                onChange={e => setName(slugFieldName(e.target.value))}
                disabled={!!editingField}
                placeholder="modelo_interesse"
                style={{ ...inputStyle, opacity: editingField ? .65 : 1 }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Tipo</label>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', padding: '2px 8px', minHeight: 38, display: 'flex', alignItems: 'center' }}>
                  <CustomSelect
                    value={fieldType}
                    placeholder="Selecionar tipo"
                    options={FIELD_TYPES}
                    onChange={v => setFieldType(v as LeadCustomFieldDef['fieldType'])}
                  />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'end', gap: 8, fontSize: 12, color: 'var(--fg-muted)', paddingBottom: 9 }}>
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                Obrigatorio
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Ordem</label>
              <input
                type="number"
                value={sortOrder}
                onChange={e => setSortOrder(e.target.value)}
                placeholder="0"
                style={inputStyle}
              />
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--fg-muted)' }}>
              <input type="checkbox" checked={visible} onChange={e => setVisible(e.target.checked)} />
              Mostrar na ficha do lead
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={labelStyle}>Placeholder</label>
              <input value={placeholder} onChange={e => setPlaceholder(e.target.value)} placeholder="Texto de ajuda" style={inputStyle} />
            </div>

            {fieldType === 'select' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Opcoes</label>
                <textarea
                  value={optionsText}
                  onChange={e => setOptionsText(e.target.value)}
                  rows={4}
                  placeholder={'Uma opcao por linha\nEx: Hatch\nSUV\nPickup'}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={saving || !label.trim()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '9px 12px',
                borderRadius: 'var(--r-md)',
                border: 'none',
                background: 'var(--accent)',
                color: 'white',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                opacity: saving || !label.trim() ? .55 : 1,
              }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              {editingField ? 'Salvar alteracoes' : 'Criar campo'}
            </button>
            {editingField && (
              <button
                type="button"
                onClick={resetForm}
                style={{
                  padding: '8px 12px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--fg-muted)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancelar edicao
              </button>
            )}
          </form>

          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', alignSelf: 'start' }}>
            <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-muted)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-secondary)' }}>Campos existentes</span>
              <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{fields.length}</span>
            </div>
            <div style={{ maxHeight: 430, overflowY: 'auto' }}>
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} style={{ height: 54, borderBottom: '1px solid var(--border)', padding: 14 }}>
                    <div style={{ height: 12, width: '45%', background: 'var(--bg-muted)', borderRadius: 4 }} className="animate-pulse" />
                  </div>
                ))
              ) : fields.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>Nenhum campo criado ainda.</div>
              ) : fields.map(field => (
                <div key={field.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg-primary)' }}>
                      {field.label}
                      {!field.visible && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--fg-subtle)' }}>oculto</span>}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-subtle)', fontFamily: 'monospace' }}>
                      {field.name} - {FIELD_TYPES.find(type => type.value === field.fieldType)?.label ?? field.fieldType} - ordem {field.sortOrder}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button type="button" onClick={() => startEdit(field)} title="Editar campo" style={{ border: 'none', background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer', padding: 6 }}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" onClick={() => handleDelete(field)} title="Remover campo" style={{ border: 'none', background: 'transparent', color: 'var(--red-500)', cursor: 'pointer', padding: 6 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LeadRow: React.FC<{
  lead: Lead;
  formatDate: (iso: string | null) => string;
  onOpen: () => void;
}> = ({ lead, formatDate, onOpen }) => (
  <tr style={{ cursor: 'pointer' }} onClick={onOpen}>
    <td>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {lead.isHot && <Flame size={12} style={{ color: '#fb923c', flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 176 }}>
            {lead.name ?? <span style={{ color: 'var(--fg-subtle)', fontStyle: 'italic' }}>sem nome</span>}
          </p>
          <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 176 }}>{lead.email}</p>
        </div>
      </div>
    </td>
    <td style={{ color: 'var(--fg-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 144 }}>
      {lead.company ?? '—'}
    </td>
    <td><StatusBadge status={lead.status} /></td>
    <td style={{ fontSize: 12 }}>
      {(() => {
        const first = lead.firstConversionSource ?? lead.firstSource ?? '—';
        const last  = lead.lastConversionSource;
        return (
          <>
            <div style={{ color: 'var(--fg-muted)' }} title="Nome da primeira conversão do lead — não muda depois">
              Primeira: {first}
            </div>
            {last && last !== first && (
              <div style={{ color: 'var(--fg-subtle)', fontSize: 11, marginTop: 1 }} title="Nome da conversão mais recente">
                Última: {last}
              </div>
            )}
          </>
        );
      })()}
    </td>
    <td className="num" style={{ color: 'var(--fg-muted)', fontSize: 12 }}>{lead._count.conversions}</td>
    <td style={{ color: 'var(--fg-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{formatDate(lead.lastSeenAt)}</td>
    <td style={{ textAlign: 'center' }}>
      <ExternalLink size={13} style={{ color: 'var(--fg-subtle)' }} />
    </td>
  </tr>
);

export default LeadHubView;
