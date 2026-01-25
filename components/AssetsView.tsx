import React, { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Link2, Copy, Tag, Search, Plus, Layers } from 'lucide-react';
import { DataService } from '../services/dataService';
import { AssetItem, AssetVersion } from '../types';

const AssetsView: React.FC = () => {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetItem['category']>('LP');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [versionLink, setVersionLink] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'Todos' | AssetItem['category']>('Todos');
  const [tagFilter, setTagFilter] = useState('');

  const [versionDraftId, setVersionDraftId] = useState<string | null>(null);
  const [versionDraftLabel, setVersionDraftLabel] = useState('');
  const [versionDraftLink, setVersionDraftLink] = useState('');
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState('');
  const [editingLink, setEditingLink] = useState('');

  const parseTags = (value: string) =>
    value
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

  const filteredAssets = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const filterTags = parseTags(tagFilter.toLowerCase());
    return assets.filter(asset => {
      const matchesCategory = categoryFilter === 'Todos' || asset.category === categoryFilter;
      const matchesSearch =
        asset.name.toLowerCase().includes(searchLower) ||
        asset.link.toLowerCase().includes(searchLower) ||
        asset.notes.toLowerCase().includes(searchLower) ||
        asset.tags.some(tag => tag.toLowerCase().includes(searchLower)) ||
        asset.versions.some(version =>
          version.label.toLowerCase().includes(searchLower) ||
          version.link.toLowerCase().includes(searchLower)
        );

      const matchesTags =
        filterTags.length === 0 ||
        filterTags.some(tag => asset.tags.map(t => t.toLowerCase()).includes(tag));

      return matchesCategory && matchesSearch && matchesTags;
    });
  }, [assets, searchTerm, categoryFilter, tagFilter]);

  useEffect(() => {
    const loadAssets = async () => {
      setLoading(true);
      try {
        const data = await DataService.getAssets();
        setAssets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(error);
        setAssets([]);
      } finally {
        setLoading(false);
      }
    };
    loadAssets();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !link.trim()) return;

    const tags = parseTags(tagsInput);
    const now = new Date().toISOString().split('T')[0];
    const versions: AssetVersion[] = versionLabel.trim() && versionLink.trim()
      ? [{ id: `${Date.now()}-ver`, label: versionLabel.trim(), link: versionLink.trim(), createdAt: now }]
      : [];

    try {
      const created = await DataService.createAsset({
        name: name.trim(),
        category,
        link: link.trim(),
        notes: notes.trim(),
        tags,
        versions,
      });
      setAssets(prev => [created, ...prev]);
      setName('');
      setCategory('LP');
      setLink('');
      setNotes('');
      setTagsInput('');
      setVersionLabel('');
      setVersionLink('');
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopy = (value: string) => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
  };

  const openVersionForm = (id: string) => {
    setVersionDraftId(id);
    setVersionDraftLabel('');
    setVersionDraftLink('');
  };

  const openEditVersion = (versionId: string, label: string, link: string) => {
    setEditingVersionId(versionId);
    setEditingLabel(label);
    setEditingLink(link);
  };

  const saveVersion = async (id: string) => {
    if (!versionDraftLabel.trim() || !versionDraftLink.trim()) return;
    try {
      const created = await DataService.addAssetVersion(id, {
        label: versionDraftLabel.trim(),
        link: versionDraftLink.trim(),
      });
      setAssets(prev =>
        prev.map(asset => {
          if (asset.id !== id) return asset;
          return { ...asset, versions: [created, ...asset.versions] };
        })
      );
      setVersionDraftId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const saveEditedVersion = async (assetId: string, versionId: string) => {
    if (!editingLabel.trim() || !editingLink.trim()) return;
    try {
      const updated = await DataService.updateAssetVersion(assetId, versionId, {
        label: editingLabel.trim(),
        link: editingLink.trim(),
      });
      setAssets(prev =>
        prev.map(asset => {
          if (asset.id !== assetId) return asset;
          return {
            ...asset,
            versions: asset.versions.map(version =>
              version.id === versionId ? updated : version
            ),
          };
        })
      );
      setEditingVersionId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const deleteVersion = async (assetId: string, versionId: string) => {
    try {
      await DataService.deleteAssetVersion(assetId, versionId);
      setAssets(prev =>
        prev.map(asset => {
          if (asset.id !== assetId) return asset;
          return {
            ...asset,
            versions: asset.versions.filter(version => version.id !== versionId),
          };
        })
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <FolderOpen className="text-autoforce-blue" />
            Biblioteca de Ativos
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Tags, busca avancada e versoes para organizar materiais do time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAddForm(prev => !prev)}
          className="inline-flex items-center gap-2 bg-autoforce-blue/20 border border-autoforce-blue/40 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-autoforce-blue/30 transition"
        >
          <Plus size={16} />
          {showAddForm ? 'Fechar' : 'Adicionar ativo'}
        </button>
      </div>

      <div className={`grid grid-cols-1 ${showAddForm ? 'lg:grid-cols-3' : 'lg:grid-cols-1'} gap-6`}>
        <div className={`${showAddForm ? 'lg:col-span-2' : 'lg:col-span-1'} bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6 space-y-6`}>
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-autoforce-lightGrey" size={16} />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded pl-9 pr-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                placeholder="Buscar por nome, link, tag ou observacao"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
              className="bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
            >
              <option value="Todos">Todas categorias</option>
              <option value="LP">LP</option>
              <option value="Criativo">Criativo</option>
              <option value="Copy">Copy</option>
              <option value="UTM">UTM</option>
              <option value="Outro">Outro</option>
            </select>
            <input
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
              placeholder="Filtrar por tag (ex: meta,lp)"
            />
          </div>

            <div>
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Link2 size={18} className="text-autoforce-accent" />
                Itens recentes
              </h3>
              <div className="space-y-4">
              {loading ? (
                <div className="text-sm text-autoforce-lightGrey">Carregando ativos...</div>
              ) : filteredAssets.length === 0 ? (
                <div className="text-sm text-autoforce-lightGrey">Nenhum ativo encontrado.</div>
              ) : (
                filteredAssets.map(item => (
                  <div key={item.id} className="border border-autoforce-grey/20 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-white font-semibold">{item.name}</p>
                        <p className="text-xs text-autoforce-lightGrey">{item.category}</p>
                      </div>
                      <button
                        className="text-xs text-autoforce-blue hover:text-autoforce-secondary flex items-center gap-1"
                        onClick={() => handleCopy(item.link)}
                      >
                        <Copy size={12} />
                        Copiar
                      </button>
                    </div>

                    <p className="text-xs text-autoforce-lightGrey break-all">{item.link}</p>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {item.tags.map(tag => (
                          <span key={tag} className="text-[10px] uppercase tracking-wider bg-white/5 text-autoforce-lightGrey px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {item.notes && <p className="text-xs text-autoforce-grey">{item.notes}</p>}

                    <div className="border-t border-autoforce-grey/10 pt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey">
                          <Layers size={14} className="text-autoforce-blue" />
                          <span>Versoes ({item.versions.length})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => openVersionForm(item.id)}
                          className="text-xs text-autoforce-blue hover:text-autoforce-secondary flex items-center gap-1"
                        >
                          <Plus size={12} />
                          Adicionar versao
                        </button>
                      </div>

                      {item.versions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {item.versions.map(version => (
                            <div key={version.id} className="flex items-center justify-between text-xs">
                              {editingVersionId === version.id ? (
                                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    value={editingLabel}
                                    onChange={(e) => setEditingLabel(e.target.value)}
                                    className="bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white text-xs focus:border-autoforce-blue focus:outline-none"
                                  />
                                  <input
                                    value={editingLink}
                                    onChange={(e) => setEditingLink(e.target.value)}
                                    className="bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white text-xs focus:border-autoforce-blue focus:outline-none"
                                  />
                                  <div className="flex justify-end md:col-span-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingVersionId(null)}
                                      className="text-autoforce-lightGrey hover:text-white text-xs"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => saveEditedVersion(item.id, version.id)}
                                      className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-3 py-1.5 rounded text-xs font-bold"
                                    >
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="text-white font-semibold">
                                    {version.label} <span className="text-autoforce-grey">({version.createdAt})</span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      className="text-autoforce-lightGrey hover:text-white flex items-center gap-1"
                                      onClick={() => handleCopy(version.link)}
                                    >
                                      <Copy size={12} />
                                      Copiar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditVersion(version.id, version.label, version.link)}
                                      className="text-autoforce-blue hover:text-autoforce-secondary"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => deleteVersion(item.id, version.id)}
                                      className="text-red-400 hover:text-red-300"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {versionDraftId === item.id && (
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <input
                            value={versionDraftLabel}
                            onChange={(e) => setVersionDraftLabel(e.target.value)}
                            className="bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white text-xs focus:border-autoforce-blue focus:outline-none"
                            placeholder="Ex: v2 - headline nova"
                          />
                          <input
                            value={versionDraftLink}
                            onChange={(e) => setVersionDraftLink(e.target.value)}
                            className="bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white text-xs focus:border-autoforce-blue focus:outline-none"
                            placeholder="Link da versao"
                          />
                          <div className="flex justify-end md:col-span-2">
                            <button
                              type="button"
                              onClick={() => saveVersion(item.id)}
                              className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-4 py-1.5 rounded text-xs font-bold"
                            >
                              Salvar versao
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              </div>
            </div>
        </div>

        {showAddForm && (
          <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Tag size={18} className="text-autoforce-blue" />
              Adicionar ativo
            </h3>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                  Nome
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                  placeholder="Ex: LP Black Friday"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                  Categoria
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AssetItem['category'])}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                >
                  <option value="LP">LP</option>
                  <option value="Criativo">Criativo</option>
                  <option value="Copy">Copy</option>
                  <option value="UTM">UTM</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                  Link ou identificador
                </label>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                  placeholder="Cole a URL ou a UTM"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                  Tags (separe por virgula)
                </label>
                <input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                  placeholder="Ex: meta,lp,fevereiro"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                  Observacoes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm min-h-[90px]"
                  placeholder="Detalhes do ativo, status, objetivo..."
                />
              </div>
              <div className="border-t border-autoforce-grey/10 pt-4 space-y-3">
                <p className="text-xs text-autoforce-lightGrey uppercase tracking-wider">Versao inicial (opcional)</p>
                <input
                  value={versionLabel}
                  onChange={(e) => setVersionLabel(e.target.value)}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                  placeholder="Label da versao (ex: v1)"
                />
                <input
                  value={versionLink}
                  onChange={(e) => setVersionLink(e.target.value)}
                  className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                  placeholder="Link da versao"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-5 py-2 rounded text-sm font-bold"
                >
                  Salvar ativo
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssetsView;
