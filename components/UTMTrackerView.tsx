import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Star,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  ExternalLink,
  Filter,
  Bookmark,
  X,
} from 'lucide-react';
import { UTMLink, UTMLinkListResult, UTMCampaignPicker, UTMDestination, UTM_SOURCES, UTM_MEDIUMS } from '../types';
import { DataService } from '../services/dataService';

// ─── Source / medium labels ───────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn',
  google: 'Google', youtube: 'YouTube', tiktok: 'TikTok',
  whatsapp: 'WhatsApp', email: 'E-mail', wordpress: 'WordPress', direto: 'Direto',
};

const MEDIUM_LABELS: Record<string, string> = {
  organico: 'Orgânico', pago: 'Pago', stories: 'Stories', reels: 'Reels',
  feed: 'Feed', carrossel: 'Carrossel', display: 'Display',
  email: 'E-mail', cpc: 'CPC', video: 'Vídeo', blog: 'Blog',
};

const BACKEND_URL = (import.meta.env.VITE_API_URL as string || 'http://localhost:5000/api').replace(/\/api$/, '');

// ─── Copy hook ────────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);
  return { copied, copy };
}

// ─── UTM Builder form ─────────────────────────────────────────────────────────

interface BuilderState {
  destinationUrl: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
  title: string;
  campaignId: string;
}

const EMPTY_BUILDER: BuilderState = {
  destinationUrl: '', utmSource: '', utmMedium: '', utmCampaign: '',
  utmContent: '', utmTerm: '', title: '', campaignId: '',
};

function buildPreviewUrl(state: BuilderState): string {
  if (!state.destinationUrl || !state.utmSource || !state.utmMedium || !state.utmCampaign) return '';
  try {
    const url = new URL(state.destinationUrl);
    if (state.utmSource)   url.searchParams.set('utm_source',   state.utmSource);
    if (state.utmMedium)   url.searchParams.set('utm_medium',   state.utmMedium);
    if (state.utmCampaign) url.searchParams.set('utm_campaign', state.utmCampaign);
    if (state.utmContent)  url.searchParams.set('utm_content',  state.utmContent);
    if (state.utmTerm)     url.searchParams.set('utm_term',     state.utmTerm);
    return url.toString();
  } catch {
    return '';
  }
}

const SelectField: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  options: readonly string[]; labels: Record<string, string>; required?: boolean;
}> = ({ label, value, onChange, options, labels, required }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-autoforce-lightGrey font-medium">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-autoforce-grey/50 appearance-none"
    >
      <option value="">Selecionar...</option>
      {options.map(o => (
        <option key={o} value={o}>{labels[o] ?? o}</option>
      ))}
    </select>
  </div>
);

const TextField: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; mono?: boolean;
}> = ({ label, value, onChange, placeholder, required, mono }) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs text-autoforce-lightGrey font-medium">
      {label}{required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-autoforce-grey/50 focus:outline-none focus:border-autoforce-grey/50 ${mono ? 'font-mono' : ''}`}
    />
  </div>
);

const UTMBuilder: React.FC<{
  campaigns: UTMCampaignPicker[];
  destinations: UTMDestination[];
  onCreated: (link: UTMLink) => void;
  onDestinationAdded: (dest: UTMDestination) => void;
  onDestinationDeleted: (id: string) => void;
}> = ({ campaigns, destinations, onCreated, onDestinationAdded, onDestinationDeleted }) => {
  const [form, setForm]               = useState<BuilderState>(EMPTY_BUILDER);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [saveDestLabel, setSaveDestLabel] = useState('');
  const [savingDest, setSavingDest]   = useState(false);
  const { copied, copy }              = useCopy();

  const preview = useMemo(() => buildPreviewUrl(form), [form]);
  const set = (key: keyof BuilderState) => (val: string) =>
    setForm(f => ({ ...f, [key]: val }));

  const handleSaveDestination = async () => {
    if (!form.destinationUrl || !saveDestLabel.trim()) return;
    setSavingDest(true);
    try {
      const dest = await DataService.createUTMDestination({ label: saveDestLabel.trim(), url: form.destinationUrl });
      onDestinationAdded(dest);
      setSaveDestLabel('');
    } catch { /* ignore */ } finally {
      setSavingDest(false);
    }
  };

  const handleSave = async () => {
    if (!form.destinationUrl || !form.utmSource || !form.utmMedium || !form.utmCampaign) {
      setError('Preencha URL, origem, mídia e campanha');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const link = await DataService.createUTMLink({
        destinationUrl: form.destinationUrl,
        utmSource:      form.utmSource,
        utmMedium:      form.utmMedium,
        utmCampaign:    form.utmCampaign,
        utmContent:     form.utmContent  || undefined,
        utmTerm:        form.utmTerm     || undefined,
        title:          form.title       || undefined,
        campaignId:     form.campaignId  || undefined,
      });
      onCreated(link);
      setForm(EMPTY_BUILDER);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar link');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-5 flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link2 size={15} className="text-autoforce-lightGrey" />
        <h2 className="text-sm font-semibold text-white">Criar Link Rastreado</h2>
      </div>

      {/* Destinos salvos */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-autoforce-lightGrey font-medium flex items-center gap-1.5">
          <Bookmark size={12} /> Destinos salvos
        </p>
        {destinations.length === 0 ? (
          <p className="text-xs text-autoforce-grey/60 italic">
            Nenhum destino salvo ainda. Preencha a URL abaixo e clique em "Salvar destino".
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {destinations.map(d => (
              <div
                key={d.id}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition cursor-pointer
                  ${form.destinationUrl === d.url
                    ? 'border-blue-500/60 bg-blue-500/10 text-blue-300'
                    : 'border-autoforce-grey/20 text-autoforce-lightGrey hover:border-autoforce-grey/40 hover:text-white'}`}
                onClick={() => setForm(f => ({ ...f, destinationUrl: d.url }))}
                title={d.url}
              >
                <span className="max-w-40 truncate">{d.label}</span>
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); onDestinationDeleted(d.id); }}
                  className="shrink-0 opacity-50 hover:opacity-100 transition"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* URL de destino + botão salvar destino */}
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-xs text-autoforce-lightGrey font-medium">
            URL de destino<span className="text-red-400 ml-0.5">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={form.destinationUrl}
              onChange={e => set('destinationUrl')(e.target.value)}
              placeholder="https://autoforce.com/..."
              className="flex-1 bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-autoforce-grey/50 focus:outline-none focus:border-autoforce-grey/50 font-mono"
            />
            {form.destinationUrl && (
              <div className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={saveDestLabel}
                  onChange={e => setSaveDestLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveDestination(); }}
                  placeholder="Nome do destino"
                  className="w-36 bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-2.5 py-2 text-xs text-white placeholder:text-autoforce-grey/50 focus:outline-none focus:border-autoforce-grey/50"
                />
                <button
                  type="button"
                  onClick={handleSaveDestination}
                  disabled={savingDest || !saveDestLabel.trim()}
                  title="Salvar destino"
                  className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-autoforce-grey/20 text-xs text-autoforce-lightGrey hover:text-white hover:border-autoforce-grey/40 disabled:opacity-40 transition whitespace-nowrap"
                >
                  <Bookmark size={11} /> Salvar destino
                </button>
              </div>
            )}
          </div>
        </div>

        <SelectField
          label="Origem (utm_source)" value={form.utmSource}
          onChange={set('utmSource')} options={UTM_SOURCES} labels={SOURCE_LABELS} required
        />
        <SelectField
          label="Mídia (utm_medium)" value={form.utmMedium}
          onChange={set('utmMedium')} options={UTM_MEDIUMS} labels={MEDIUM_LABELS} required
        />

        {/* Campaign: select from DB or type free */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-autoforce-lightGrey font-medium">
            Campanha (utm_campaign)<span className="text-red-400 ml-0.5">*</span>
          </label>
          {campaigns.length > 0 ? (
            <select
              value={form.campaignId ? form.campaignId : form.utmCampaign}
              onChange={e => {
                const selected = campaigns.find(c => c.id === e.target.value);
                if (selected) {
                  setForm(f => ({
                    ...f,
                    campaignId:  selected.id,
                    utmCampaign: selected.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                  }));
                } else {
                  setForm(f => ({ ...f, campaignId: '', utmCampaign: e.target.value }));
                }
              }}
              className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-autoforce-grey/50 appearance-none"
            >
              <option value="">Digitar livremente...</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={form.utmCampaign}
              onChange={e => set('utmCampaign')(e.target.value)}
              placeholder="ex: campanha-maio-2026"
              className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-autoforce-grey/50 focus:outline-none focus:border-autoforce-grey/50 font-mono"
            />
          )}
          {form.campaignId && (
            <input
              type="text"
              value={form.utmCampaign}
              onChange={e => set('utmCampaign')(e.target.value)}
              placeholder="slug da campanha"
              className="mt-1 bg-autoforce-darkest border border-autoforce-grey/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-autoforce-grey/50 focus:outline-none focus:border-autoforce-grey/50 font-mono"
            />
          )}
        </div>

        <TextField
          label="Conteúdo (utm_content)" value={form.utmContent}
          onChange={set('utmContent')} placeholder="ex: post-carrossel-maio"
        />
        <TextField
          label="Título interno" value={form.title}
          onChange={set('title')} placeholder="ex: Campanha maio — Instagram Stories"
        />
        <TextField
          label="Termo (utm_term)" value={form.utmTerm}
          onChange={set('utmTerm')} placeholder="ex: concessionaria-sp"
        />
      </div>

      {/* Preview */}
      {preview && (
        <div className="flex flex-col gap-2 p-3 bg-white/[0.02] rounded-lg border border-autoforce-grey/15">
          <p className="text-xs text-autoforce-lightGrey font-medium">Link gerado:</p>
          <p className="text-xs text-white font-mono break-all leading-relaxed">{preview}</p>
          <button
            type="button"
            onClick={() => copy(preview, 'preview')}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition"
          >
            {copied === 'preview' ? <Check size={12} /> : <Copy size={12} />}
            {copied === 'preview' ? 'Copiado!' : 'Copiar link'}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex items-center justify-between">
        {Object.values(form).some(v => v !== '') ? (
          <button
            type="button"
            onClick={() => setForm(EMPTY_BUILDER)}
            className="text-xs text-autoforce-grey hover:text-autoforce-lightGrey transition"
          >
            Limpar formulário
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !preview}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition"
        >
          {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
          Salvar na biblioteca
        </button>
      </div>
    </div>
  );
};

// ─── Link library row ─────────────────────────────────────────────────────────

const LinkRow: React.FC<{
  link: UTMLink;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}> = ({ link, copied, onCopy, onFavorite, onDelete }) => {
  const trackingUrl = link.shortCode ? `${BACKEND_URL}/r/${link.shortCode}` : null;
  const copyUrl = trackingUrl ?? link.fullUrl;
  return (
    <tr className="border-b border-autoforce-grey/10 hover:bg-white/[0.02] transition-colors group">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onFavorite(link.id)}
            className={`shrink-0 transition ${link.isFavorite ? 'text-yellow-400' : 'text-autoforce-grey/30 hover:text-autoforce-grey'}`}
          >
            <Star size={13} fill={link.isFavorite ? 'currentColor' : 'none'} />
          </button>
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate max-w-48">
              {link.title ?? link.utmCampaign}
            </p>
            <p className="text-autoforce-grey text-xs truncate max-w-48 font-mono">
              {trackingUrl ?? link.destinationUrl}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-autoforce-lightGrey">{SOURCE_LABELS[link.utmSource] ?? link.utmSource}</td>
      <td className="px-4 py-3 text-xs text-autoforce-lightGrey">{MEDIUM_LABELS[link.utmMedium] ?? link.utmMedium}</td>
      <td className="px-4 py-3 text-xs text-autoforce-lightGrey font-mono truncate max-w-32">{link.utmCampaign}</td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium ${link.clicks > 0 ? 'text-blue-400' : 'text-autoforce-lightGrey'}`}>
          {link.clicks}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-autoforce-grey whitespace-nowrap">
        {new Date(link.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            title={trackingUrl ? 'Copiar link de rastreamento' : 'Copiar link'}
            onClick={() => onCopy(copyUrl, link.id)}
            className="p-1.5 rounded hover:bg-white/5 text-autoforce-lightGrey hover:text-white transition"
          >
            {copied === link.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
          </button>
          <a
            href={link.fullUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir link com UTMs"
            className="p-1.5 rounded hover:bg-white/5 text-autoforce-lightGrey hover:text-white transition"
          >
            <ExternalLink size={13} />
          </a>
          <button
            type="button"
            title="Remover"
            onClick={() => { if (window.confirm('Remover este link da biblioteca?')) onDelete(link.id); }}
            className="p-1.5 rounded hover:bg-red-500/10 text-autoforce-grey hover:text-red-400 transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
};

// ─── Main view ────────────────────────────────────────────────────────────────

const UTMTrackerView: React.FC = () => {
  const [result, setResult]             = useState<UTMLinkListResult | null>(null);
  const [destinations, setDestinations] = useState<UTMDestination[]>([]);
  const [campaigns, setCampaigns]       = useState<UTMCampaignPicker[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [mediumFilter, setMediumFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const { copied, copy }                = useCopy();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, sourceFilter, mediumFilter]);

  const loadLinks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await DataService.listUTMLinks({
        search:    debouncedSearch || undefined,
        utmSource: sourceFilter   || undefined,
        utmMedium: mediumFilter   || undefined,
        page,
        pageSize: 20,
      });
      setResult(res);
    } catch (err) {
      console.error('Erro ao carregar UTM links:', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, sourceFilter, mediumFilter, page]);

  useEffect(() => {
    Promise.all([
      DataService.listUTMDestinations(),
      DataService.listUTMCampaigns(),
    ]).then(([d, c]) => {
      setDestinations(d);
      setCampaigns(c);
    }).catch(console.error);
  }, []);

  useEffect(() => { loadLinks(); }, [loadLinks]);

  const handleCreated = useCallback((_link: UTMLink) => {
    loadLinks();
  }, [loadLinks]);

  const handleFavorite = useCallback(async (id: string) => {
    try {
      await DataService.toggleUTMFavorite(id);
      setResult(prev => prev ? {
        ...prev,
        links: prev.links.map(l => l.id === id ? { ...l, isFavorite: !l.isFavorite } : l),
      } : prev);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await DataService.deleteUTMLink(id);
      setResult(prev => prev ? {
        ...prev,
        links: prev.links.filter(l => l.id !== id),
        total: prev.total - 1,
      } : prev);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const links = result?.links ?? [];
  const hasFilters = !!(debouncedSearch || sourceFilter || mediumFilter);

  return (
    <div className="flex flex-col gap-5 p-6 max-w-screen-xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">UTM Tracker</h1>
          <p className="text-sm text-autoforce-lightGrey mt-1">
            Crie e gerencie links rastreados com parâmetros UTM padronizados.
          </p>
        </div>
        <button
          type="button"
          onClick={loadLinks}
          disabled={loading}
          className="p-2 rounded-lg border border-autoforce-grey/20 text-autoforce-lightGrey hover:text-white hover:border-autoforce-grey/40 disabled:opacity-40 transition"
          aria-label="Recarregar"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Builder */}
      <UTMBuilder
        campaigns={campaigns}
        destinations={destinations}
        onCreated={handleCreated}
        onDestinationAdded={dest => setDestinations(prev => [dest, ...prev])}
        onDestinationDeleted={async id => {
          await DataService.deleteUTMDestination(id).catch(console.error);
          setDestinations(prev => prev.filter(d => d.id !== id));
        }}
      />

      {/* Library */}
      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden">
        {/* Library header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-autoforce-grey/15 flex-wrap">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-autoforce-lightGrey" />
            <span className="text-sm font-semibold text-white">Biblioteca</span>
            {result && (
              <span className="text-xs text-autoforce-grey">{result.total.toLocaleString('pt-BR')} links</span>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-autoforce-lightGrey" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-7 pr-3 py-1.5 bg-white/5 border border-autoforce-grey/20 rounded-lg text-xs text-white placeholder:text-autoforce-grey focus:outline-none focus:border-autoforce-grey/40 w-44"
              />
            </div>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="bg-white/5 border border-autoforce-grey/20 rounded-lg px-2 py-1.5 text-xs text-autoforce-lightGrey focus:outline-none"
            >
              <option value="">Todas origens</option>
              {UTM_SOURCES.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
            </select>
            <select
              value={mediumFilter}
              onChange={e => setMediumFilter(e.target.value)}
              className="bg-white/5 border border-autoforce-grey/20 rounded-lg px-2 py-1.5 text-xs text-autoforce-lightGrey focus:outline-none"
            >
              <option value="">Todas mídias</option>
              {UTM_MEDIUMS.map(m => <option key={m} value={m}>{MEDIUM_LABELS[m]}</option>)}
            </select>
            {hasFilters && (
              <button
                type="button"
                onClick={() => { setSearch(''); setSourceFilter(''); setMediumFilter(''); }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-autoforce-grey/20 text-xs text-autoforce-lightGrey hover:text-white transition"
              >
                <Filter size={11} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-autoforce-grey/10">
                {['Link', 'Origem', 'Mídia', 'Campanha', 'Cliques', 'Data', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-autoforce-lightGrey uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-autoforce-grey/10">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 bg-autoforce-grey/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Link2 size={32} className="mx-auto mb-3 text-autoforce-grey/30" />
                    <p className="text-autoforce-lightGrey text-sm">
                      {hasFilters ? 'Nenhum link encontrado com esses filtros' : 'Nenhum link criado ainda'}
                    </p>
                  </td>
                </tr>
              ) : (
                links.map(link => (
                  <LinkRow
                    key={link.id}
                    link={link}
                    copied={copied}
                    onCopy={copy}
                    onFavorite={handleFavorite}
                    onDelete={handleDelete}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {result && result.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-autoforce-grey/15">
            <span className="text-xs text-autoforce-lightGrey">
              {((page - 1) * 20) + 1}–{Math.min(page * 20, result.total)} de {result.total.toLocaleString('pt-BR')}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded border border-autoforce-grey/20 text-autoforce-lightGrey hover:text-white disabled:opacity-30 transition"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(result.totalPages, p + 1))}
                disabled={page === result.totalPages}
                className="p-1.5 rounded border border-autoforce-grey/20 text-autoforce-lightGrey hover:text-white disabled:opacity-30 transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UTMTrackerView;
