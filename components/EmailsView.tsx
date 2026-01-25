import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { DataService } from '../services/dataService';
import { EmailCampaign, WorkflowEmailStat, SyncLog } from '../types';

const EmailsView: React.FC = () => {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowEmailStat[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logFilter, setLogFilter] = useState<'all' | 'rd_emails' | 'rd_workflows'>('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [source] = useState<'rd'>('rd');
  const [mode, setMode] = useState<'emails' | 'automation'>('emails');
  const [syncing, setSyncing] = useState(false);
  const [expandedWorkflow, setExpandedWorkflow] = useState<string | null>(null);
  const [workflowSortKey, setWorkflowSortKey] = useState<'name' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'openedRate' | 'clickedRate'>('delivered');
  const [workflowSortDirection, setWorkflowSortDirection] = useState<'asc' | 'desc'>('desc');
  const itemsPerPage = 15;
  const [emailPage, setEmailPage] = useState(1);
  const [automationPage, setAutomationPage] = useState(1);

  const { startDateStr, endDateStr } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 45);
    return {
      startDateStr: start.toISOString().split('T')[0],
      endDateStr: end.toISOString().split('T')[0],
    };
  }, []);

  useEffect(() => {
    const loadCampaigns = async () => {
      setLoading(true);
      try {
        setLogsLoading(true);
        if (mode === 'emails') {
          const data = await DataService.getRdEmailCampaigns();
          setCampaigns(Array.isArray(data) ? data : []);
          setWorkflowStats([]);
        } else if (mode === 'automation') {
          const data = await DataService.getRdWorkflowEmailStats();
          setWorkflowStats(Array.isArray(data) ? data : []);
          setCampaigns([]);
        } else {
          const data = await DataService.getEmailCampaigns();
          setCampaigns(Array.isArray(data) ? data : []);
          setWorkflowStats([]);
        }
        const logs = await DataService.getSyncLogs(20);
        setSyncLogs(Array.isArray(logs) ? logs : []);
      } catch (error) {
        console.error(error);
        setCampaigns([]);
        setWorkflowStats([]);
        setSyncLogs([]);
      } finally {
        setLoading(false);
        setLogsLoading(false);
      }
    };
    loadCampaigns();
  }, [source, mode, startDateStr, endDateStr]);

  useEffect(() => {
    setEmailPage(1);
    setAutomationPage(1);
  }, [mode, searchTerm]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (mode === 'automation') {
        const data = await DataService.syncRdWorkflowEmailStats(startDateStr, endDateStr);
        setWorkflowStats(Array.isArray(data) ? data : []);
        setCampaigns([]);
      } else {
        const data = await DataService.syncRdEmailCampaigns(startDateStr, endDateStr);
        setCampaigns(Array.isArray(data) ? data : []);
        setWorkflowStats([]);
      }
      const logs = await DataService.getSyncLogs(20);
      setSyncLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      console.error(error);
    } finally {
      setSyncing(false);
    }
  };

  const filteredCampaigns = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const filtered = campaigns.filter(item =>
      item.name.toLowerCase().includes(searchLower)
    );
    return filtered
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [campaigns, searchTerm]);

  const pagedCampaigns = useMemo(() => {
    const startIndex = (emailPage - 1) * itemsPerPage;
    return filteredCampaigns.slice(startIndex, startIndex + itemsPerPage);
  }, [emailPage, filteredCampaigns]);

  const totalEmailPages = Math.max(1, Math.ceil(filteredCampaigns.length / itemsPerPage));

  const groupedWorkflows = useMemo(() => {
    const map = new Map<string, { name: string; items: WorkflowEmailStat[] }>();
    workflowStats.forEach(item => {
      const key = item.workflowName || 'Workflow';
      const group = map.get(key) || { name: key, items: [] };
      group.items.push(item);
      map.set(key, group);
    });

    const grouped = Array.from(map.values()).map(group => {
      const totals = group.items.reduce(
        (acc, item) => ({
          delivered: acc.delivered + item.delivered,
          opened: acc.opened + item.opened,
          clicked: acc.clicked + item.clicked,
          bounced: acc.bounced + item.bounced,
          unsubscribed: acc.unsubscribed + item.unsubscribed,
        }),
        { delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 }
      );

      const deliveredBase = totals.delivered || 1;
      return {
        ...group,
        totals,
        rates: {
          openedRate: (totals.opened / deliveredBase) * 100,
          clickedRate: (totals.clicked / deliveredBase) * 100,
        },
      };
    });

    const sorted = [...grouped].sort((a, b) => {
      const direction = workflowSortDirection === 'asc' ? 1 : -1;
      if (workflowSortKey === 'name') {
        return a.name.localeCompare(b.name) * direction;
      }
      if (workflowSortKey === 'openedRate') {
        return (a.rates.openedRate - b.rates.openedRate) * direction;
      }
      if (workflowSortKey === 'clickedRate') {
        return (a.rates.clickedRate - b.rates.clickedRate) * direction;
      }
      const aValue = a.totals[workflowSortKey] ?? 0;
      const bValue = b.totals[workflowSortKey] ?? 0;
      return (aValue - bValue) * direction;
    });

    return sorted;
  }, [workflowStats, workflowSortDirection, workflowSortKey]);

  const pagedWorkflows = useMemo(() => {
    const startIndex = (automationPage - 1) * itemsPerPage;
    return groupedWorkflows.slice(startIndex, startIndex + itemsPerPage);
  }, [automationPage, groupedWorkflows]);

  const totalAutomationPages = Math.max(1, Math.ceil(groupedWorkflows.length / itemsPerPage));

  const handleWorkflowSort = (
    key: 'name' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'unsubscribed' | 'openedRate' | 'clickedRate'
  ) => {
    if (workflowSortKey === key) {
      setWorkflowSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setWorkflowSortKey(key);
    setWorkflowSortDirection('desc');
  };

  const formatSourceLabel = (value: string) => {
    if (value === 'rd_emails') return 'RD Emails';
    if (value === 'rd_workflows') return 'RD Automações';
    return value;
  };

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return syncLogs;
    return syncLogs.filter((log) => log.source === logFilter);
  }, [logFilter, syncLogs]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in-up">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-2">
            <Mail className="text-autoforce-blue" />
            Emails
          </h2>
          <p className="text-autoforce-lightGrey text-sm">
            Emails e fluxos sincronizados automaticamente com o RD Station.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-autoforce-lightGrey">
          <div className="flex items-center gap-2 bg-autoforce-darkest border border-autoforce-grey/30 p-1 rounded">
            <button
              type="button"
              onClick={() => setMode('emails')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${mode === 'emails' ? 'bg-autoforce-blue text-white' : 'text-autoforce-lightGrey hover:text-white'}`}
            >
              Email Marketing
            </button>
            <button
              type="button"
              onClick={() => setMode('automation')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${mode === 'automation' ? 'bg-autoforce-blue text-white' : 'text-autoforce-lightGrey hover:text-white'}`}
            >
              Automacoes
            </button>
          </div>
          {mode === 'emails' && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="bg-autoforce-darkest border border-autoforce-grey/30 px-3 py-2 rounded text-xs font-bold text-white hover:border-autoforce-blue disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
          {mode === 'automation' && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="bg-autoforce-darkest border border-autoforce-grey/30 px-3 py-2 rounded text-xs font-bold text-white hover:border-autoforce-blue disabled:opacity-50"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-autoforce-lightGrey" size={14} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-autoforce-darkest border border-autoforce-grey/30 rounded pl-8 pr-3 py-2 text-white focus:border-autoforce-blue focus:outline-none text-xs"
              placeholder="Buscar campanha"
            />
          </div>
        </div>
      </div>

      <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <h3 className="text-sm font-bold text-white">Logs de Sincronizacao</h3>
          <div className="flex items-center gap-2 text-xs text-autoforce-lightGrey">
            <span>Ultimas 20 execucoes</span>
            <div className="flex items-center gap-1 bg-autoforce-black/40 border border-autoforce-grey/20 rounded-full p-1">
              {['all', 'rd_emails', 'rd_workflows'].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLogFilter(value as typeof logFilter)}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold transition ${
                    logFilter === value
                      ? 'bg-autoforce-blue/20 text-white'
                      : 'text-autoforce-lightGrey hover:text-white'
                  }`}
                >
                  {value === 'all' ? 'Todos' : value === 'rd_emails' ? 'Emails' : 'Automações'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {logsLoading ? (
          <div className="mt-3 text-xs text-autoforce-lightGrey">Carregando logs...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="mt-3 text-xs text-autoforce-lightGrey">Nenhum log disponivel.</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-autoforce-grey/20 bg-autoforce-black/40 px-3 py-2"
              >
                <div>
                  <div className="text-white font-semibold">{formatSourceLabel(log.source)}</div>
                  <div className="text-autoforce-lightGrey">
                    {new Date(log.startedAt).toLocaleString('pt-BR')}
                  </div>
                  {log.message && (
                    <div className="text-autoforce-grey mt-1">{log.message}</div>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    log.status === 'success'
                      ? 'bg-green-500/20 text-green-300'
                      : log.status === 'running'
                      ? 'bg-autoforce-blue/20 text-autoforce-blue'
                      : 'bg-red-500/20 text-red-300'
                  }`}
                >
                  {log.status === 'success' ? 'OK' : log.status === 'running' ? 'SYNC' : 'ERRO'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-autoforce-darkest border border-autoforce-grey/20 rounded-xl p-6">
          <h3 className="text-white font-bold mb-4">Historico</h3>
          {mode === 'automation' ? (
            loading ? (
              <div className="text-sm text-autoforce-lightGrey">Carregando automacoes...</div>
            ) : groupedWorkflows.length === 0 ? (
              <div className="text-sm text-autoforce-lightGrey">Nenhum fluxo encontrado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-autoforce-lightGrey">
                  <thead className="text-xs text-autoforce-grey uppercase bg-autoforce-black/50">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('name')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'name' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Fluxo {workflowSortKey === 'name' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('delivered')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'delivered' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Entregues {workflowSortKey === 'delivered' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('opened')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'opened' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Aberturas {workflowSortKey === 'opened' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('clicked')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'clicked' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Cliques {workflowSortKey === 'clicked' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('bounced')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'bounced' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Bounce {workflowSortKey === 'bounced' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('unsubscribed')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'unsubscribed' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Descad. {workflowSortKey === 'unsubscribed' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                      <th className="px-4 py-3 rounded-r-lg">
                        <button
                          type="button"
                          onClick={() => handleWorkflowSort('openedRate')}
                          className={`text-left font-bold uppercase tracking-wider ${workflowSortKey === 'openedRate' ? 'text-white' : 'text-autoforce-grey'}`}
                        >
                          Taxas {workflowSortKey === 'openedRate' ? (workflowSortDirection === 'asc' ? '▲' : '▼') : ''}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedWorkflows.map((workflow) => (
                      <React.Fragment key={workflow.name}>
                        <tr
                          className="border-b border-autoforce-grey/10 hover:bg-autoforce-blue/5 transition-colors cursor-pointer"
                          onClick={() => setExpandedWorkflow(prev => (prev === workflow.name ? null : workflow.name))}
                        >
                          <td className="px-4 py-3 font-medium text-white">
                            <div className="flex items-center gap-2">
                              {expandedWorkflow === workflow.name ? (
                                <ChevronDown size={14} className="text-autoforce-blue" />
                              ) : (
                                <ChevronRight size={14} className="text-autoforce-blue" />
                              )}
                              <span>{workflow.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">{workflow.totals.delivered.toLocaleString()}</td>
                          <td className="px-4 py-3">{workflow.totals.opened.toLocaleString()}</td>
                          <td className="px-4 py-3">{workflow.totals.clicked.toLocaleString()}</td>
                          <td className="px-4 py-3">{workflow.totals.bounced.toLocaleString()}</td>
                          <td className="px-4 py-3">{workflow.totals.unsubscribed.toLocaleString()}</td>
                          <td className="px-4 py-3 text-xs">
                            <div>Abertura: {workflow.rates.openedRate.toFixed(1)}%</div>
                            <div>Clique: {workflow.rates.clickedRate.toFixed(1)}%</div>
                          </td>
                        </tr>
                        {expandedWorkflow === workflow.name && (
                          <tr className="bg-autoforce-black/40">
                            <td colSpan={7} className="px-4 py-3">
                              <div className="text-xs text-autoforce-lightGrey mb-2">Emails do fluxo</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs text-left text-autoforce-lightGrey">
                                  <thead className="text-[10px] text-autoforce-grey uppercase">
                                    <tr>
                                      <th className="py-2">Email</th>
                                      <th className="py-2">Entregues</th>
                                      <th className="py-2">Aberturas</th>
                                      <th className="py-2">Cliques</th>
                                      <th className="py-2">Bounce</th>
                                      <th className="py-2">Descad.</th>
                                      <th className="py-2">Taxas</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {workflow.items.map((item) => (
                                      <tr key={item.id} className="border-t border-autoforce-grey/10">
                                        <td className="py-2 text-white">{item.emailName}</td>
                                        <td className="py-2">{item.delivered.toLocaleString()}</td>
                                        <td className="py-2">{item.opened.toLocaleString()}</td>
                                        <td className="py-2">{item.clicked.toLocaleString()}</td>
                                        <td className="py-2">{item.bounced.toLocaleString()}</td>
                                        <td className="py-2">{item.unsubscribed.toLocaleString()}</td>
                                        <td className="py-2">
                                          <div>Abertura: {item.openedRate.toFixed(1)}%</div>
                                          <div>Clique: {item.clickedRate.toFixed(1)}%</div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : loading ? (
            <div className="text-sm text-autoforce-lightGrey">Carregando campanhas...</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-sm text-autoforce-lightGrey">Nenhuma campanha encontrada.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-autoforce-lightGrey">
                <thead className="text-xs text-autoforce-grey uppercase bg-autoforce-black/50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Campanha</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Envios</th>
                    <th className="px-4 py-3">Aberturas</th>
                    <th className="px-4 py-3">Cliques</th>
                    <th className="px-4 py-3">Conversoes</th>
                    <th className="px-4 py-3 rounded-r-lg">Bounce</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCampaigns.map(item => (
                    <tr key={item.id} className="border-b border-autoforce-grey/10 hover:bg-autoforce-blue/5 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                      <td className="px-4 py-3">{item.date}</td>
                      <td className="px-4 py-3">{item.sends}</td>
                      <td className="px-4 py-3">{item.opens}</td>
                      <td className="px-4 py-3">{item.clicks}</td>
                      <td className="px-4 py-3">{item.conversions}</td>
                      <td className="px-4 py-3">{item.bounce}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {mode === 'automation' ? (
            groupedWorkflows.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between text-xs text-autoforce-lightGrey">
                <span>Pagina {automationPage} de {totalAutomationPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAutomationPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1 rounded border border-autoforce-grey/30 hover:border-autoforce-blue"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutomationPage(prev => Math.min(totalAutomationPages, prev + 1))}
                    className="px-3 py-1 rounded border border-autoforce-grey/30 hover:border-autoforce-blue"
                  >
                    Proxima
                  </button>
                </div>
              </div>
            )
          ) : (
            filteredCampaigns.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between text-xs text-autoforce-lightGrey">
                <span>Pagina {emailPage} de {totalEmailPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailPage(prev => Math.max(1, prev - 1))}
                    className="px-3 py-1 rounded border border-autoforce-grey/30 hover:border-autoforce-blue"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailPage(prev => Math.min(totalEmailPages, prev + 1))}
                    className="px-3 py-1 rounded border border-autoforce-grey/30 hover:border-autoforce-blue"
                  >
                    Proxima
                  </button>
                </div>
              </div>
            )
          )}
        </div>

      </div>
    </div>
  );
};

export default EmailsView;
