import { prisma } from '../config/database';
import { Prisma, ReportWidgetType } from '@prisma/client';

export interface ReportWidgetInput {
  id: string; // gerado no cliente (uuid) — mantém correspondência estável com o layout do grid
  type: ReportWidgetType;
  title: string;
  metricKey: string;
  groupBy?: string | null;
  filters?: Record<string, string> | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  datePreset?: string | null;
  sortOrder?: number;
}

export interface UpdateReportInput {
  name?: string;
  description?: string | null;
  layout?: unknown;
  widgets?: ReportWidgetInput[];
}

export class ReportsService {
  static async list() {
    return prisma.report.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true, name: true, description: true, createdBy: true,
        createdAt: true, updatedAt: true,
        _count: { select: { widgets: true } },
      },
    });
  }

  static async get(id: string) {
    return prisma.report.findUnique({
      where: { id },
      include: { widgets: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  static async create(input: { name: string; description?: string | null; createdBy?: string | null }) {
    return prisma.report.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        createdBy: input.createdBy ?? null,
        layout: [],
      },
      include: { widgets: true },
    });
  }

  static async update(id: string, input: UpdateReportInput) {
    return prisma.$transaction(async (tx) => {
      if (input.widgets) {
        await tx.reportWidget.deleteMany({ where: { reportId: id } });
        if (input.widgets.length > 0) {
          await tx.reportWidget.createMany({
            data: input.widgets.map((w, i) => ({
              id: w.id,
              reportId: id,
              type: w.type,
              title: w.title,
              metricKey: w.metricKey,
              groupBy: w.groupBy ?? null,
              filters: (w.filters ?? undefined) as Prisma.InputJsonValue | undefined,
              dateFrom: w.dateFrom ? new Date(w.dateFrom) : null,
              dateTo: w.dateTo ? new Date(w.dateTo) : null,
              datePreset: w.datePreset ?? null,
              sortOrder: w.sortOrder ?? i,
            })),
          });
        }
      }

      return tx.report.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.layout !== undefined ? { layout: input.layout as Prisma.InputJsonValue } : {}),
        },
        include: { widgets: { orderBy: { sortOrder: 'asc' } } },
      });
    });
  }

  static async remove(id: string) {
    await prisma.report.delete({ where: { id } });
  }

  static isValidWidgetType(value: string): value is ReportWidgetType {
    return Object.values(ReportWidgetType).includes(value as ReportWidgetType);
  }
}
