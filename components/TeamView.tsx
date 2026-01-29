import React, { useMemo, useState, useEffect } from 'react';
import { Calendar, Plus, StickyNote, Pencil, Trash2, Droplet, RefreshCw } from 'lucide-react';
import { CampaignEvent } from '../types';
import { DataService } from '../services/dataService';

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateString = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

const monthNames = [
  'Janeiro',
  'Fevereiro',
  'Marco',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const TeamView: React.FC = () => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [showForm, setShowForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(selectedDate);
  const [endDate, setEndDate] = useState(selectedDate);
  const [color, setColor] = useState('#2563eb');
  const [notes, setNotes] = useState('');
  const [dateError, setDateError] = useState('');

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    setStartDate(selectedDate);
    setEndDate(selectedDate);
  }, [selectedDate]);

  const monthLabel = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  const startDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const startWeekday = startDay.getDay();
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();

  const calendarCells = useMemo(() => {
    const cells: Array<{ date: Date | null; key: string }> = [];
    for (let i = 0; i < 42; i++) {
      const day = i - startWeekday + 1;
      if (day < 1 || day > daysInMonth) {
        cells.push({ date: null, key: `empty-${i}` });
      } else {
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        cells.push({ date, key: formatDateKey(date) });
      }
    }
    return cells;
  }, [currentMonth, startWeekday, daysInMonth]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CampaignEvent[]>();
    events.forEach(event => {
      const start = parseDateString(event.startDate);
      const end = parseDateString(event.endDate);
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = formatDateKey(cursor);
        const list = map.get(key) || [];
        list.push(event);
        map.set(key, list);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [events]);

  const selectedEvents = eventsByDate.get(selectedDate) || [];

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await DataService.getCampaignEvents();
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load calendar events', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    if (new Date(endDate) < new Date(startDate)) {
      setDateError('Data final não pode ser antes da data inicial.');
      return;
    }
    setDateError('');
    const payload = {
      title: title.trim(),
      startDate,
      endDate,
      color,
      notes: notes.trim() || undefined,
    };

    try {
      if (editingEventId) {
        const updated = await DataService.updateCampaignEvent(editingEventId, payload);
        setEvents(prev => prev.map(event => (event.id === updated.id ? updated : event)));
      } else {
        const created = await DataService.createCampaignEvent(payload);
        setEvents(prev => [...prev, created]);
      }
    } catch (error) {
      console.error('Failed to save calendar event', error);
    }

    setTitle('');
    setColor('#2563eb');
    setNotes('');
    setShowForm(false);
    setEditingEventId(null);
    setSelectedDate(startDate);
  };

  const handleRemoveEvent = async (id: string) => {
    try {
      await DataService.deleteCampaignEvent(id);
      setEvents(prev => prev.filter(event => event.id !== id));
    } catch (error) {
      console.error('Failed to remove calendar event', error);
    }
  };

  const handleEditEvent = (event: CampaignEvent) => {
    setEditingEventId(event.id);
    setTitle(event.title);
    setStartDate(event.startDate);
    setEndDate(event.endDate);
    setColor(event.color);
    setNotes(event.notes || '');
    setDateError('');
    setShowForm(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Calendar className="text-autoforce-accent" />
            Calendario Marketing
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Organize eventos, campanhas e entregas do time de marketing.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="border border-autoforce-grey/30 text-autoforce-lightGrey hover:text-white hover:border-autoforce-blue/60 px-3 py-2 rounded text-sm font-semibold transition-colors"
            onClick={loadEvents}
            disabled={loading}
          >
            <RefreshCw size={14} className={`inline mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
          <button
            className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-4 py-2 rounded text-sm font-bold transition-colors"
            onClick={() => {
              setEditingEventId(null);
              setTitle('');
              setColor('#2563eb');
              setNotes('');
              setStartDate(selectedDate);
              setEndDate(selectedDate);
              setDateError('');
              setShowForm(true);
            }}
          >
            <Plus size={16} className="inline mr-2" />
            Novo agendamento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <button
              className="text-autoforce-lightGrey hover:text-white text-sm"
              onClick={handlePrevMonth}
            >
              Mes anterior
            </button>
            <div className="text-white font-bold">{monthLabel}</div>
            <button
              className="text-autoforce-lightGrey hover:text-white text-sm"
              onClick={handleNextMonth}
            >
              Proximo mes
            </button>
          </div>

          <div className="grid grid-cols-7 text-xs text-autoforce-lightGrey mb-2">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map(day => (
              <div key={day} className="text-center py-2">{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map(cell => {
              if (!cell.date) {
                return <div key={cell.key} className="h-16 rounded border border-transparent" />;
              }
              const key = formatDateKey(cell.date);
              const isSelected = key === selectedDate;
              const dayEvents = eventsByDate.get(key) || [];
              return (
                <button
                  key={cell.key}
                  onClick={() => setSelectedDate(key)}
                  className={`h-16 rounded-lg border text-left p-2 transition-all ${
                    isSelected
                      ? 'border-autoforce-blue bg-autoforce-blue/10'
                      : 'border-autoforce-grey/20 hover:border-autoforce-blue/50'
                  }`}
                >
                  <div className="text-sm text-white font-semibold">{cell.date.getDate()}</div>
                  <div className="flex gap-1 mt-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <span
                        key={event.id}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: event.color }}
                      ></span>
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="text-[10px] text-autoforce-lightGrey">+{dayEvents.length - 3}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
            <h3 className="text-white font-bold mb-4">Agenda do dia</h3>
            <p className="text-xs text-autoforce-lightGrey mb-4">{selectedDate}</p>
            {loading ? (
              <p className="text-sm text-autoforce-lightGrey">Carregando eventos...</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-autoforce-lightGrey">Nenhum evento agendado.</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map(event => (
                  <div key={event.id} className="border border-autoforce-grey/20 rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm text-white font-semibold">{event.title}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            event.source === 'google'
                              ? 'border-white/20 text-white/70 bg-white/5'
                              : 'border-autoforce-blue/40 text-autoforce-blue/90 bg-autoforce-blue/10'
                          }`}>
                            {event.source === 'google' ? 'Google' : 'Local'}
                          </span>
                        </div>
                        <p className="text-xs text-autoforce-lightGrey">
                          {event.startDate} - {event.endDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="text-xs text-autoforce-blue hover:text-autoforce-secondary flex items-center gap-1"
                          onClick={() => handleEditEvent(event)}
                        >
                          <Pencil size={12} />
                          Editar
                        </button>
                        <button
                          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
                          onClick={() => handleRemoveEvent(event.id)}
                        >
                          <Trash2 size={12} />
                          Remover
                        </button>
                      </div>
                    </div>
                    {event.notes && <p className="text-xs text-autoforce-lightGrey mt-2">{event.notes}</p>}
                    <div className="mt-2 flex items-center gap-2 text-xs text-autoforce-grey">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }}></span>
                      <span>Cor do evento</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showForm && (
            <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
              <h3 className="text-white font-bold mb-4">
                {editingEventId ? 'Editar agendamento' : 'Novo agendamento'}
              </h3>
              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                    Titulo
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm"
                    placeholder="Ex: Campanha de Feirao"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                      Inicio
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={`w-full bg-autoforce-black border rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm ${
                        dateError ? 'border-red-500/60' : 'border-autoforce-grey/50'
                      }`}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                      Fim
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={`w-full bg-autoforce-black border rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-sm ${
                        dateError ? 'border-red-500/60' : 'border-autoforce-grey/50'
                      }`}
                      required
                    />
                  </div>
                </div>
                {dateError && <p className="text-xs text-red-400">{dateError}</p>}
                <div>
                  <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                    Cor
                  </label>
                  <div className="relative">
                    <Droplet size={14} className="absolute left-3 top-2.5 text-autoforce-grey" />
                    <input
                      type="color"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none pl-9 text-sm h-10"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-autoforce-lightGrey uppercase tracking-wider mb-1">
                    Observacoes
                  </label>
                  <div className="relative">
                    <StickyNote size={14} className="absolute left-3 top-2.5 text-autoforce-grey" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-autoforce-black border border-autoforce-grey/50 rounded px-3 py-2 text-white focus:border-autoforce-blue focus:outline-none pl-9 text-sm min-h-[90px]"
                      placeholder="Detalhes, canal, publico, pauta..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditingEventId(null);
                      setDateError('');
                    }}
                    className="px-4 py-2 text-autoforce-lightGrey hover:text-white text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="bg-autoforce-blue hover:bg-autoforce-secondary text-white px-5 py-2 rounded text-sm font-bold"
                  >
                    {editingEventId ? 'Atualizar' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamView;
