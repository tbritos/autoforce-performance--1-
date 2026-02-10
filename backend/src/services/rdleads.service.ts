import { prisma } from '../config/database';
import { fetchRdSegmentationContacts, fetchRdContactDetails } from './rdstation.service';

type RdLeadSyncOptions = {
  includeConversion?: boolean;
  maxPages?: number;
  pageSize?: number;
};

const parseDate = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const pickString = (row: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const extractConversionInfo = (row: Record<string, any>) => {
  const lastConversion = row?.last_conversion || row?.lastConversion || row?.last_conversion_event;
  const content = lastConversion?.content || lastConversion?.conversion || lastConversion;
  const identifier = pickString(content || {}, [
    'conversion_identifier',
    'identifier',
    'conversion_id',
    'id',
    'slug',
    'conversion_name',
    'name',
  ]);
  const name = pickString(content || {}, ['conversion_name', 'name', 'title', 'identifier', 'slug']);
  return {
    identifier,
    name,
  };
};

export class RdLeadsService {
  static async syncSegmentationContacts(
    segmentationId: string,
    options?: RdLeadSyncOptions
  ) {
    const pageSize = options?.pageSize ?? 200;
    const maxPages = options?.maxPages ?? 10;
    const includeConversion = options?.includeConversion ?? false;
    let page = 1;
    let totalProcessed = 0;

    while (page <= maxPages) {
      const { contacts, hasMore } = await fetchRdSegmentationContacts(
        segmentationId,
        page,
        pageSize
      );

      if (!contacts || contacts.length === 0) {
        break;
      }

      for (const contact of contacts) {
        const externalId = pickString(contact, ['uuid', 'id', 'external_id']);
        if (!externalId) continue;

        let conversionIdentifier: string | undefined;
        let conversionName: string | undefined;

        if (includeConversion) {
          try {
            const details = await fetchRdContactDetails(externalId);
            const conversion = extractConversionInfo(details);
            conversionIdentifier = conversion.identifier;
            conversionName = conversion.name;
          } catch (error) {
            console.error('Erro ao buscar detalhes do contato RD:', error);
          }
        }

        await prisma.rdLead.upsert({
          where: { externalId },
          update: {
            name: pickString(contact, ['name']),
            email: pickString(contact, ['email']),
            conversionIdentifier,
            conversionName,
            lastConversionDate: parseDate(
              pickString(contact, ['last_conversion_date', 'lastConversionDate'])
            ),
          },
          create: {
            externalId,
            name: pickString(contact, ['name']),
            email: pickString(contact, ['email']),
            conversionIdentifier,
            conversionName,
            lastConversionDate: parseDate(
              pickString(contact, ['last_conversion_date', 'lastConversionDate'])
            ),
          },
        });
        totalProcessed += 1;
      }

      if (!hasMore) break;
      page += 1;
    }

    return { totalProcessed };
  }

  static async listLeads(filters?: { startDate?: string; endDate?: string }) {
    const where: any = {};
    if (filters?.startDate || filters?.endDate) {
      where.lastConversionDate = {};
      if (filters.startDate) {
        where.lastConversionDate.gte = new Date(`${filters.startDate}T00:00:00`);
      }
      if (filters.endDate) {
        where.lastConversionDate.lte = new Date(`${filters.endDate}T23:59:59`);
      }
    }

    return prisma.rdLead.findMany({
      where,
      orderBy: { lastConversionDate: 'desc' },
    });
  }
}
