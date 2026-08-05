import { prisma } from '../config/database';
import { Prisma, ReportWidgetType } from '@prisma/client';
import type { AuthUser } from './auth.service';
import { canViewReport, canEditReport, isReportOwner } from './reports/report-access';

export interface UpdateReportInput {
  name?: string;
  description?: string | null;
  metricKey?: string | null;
  groupBy?: string | null;
  chartType?: ReportWidgetType;
  filters?: Record<string, string> | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  datePreset?: string | null;
  tableColumns?: string[] | null;
}

export class ReportsService {
  // Lista só o que o usuário pode ver: relatórios públicos + os próprios
  // (admin vê tudo). Cada item ganha isOwner/canEdit computados aqui — a tela
  // de relatórios não tem acesso à identidade do usuário logado hoje, então
  // evita duplicar essa lógica de permissão no frontend.
  static async list(user?: AuthUser) {
    const isAdmin = user?.role === 'admin';
    const reports = await prisma.report.findMany({
      where: isAdmin ? undefined : {
        OR: [{ isPublic: true }, ...(user?.email ? [{ createdBy: user.email }] : [])],
      },
      orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true, name: true, description: true, createdBy: true,
        isPublic: true, isFavorite: true,
        createdAt: true, updatedAt: true,
        chartType: true, metricKey: true,
      },
    });
    return reports.map(r => ({
      ...r,
      isOwner: isReportOwner(r, user),
      canEdit: canEditReport(r, user),
    }));
  }

  // Fetch cru, sem checagem de permissão — usado tanto pelo controller (que
  // decide o status HTTP certo) quanto internamente por update/remove.
  static async get(id: string) {
    return prisma.report.findUnique({ where: { id } });
  }

  // Fetch com permissão aplicada — devolve null tanto pra "não existe" quanto
  // pra "existe mas você não pode ver" (nunca revela a existência de um
  // relatório privado alheio).
  static async getForUser(id: string, user?: AuthUser) {
    const report = await this.get(id);
    if (!report) return null;
    if (!canViewReport(report, user)) return null;
    return { ...report, isOwner: isReportOwner(report, user), canEdit: canEditReport(report, user) };
  }

  static async create(input: { name: string; description?: string | null; createdBy?: string | null }) {
    return prisma.report.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        createdBy: input.createdBy ?? null,
        layout: [],
      },
    });
  }

  static async update(id: string, input: UpdateReportInput, user?: AuthUser) {
    // "Adoção": relatório sem dono ganha um na primeira vez que alguém salva
    // ele — em vez de exigir uma migração manual de dados pra preencher
    // createdBy nos relatórios antigos.
    const existing = await prisma.report.findUnique({ where: { id }, select: { createdBy: true } });
    const adopt = existing && !existing.createdBy && user?.email ? user.email : undefined;

    return prisma.report.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.metricKey !== undefined ? { metricKey: input.metricKey } : {}),
        ...(input.groupBy !== undefined ? { groupBy: input.groupBy } : {}),
        ...(input.chartType !== undefined ? { chartType: input.chartType } : {}),
        ...(input.filters !== undefined ? { filters: (input.filters ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
        ...(input.dateFrom !== undefined ? { dateFrom: input.dateFrom ? new Date(input.dateFrom) : null } : {}),
        ...(input.dateTo !== undefined ? { dateTo: input.dateTo ? new Date(input.dateTo) : null } : {}),
        ...(input.datePreset !== undefined ? { datePreset: input.datePreset ?? null } : {}),
        ...(input.tableColumns !== undefined ? { tableColumns: (input.tableColumns ?? Prisma.JsonNull) as Prisma.InputJsonValue } : {}),
        ...(adopt ? { createdBy: adopt } : {}),
      },
    });
  }

  static async remove(id: string) {
    await prisma.report.delete({ where: { id } });
  }

  static async toggleFavorite(id: string) {
    const report = await prisma.report.findUniqueOrThrow({ where: { id }, select: { isFavorite: true } });
    return prisma.report.update({ where: { id }, data: { isFavorite: !report.isFavorite } });
  }

  static async updatePrivacy(id: string, isPublic: boolean) {
    return prisma.report.update({ where: { id }, data: { isPublic } });
  }

  static isValidWidgetType(value: string): value is ReportWidgetType {
    return Object.values(ReportWidgetType).includes(value as ReportWidgetType);
  }
}
