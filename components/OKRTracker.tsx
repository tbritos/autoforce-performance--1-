
import React, { useState, useEffect } from 'react';
import { OKR, Quarter, KeyResult } from '../types';
import { DataService } from '../services/dataService';
import { Target, Plus, CheckCircle2, Circle, TrendingUp, Save, Trash2, X } from 'lucide-react';

const OKRTracker: React.FC = () => {
  const [okrs, setOkrs] = useState<OKR[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState<Quarter>('Q1 2026');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form States
  const [newObjective, setNewObjective] = useState('');
  const [newKRs, setNewKRs] = useState<{title: string, target: string, unit: string}[]>([
      { title: '', target: '', unit: '#' }
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await DataService.getOKRs();
    setOkrs(data);
    setLoading(false);
  };

  const quarters: Quarter[] = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];

  const handleAddKRField = () => {
      setNewKRs([...newKRs, { title: '', target: '', unit: '#' }]);
  };

  const handleRemoveKRField = (index: number) => {
      setNewKRs(newKRs.filter((_, i) => i !== index));
  };

  const handleKRChange = (index: number, field: string, value: string) => {
      const updated = [...newKRs];
      updated[index] = { ...updated[index], [field]: value };
      setNewKRs(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newObjective.trim()) return;

      const keyResults: KeyResult[] = newKRs
        .filter(k => k.title.trim() !== '')
        .map((k, i) => ({
            id: `kr-${Date.now()}-${i}`,
            title: k.title,
            currentValue: 0,
            targetValue: Number(k.target) || 0,
            unit: k.unit
        }));

      const newOKR: OKR = {
          id: Date.now().toString(),
          quarter: selectedQuarter,
          objective: newObjective,
          keyResults: keyResults,
          progress: 0
      };

      await DataService.saveOKR(newOKR);
      setShowForm(false);
      setNewObjective('');
      setNewKRs([{ title: '', target: '', unit: '#' }]);
      loadData();
  };

  const updateKRProgress = async (okr: OKR, krId: string, newValue: number) => {
      const updatedKRs = okr.keyResults.map(kr => {
          if (kr.id === krId) {
              return { ...kr, currentValue: newValue };
          }
          return kr;
      });

      // Recalculate global progress
      // Simple logic: Average of (current/target) for each KR
      const totalProgress = updatedKRs.reduce((acc, kr) => {
          const p = kr.targetValue > 0 ? (kr.currentValue / kr.targetValue) * 100 : 0;
          return acc + Math.min(p, 100); // Cap at 100% per KR
      }, 0);
      
      const newProgress = Math.round(totalProgress / updatedKRs.length);

      const updatedOKR: OKR = {
          ...okr,
          keyResults: updatedKRs,
          progress: newProgress
      };

      // Optimistic update
      setOkrs(prev => prev.map(o => o.id === okr.id ? updatedOKR : o));
      
      // Save
      await DataService.saveOKR(updatedOKR);
  };

  const filteredOkrs = okrs.filter(okr => okr.quarter === selectedQuarter);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in-up">
        
        {/* Header & Filter */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Target className="text-autoforce-accent" />
                    OKRs & Metas
                </h2>
                <p className="text-autoforce-lightGrey text-sm">Objetivos e Resultados Chave para 2026</p>
            </div>
            
            <div className="flex bg-autoforce-darkest border border-autoforce-grey/30 rounded-lg p-1">
                {quarters.map(q => (
                    <button
                        key={q}
                        onClick={() => setSelectedQuarter(q)}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${selectedQuarter === q ? 'bg-autoforce-blue text-white shadow-lg' : 'text-autoforce-lightGrey hover:text-white hover:bg-white/5'}`}
                    >
                        {q}
                    </button>
                ))}
            </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-end">
            <button 
                onClick={() => setShowForm(true)}
                className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-bold transition-colors"
            >
                <Plus size={16} />
                Novo Objetivo ({selectedQuarter})
            </button>
        </div>

        {/* Create Form Modal (Inline for now) */}
        {showForm && (
            <div className="bg-autoforce-darkest border border-autoforce-blue/50 rounded-xl p-6 shadow-2xl animate-fade-in-down mb-6">
                <div className="flex justify-between items-center mb-4 border-b border-autoforce-grey/20 pb-2">
                    <h3 className="text-lg font-bold text-white">Cadastrar OKR em <span className="text-autoforce-accent">{selectedQuarter}</span></h3>
                    <button onClick={() => setShowForm(false)} className="text-autoforce-lightGrey hover:text-white"><X size={20}/></button>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">Objetivo Principal</label>
                        <input 
                            type="text" 
                            className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none"
                            placeholder="Ex: Dominar o mercado de SUVs..."
                            value={newObjective}
                            onChange={e => setNewObjective(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider">Resultados Chave (Key Results)</label>
                        {newKRs.map((kr, idx) => (
                            <div key={idx} className="flex gap-2 items-start">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                                    placeholder="Descrição do KR"
                                    value={kr.title}
                                    onChange={e => handleKRChange(idx, 'title', e.target.value)}
                                    required
                                />
                                <input 
                                    type="number" 
                                    className="w-24 bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                                    placeholder="Meta"
                                    value={kr.target}
                                    onChange={e => handleKRChange(idx, 'target', e.target.value)}
                                    required
                                />
                                <select 
                                    className="w-20 bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                                    value={kr.unit}
                                    onChange={e => handleKRChange(idx, 'unit', e.target.value)}
                                >
                                    <option value="#">Num</option>
                                    <option value="%">%</option>
                                    <option value="R$">R$</option>
                                </select>
                                <button type="button" onClick={() => handleRemoveKRField(idx)} className="p-2 text-red-400 hover:bg-red-400/10 rounded">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" onClick={handleAddKRField} className="text-xs text-autoforce-blue hover:underline flex items-center gap-1">
                            <Plus size={12} /> Adicionar outro KR
                        </button>
                    </div>

                    <div className="pt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-autoforce-lightGrey hover:text-white text-sm">Cancelar</button>
                        <button type="submit" className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-6 py-2 rounded text-sm font-bold shadow-lg">Salvar OKR</button>
                    </div>
                </form>
            </div>
        )}

        {/* OKR List */}
        <div className="grid grid-cols-1 gap-6">
            {loading ? (
                <p className="text-center text-autoforce-lightGrey py-10">Carregando objetivos...</p>
            ) : filteredOkrs.length === 0 ? (
                <div className="text-center py-20 bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl border-dashed">
                    <Target size={48} className="mx-auto text-autoforce-grey mb-4" />
                    <h3 className="text-lg font-bold text-white">Nenhum objetivo para {selectedQuarter}</h3>
                    <p className="text-autoforce-lightGrey text-sm mb-4">Comece definindo suas metas estratégicas.</p>
                    <button onClick={() => setShowForm(true)} className="text-autoforce-blue hover:underline text-sm font-bold">Criar Primeiro Objetivo</button>
                </div>
            ) : (
                filteredOkrs.map(okr => (
                    <div key={okr.id} className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl overflow-hidden hover:border-autoforce-blue/30 transition-all shadow-lg">
                        {/* Objective Header */}
                        <div className="p-6 border-b border-autoforce-grey/10 bg-gradient-to-r from-autoforce-darkest to-autoforce-blue/5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-autoforce-blue/20 text-autoforce-blue mb-2 border border-autoforce-blue/20">OBJECTIVE</span>
                                    <h3 className="text-xl font-bold text-white">{okr.objective}</h3>
                                </div>
                                <div className="text-right">
                                    <span className="text-3xl font-display font-bold text-white">{okr.progress}%</span>
                                    <p className="text-xs text-autoforce-lightGrey">Concluído</p>
                                </div>
                            </div>
                            
                            {/* Main Progress Bar */}
                            <div className="w-full bg-black h-3 rounded-full overflow-hidden border border-autoforce-grey/30">
                                <div 
                                    className={`h-full rounded-full transition-all duration-1000 ${okr.progress === 100 ? 'bg-green-500' : 'bg-gradient-to-r from-autoforce-blue to-autoforce-secondary'}`} 
                                    style={{ width: `${okr.progress}%` }}
                                ></div>
                            </div>
                        </div>

                        {/* Key Results List */}
                        <div className="p-6 bg-black/20 space-y-6">
                            {okr.keyResults.map(kr => {
                                const percentage = Math.min((kr.currentValue / kr.targetValue) * 100, 100);
                                return (
                                    <div key={kr.id} className="group">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-3">
                                                {percentage >= 100 ? <CheckCircle2 size={18} className="text-green-500"/> : <Circle size={18} className="text-autoforce-grey"/>}
                                                <span className={`text-sm ${percentage >= 100 ? 'text-white line-through opacity-50' : 'text-autoforce-lightGrey'}`}>{kr.title}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input 
                                                    type="number" 
                                                    value={kr.currentValue}
                                                    onChange={(e) => updateKRProgress(okr, kr.id, Number(e.target.value))}
                                                    className="w-16 bg-autoforce-black border border-autoforce-grey/30 rounded px-2 py-1 text-right text-white text-xs focus:border-autoforce-blue focus:outline-none"
                                                />
                                                <span className="text-xs text-autoforce-grey">/ {kr.targetValue} {kr.unit}</span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-autoforce-grey/10 h-1.5 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full ${percentage >= 100 ? 'bg-green-500' : 'bg-autoforce-accent'}`} 
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default OKRTracker;
