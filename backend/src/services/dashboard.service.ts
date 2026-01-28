import { Metric, ChartData } from '../types/dashboard.types';
import { prisma } from '../config/database';

export class DashboardService {
  static async getDashboardMetrics(): Promise<Metric[]> {
    // Buscar dados do último mês
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total de Leads (MQL do mês atual)
    const currentMonthLeads = await prisma.dailyLead.findMany({
      where: {
        date: {
          gte: firstDayOfMonth,
        },
      },
    });
    const totalLeads = currentMonthLeads.reduce((sum, lead) => sum + lead.mql, 0);

    // Total do mês anterior para calcular mudança
    const lastMonthLeads = await prisma.dailyLead.findMany({
      where: {
        date: {
          gte: lastMonth,
          lte: lastMonthEnd,
        },
      },
    });
    const lastMonthTotal = lastMonthLeads.reduce((sum, lead) => sum + lead.mql, 0);
    const leadsChange = lastMonthTotal > 0 
      ? ((totalLeads - lastMonthTotal) / lastMonthTotal) * 100 
      : 0;

    // Taxa de Qualificação (SQL / MQL)
    const totalSQL = currentMonthLeads.reduce((sum, lead) => sum + lead.sql, 0);
    const qualificationRate = totalLeads > 0 ? (totalSQL / totalLeads) * 100 : 0;
    const lastMonthSQL = lastMonthLeads.reduce((sum, lead) => sum + lead.sql, 0);
    const lastMonthQualRate = lastMonthTotal > 0 ? (lastMonthSQL / lastMonthTotal) * 100 : 0;
    const qualChange = lastMonthQualRate > 0 
      ? qualificationRate - lastMonthQualRate 
      : 0;

    // MRR Novo (soma do mês atual)
    const currentMonthRevenue = await prisma.revenueEntry.findMany({
      where: {
        date: {
          gte: firstDayOfMonth,
        },
      },
    });
    const totalMRR = currentMonthRevenue.reduce((sum, rev) => sum + rev.mrrValue, 0);
    const lastMonthRevenue = await prisma.revenueEntry.findMany({
      where: {
        date: {
          gte: lastMonth,
          lte: lastMonthEnd,
        },
      },
    });
    const lastMonthMRR = lastMonthRevenue.reduce((sum, rev) => sum + rev.mrrValue, 0);
    const mrrChange = lastMonthMRR > 0 
      ? ((totalMRR - lastMonthMRR) / lastMonthMRR) * 100 
      : 0;

    // Vendas Realizadas (sales do mês atual)
    const totalSales = currentMonthRevenue.length;
    const lastMonthSales = lastMonthRevenue.length;
    const salesChange = lastMonthSales > 0 
      ? ((totalSales - lastMonthSales) / lastMonthSales) * 100 
      : 0;

    return [
      { 
        id: '1', 
        label: 'Total de Leads', 
        value: totalLeads, 
        target: 4000, 
        unit: '', 
        change: Number(leadsChange.toFixed(1)), 
        trend: leadsChange >= 0 ? 'up' : 'down', 
        description: 'Leads gerados em todas as fontes' 
      },
      { 
        id: '2', 
        label: 'Taxa de Qualificação', 
        value: Number(qualificationRate.toFixed(1)), 
        target: 45, 
        unit: '%', 
        change: Number(qualChange.toFixed(1)), 
        trend: qualChange >= 0 ? 'up' : 'down', 
        description: 'Leads que viraram oportunidades' 
      },
      { 
        id: '3', 
        label: 'MRR Novo (Mês)', 
        value: Number(totalMRR.toFixed(2)), 
        target: 15000, 
        unit: 'R$', 
        change: Number(mrrChange.toFixed(1)), 
        trend: mrrChange >= 0 ? 'up' : 'down', 
        description: 'Receita recorrente adicionada' 
      },
      { 
        id: '4', 
        label: 'Vendas Realizadas', 
        value: totalSales, 
        target: 120, 
        unit: '', 
        change: Number(salesChange.toFixed(1)), 
        trend: salesChange >= 0 ? 'up' : 'down', 
        description: 'Negócios fechados no período' 
      },
    ];
  }

  static async getPerformanceHistory(): Promise<ChartData[]> {
    // Buscar dados dos últimos 7 meses
    const now = new Date();
    const months: ChartData[] = [];
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    for (let i = 6; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const monthLeads = await prisma.dailyLead.findMany({
        where: {
          date: {
            gte: monthDate,
            lt: nextMonth,
          },
        },
      });

      const leads = monthLeads.reduce((sum, lead) => sum + lead.mql, 0);
      const qualified = monthLeads.reduce((sum, lead) => sum + lead.sql, 0);
      const sales = monthLeads.reduce((sum, lead) => sum + lead.sales, 0);

      months.push({
        name: monthNames[monthDate.getMonth()],
        leads,
        qualified,
        sales,
      });
    }

    return months;
  }
}
