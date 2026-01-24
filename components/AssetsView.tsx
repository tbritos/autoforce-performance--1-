import React, { useState } from 'react';
import { FolderOpen, Link2, Copy, Tag } from 'lucide-react';

type AssetItem = {
  id: string;
  name: string;
  category: 'LP' | 'Criativo' | 'Copy' | 'UTM' | 'Outro';
  link: string;
  notes: string;
};

const initialAssets: AssetItem[] = [
  {
    id: 'asset-1',
    name: 'LP Feirao SUVs',
    category: 'LP',
    link: 'https://autoforce.com.br/feirao-suv',
    notes: 'Landing page principal da campanha de fevereiro.',
  },
  {
    id: 'asset-2',
    name: 'UTM Meta Feirao',
    category: 'UTM',
    link: 'utm_source=meta&utm_medium=cpc&utm_campaign=feirao_suv',
    notes: 'Padrao de UTM para anuncios no Meta.',
  },
];

const AssetsView: React.FC = () => {
  const [assets, setAssets] = useState<AssetItem[]>(initialAssets);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetItem['category']>('LP');
  const [link, setLink] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !link.trim()) return;
    const item: AssetItem = {
      id: `${Date.now()}`,
      name: name.trim(),
      category,
      link: link.trim(),
      notes: notes.trim(),
    };
    setAssets(prev => [item, ...prev]);
    setName('');
    setCategory('LP');
    setLink('');
    setNotes('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <FolderOpen className="text-autoforce-blue" />
            Biblioteca de Ativos
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Links de LPs, criativos, copys e UTMs em um unico lugar.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Link2 size={18} className="text-autoforce-accent" />
            Itens recentes
          </h3>
          <div className="space-y-3">
            {assets.map(item => (
              <div key={item.id} className="border border-autoforce-grey/20 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-white font-semibold">{item.name}</p>
                    <p className="text-xs text-autoforce-lightGrey">{item.category}</p>
                  </div>
                  <button
                    className="text-xs text-autoforce-blue hover:text-autoforce-secondary flex items-center gap-1"
                    onClick={() => navigator.clipboard?.writeText(item.link)}
                  >
                    <Copy size={12} />
                    Copiar
                  </button>
                </div>
                <p className="text-xs text-autoforce-lightGrey mt-2 break-all">{item.link}</p>
                {item.notes && <p className="text-xs text-autoforce-grey mt-2">{item.notes}</p>}
              </div>
            ))}
          </div>
        </div>

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
                Observacoes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm min-h-[90px]"
                placeholder="Detalhes do ativo, status, objetivo..."
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
      </div>
    </div>
  );
};

export default AssetsView;
