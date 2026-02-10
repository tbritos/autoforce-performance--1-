import { prisma } from '../config/database';
import { DailyLeadEntry, LeadConversionSummary } from '../types/shared.types';

export class LeadsService {
  static async getDailyLeads(): Promise<DailyLeadEntry[]> {
    const leads = await prisma.dailyLead.findMany({
      orderBy: { date: 'desc' },
    });

    return leads.map(lead => ({
      id: lead.id,
      date: lead.date.toISOString().split('T')[0],
      leads: lead.leads,
      mql: lead.mql,
      sql: lead.sql,
      sales: lead.sales,
      conversionRate: lead.conversionRate,
    }));
  }

  static async saveDailyLead(data: Omit<DailyLeadEntry, 'id'>): Promise<DailyLeadEntry> {
    const date = new Date(data.date);
    
    const lead = await prisma.dailyLead.upsert({
      where: {
        date: date,
      },
      update: {
        leads: data.leads,
        mql: data.mql,
        sql: data.sql,
        sales: data.sales,
        conversionRate: data.conversionRate,
      },
      create: {
        date: date,
        leads: data.leads,
        mql: data.mql,
        sql: data.sql,
        sales: data.sales,
        conversionRate: data.conversionRate,
      },
    });

    return {
      id: lead.id,
      date: lead.date.toISOString().split('T')[0],
      leads: lead.leads,
      mql: lead.mql,
      sql: lead.sql,
      sales: lead.sales,
      conversionRate: lead.conversionRate,
    };
  }

  static async updateDailyLead(
    id: string,
    data: Omit<DailyLeadEntry, 'id'>
  ): Promise<DailyLeadEntry> {
    const date = new Date(data.date);
    const lead = await prisma.dailyLead.update({
      where: { id },
      data: {
        date,
        leads: data.leads,
        mql: data.mql,
        sql: data.sql,
        sales: data.sales,
        conversionRate: data.conversionRate,
      },
    });

    return {
      id: lead.id,
      date: lead.date.toISOString().split('T')[0],
      leads: lead.leads,
      mql: lead.mql,
      sql: lead.sql,
      sales: lead.sales,
      conversionRate: lead.conversionRate,
    };
  }

  static async deleteDailyLead(id: string): Promise<void> {
    await prisma.dailyLead.delete({
      where: { id },
    });
  }

  static async getLeadConversions(): Promise<LeadConversionSummary[]> {
    return [];
  }
}
