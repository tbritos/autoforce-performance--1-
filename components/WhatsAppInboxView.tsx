import React, { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Search, RefreshCw, ExternalLink, CheckCheck } from 'lucide-react';
import { DataService } from '../services/dataService';
import type { WhatsAppConversationMessage, WhatsAppInboxConversation } from '../types';
import { useNavigate } from 'react-router-dom';

const fmtTime = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const fmtDay = (value: string) => new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

export default function WhatsAppInboxView() {
  const navigate = useNavigate();
  const [items, setItems] = useState<WhatsAppInboxConversation[]>([]);
  const [selected, setSelected] = useState<WhatsAppInboxConversation | null>(null);
  const [messages, setMessages] = useState<WhatsAppConversationMessage[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'unread'>('all');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try { setItems(await DataService.getWhatsAppInbox()); } finally { setLoading(false); }
  };
  useEffect(() => { load().catch(() => setLoading(false)); const timer = window.setInterval(() => load().catch(() => {}), 10000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!selected?.leadId) { setMessages([]); return; }
    DataService.getWhatsAppConversation(selected.leadId).then(all => setMessages(all.filter(message => (message.phoneNumberId ?? null) === (selected.phoneNumberId ?? null)))).catch(() => setMessages([]));
  }, [selected?.leadId]);

  const filtered = useMemo(() => items.filter(item => {
    const text = `${item.name} ${item.email ?? ''} ${item.phone}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (filter === 'all' || (filter === 'open' && item.open) || (filter === 'unread' && item.unreadCount > 0));
  }), [items, query, filter]);

  return <div style={{ padding: 24, height: 'calc(100vh - 72px)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div><h1 style={{ margin: 0, fontSize: 24, color: 'var(--fg-primary)' }}>WhatsApp</h1><p style={{ margin: '5px 0 0', color: 'var(--fg-muted)', fontSize: 13 }}>Central de conversas e atendimento</p></div>
      <button onClick={() => { setLoading(true); load(); }} style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'var(--fg-muted)', display: 'flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar</button>
    </div>
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) 1fr', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)' }}>
      <aside style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}><Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--fg-muted)' }} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar conversas" style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px 9px 32px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-muted)', color: 'var(--fg-primary)' }} /></div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}><button onClick={() => setFilter('all')} style={pill(filter === 'all')}>Todas</button><button onClick={() => setFilter('open')} style={pill(filter === 'open')}>Em andamento</button><button onClick={() => setFilter('unread')} style={pill(filter === 'unread')}>Não lidas</button></div>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>{filtered.map(item => <button key={item.key} onClick={() => setSelected(item)} style={{ width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid var(--border)', background: selected?.key === item.key ? 'var(--bg-muted)' : 'transparent', padding: '13px 14px', cursor: 'pointer', display: 'flex', gap: 10 }}>
          <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#d9fdd3', color: '#167c3a', display: 'grid', placeItems: 'center', flexShrink: 0 }}><MessageCircle size={18} /></span><span style={{ minWidth: 0, flex: 1 }}><span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--fg-primary)', fontSize: 13 }}>{item.name}</strong><small style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>{fmtDay(item.latestAt)}</small></span><span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}><span style={{ color: 'var(--fg-muted)', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.latestDirection === 'outbound' ? 'Você: ' : ''}{item.latestMessage}</span>{item.unreadCount > 0 && <b style={{ background: '#25d366', color: '#fff', borderRadius: 99, minWidth: 18, height: 18, display: 'grid', placeItems: 'center', fontSize: 10 }}>{item.unreadCount}</b>}</span></span>
          <span style={{ marginLeft: 48, marginTop: -8, display: 'block', color: '#128c7e', fontSize: 10, fontWeight: 700 }}>{item.phoneNumberLabel || item.phoneNumberDisplay || 'Número principal'}</span>
        </button>)}{!loading && filtered.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: 'var(--fg-muted)', fontSize: 13 }}>Nenhuma conversa encontrada.</div>}</div>
      </aside>
      <main style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#ece5dd' }}>
        {!selected ? <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: '#667781', background: '#f5f7f8' }}><div style={{ textAlign: 'center' }}><MessageCircle size={42} style={{ opacity: .35 }} /><p>Selecione uma conversa para visualizar</p></div></div> : <><header style={{ padding: '13px 18px', background: '#f0f2f5', borderBottom: '1px solid #d8dde0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><strong style={{ color: '#202c33' }}>{selected.name}</strong><div style={{ fontSize: 12, color: '#667781', marginTop: 3 }}>{selected.phone}{selected.email ? ` · ${selected.email}` : ''}</div><div style={{ color: '#128c7e', fontSize: 11, fontWeight: 700, marginTop: 3 }}>{selected.phoneNumberLabel || selected.phoneNumberDisplay || 'Número principal'}</div></div>{selected.leadId && <button onClick={() => navigate(`/leads/${selected.leadId}`)} style={{ border: 0, background: 'transparent', color: '#128c7e', cursor: 'pointer', display: 'flex', gap: 5, alignItems: 'center', fontWeight: 600, fontSize: 12 }}>Abrir lead <ExternalLink size={13} /></button>}</header><div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px' }}>{messages.map(msg => { const out = msg.direction === 'outbound'; return <div key={msg.id} style={{ display: 'flex', justifyContent: out ? 'flex-end' : 'flex-start', marginBottom: 7 }}><div style={{ maxWidth: '72%', background: out ? '#d9fdd3' : '#fff', borderRadius: out ? '8px 0 8px 8px' : '0 8px 8px 8px', padding: '8px 10px 5px', boxShadow: '0 1px 1px #0001' }}><div style={{ fontSize: 13, color: '#202c33', whiteSpace: 'pre-wrap' }}>{msg.text || (msg.templateName ? `📋 ${msg.templateName}` : `(${msg.type})`)}</div><div style={{ textAlign: 'right', color: '#667781', fontSize: 10, marginTop: 3 }}>{fmtTime(msg.sentAt ?? msg.receivedAt ?? msg.createdAt)} {out && <CheckCheck size={12} style={{ verticalAlign: 'middle', color: msg.status === 'read' ? '#53bdeb' : undefined }} />}</div></div></div>})}</div></>}
      </main>
    </div>
  </div>;
}

function pill(active: boolean): React.CSSProperties { return { border: 0, borderRadius: 99, padding: '5px 9px', fontSize: 11, cursor: 'pointer', background: active ? '#d9fdd3' : 'var(--bg-muted)', color: active ? '#167c3a' : 'var(--fg-muted)', fontWeight: active ? 700 : 500 }; }
