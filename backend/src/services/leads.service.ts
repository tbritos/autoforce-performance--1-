import { prisma } from '../config/database';
import { DailyLeadEntry, LeadConversionSummary } from '../types/shared.types';
import { fetchRdConversions } from './rdstation.service';

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

  static async getLeadConversions(options?: {
    startDate?: string;
    endDate?: string;
    assetTypes?: string[];
  }): Promise<LeadConversionSummary[]> {
    const rows = await fetchRdConversions(
      options?.startDate,
      options?.endDate,
      options?.assetTypes
    );

    const toNumber = (value: any) => {
      const num = Number(value);
      return Number.isNaN(num) ? 0 : num;
    };

    const pickString = (row: Record<string, any>, keys: string[]) => {
      for (const key of keys) {
        const value = row[key];
        if (typeof value === 'string' && value.trim().length > 0) {
          return value.trim();
        }
      }
      return undefined;
    };

    return rows.map((row, index) => {
      const assetId =
        pickString(row, ['asset_id', 'id', 'conversion_id', 'uuid']) ||
        `rd-${index}`;
      const identifier =
        pickString(row, [
          'asset_identifier',
          'identifier',
          'asset_slug',
          'slug',
          'asset_url',
          'url',
          'asset_path',
          'path',
        ]) || assetId;
      const name =
        pickString(row, [
          'asset_name',
          'name',
          'asset_title',
          'title',
          'conversion_name',
        ]) || identifier;
      const lastSeen =
        pickString(row, [
          'asset_updated_at',
          'updated_at',
          'last_conversion_at',
          'last_seen_at',
          'query_date_end',
          'end_date',
          'date',
        ]) || new Date().toISOString().split('T')[0];

      return {
        id: assetId,
        name,
        identifier,
        source: 'rdstation',
        leads: toNumber(
          row.conversion_count ??
            row.conversions ??
            row.leads ??
            row.total_conversions ??
            row.conversion
        ),
        mql: toNumber(row.mql ?? row.mqls ?? 0),
        sql: toNumber(row.sql ?? 0),
        conversionRate: toNumber(row.conversion_rate ?? row.conversionRate ?? 0),
        lastSeen,
      };
    });
  }
}
