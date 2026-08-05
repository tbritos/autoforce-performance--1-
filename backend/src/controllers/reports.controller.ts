import { Request, Response, NextFunction } from 'express';
import { ReportWidgetType } from '@prisma/client';
import { ReportsService } from '../services/reports.service';
import { runMetricQuery } from '../services/reports/report-query.service';
import { runDrillDownQuery } from '../services/reports/report-drilldown.service';
import { listMetrics } from '../services/reports/metrics-catalog';
import { ReportFilterCondition } from '../services/reports/report-filter-ops';
import { getFieldValueOptions } from '../services/reports/report-field-values.service';
import { canEditReport } from '../services/reports/report-access';
import type { AuthUser } from '../services/auth.service';

function currentUser(req: Request): AuthUser | undefined {
  return (req as Request & { user?: AuthUser }).user;
}

export class ReportsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await ReportsService.list(currentUser(req)));
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.getForUser(req.params.id, currentUser(req));
      if (!report) {
        res.status(404).json({ error: 'Relatório não encontrado' });
        return;
      }
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, description } = req.body as { name?: string; description?: string };
      if (!name || !name.trim()) {
        res.status(400).json({ error: 'Nome é obrigatório' });
        return;
      }
      const createdBy = currentUser(req)?.email ?? null;
      const report = await ReportsService.create({ name: name.trim(), description: description ?? null, createdBy });
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = currentUser(req);
      const existing = await ReportsService.get(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Relatório não encontrado' });
        return;
      }
      if (!canEditReport(existing, user)) {
        res.status(403).json({ error: 'Você não tem permissão para editar este relatório' });
        return;
      }

      const { name, description, metricKey, groupBy, chartType, filters, dateFrom, dateTo, datePreset, tableColumns } = req.body as {
        name?: string; description?: string | null; metricKey?: string | null; groupBy?: string | null; chartType?: ReportWidgetType;
        filters?: Record<string, string> | null; dateFrom?: string | null; dateTo?: string | null; datePreset?: string | null;
        tableColumns?: string[] | null;
      };

      if (chartType !== undefined && !ReportsService.isValidWidgetType(chartType)) {
        res.status(400).json({ error: `Tipo de gráfico inválido: ${chartType}` });
        return;
      }

      if (tableColumns !== undefined && tableColumns !== null) {
        const valid = Array.isArray(tableColumns)
          && tableColumns.length <= 50
          && tableColumns.every(column => typeof column === 'string' && column.length > 0 && column.length <= 120);
        if (!valid) {
          res.status(400).json({ error: 'Configuração de colunas inválida' });
          return;
        }
      }

      const report = await ReportsService.update(req.params.id, { name, description, metricKey, groupBy, chartType, filters, dateFrom, dateTo, datePreset, tableColumns }, user);
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const existing = await ReportsService.get(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Relatório não encontrado' });
        return;
      }
      if (!canEditReport(existing, currentUser(req))) {
        res.status(403).json({ error: 'Você não tem permissão para excluir este relatório' });
        return;
      }
      await ReportsService.remove(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  static async toggleFavorite(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.toggleFavorite(req.params.id);
      res.json({ isFavorite: report.isFavorite });
    } catch (err) {
      next(err);
    }
  }

  static async updatePrivacy(req: Request, res: Response, next: NextFunction) {
    try {
      const { isPublic } = req.body as { isPublic?: boolean };
      if (typeof isPublic !== 'boolean') {
        res.status(400).json({ error: 'isPublic (boolean) é obrigatório' });
        return;
      }
      const existing = await ReportsService.get(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Relatório não encontrado' });
        return;
      }
      if (!canEditReport(existing, currentUser(req))) {
        res.status(403).json({ error: 'Você não tem permissão para alterar a privacidade deste relatório' });
        return;
      }
      const report = await ReportsService.updatePrivacy(req.params.id, isPublic);
      res.json({ isPublic: report.isPublic });
    } catch (err) {
      next(err);
    }
  }

  static async metrics(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(listMetrics());
    } catch (err) {
      next(err);
    }
  }

  static async fieldValues(req: Request, res: Response, next: NextFunction) {
    try {
      const source = String(req.query.source ?? '');
      const field = String(req.query.field ?? '');
      if (!source || !field) {
        res.status(400).json({ error: 'source e field são obrigatórios' });
        return;
      }
      const options = await getFieldValueOptions(source, field);
      if (options === null) {
        res.status(400).json({ error: 'source/field inválido' });
        return;
      }
      res.json({ options });
    } catch (err) {
      next(err);
    }
  }

  static async queryMetric(req: Request, res: Response, next: NextFunction) {
    try {
      const { metricKey, groupBy, filters, dateFrom, dateTo, datePreset } = req.body as {
        metricKey?: string; groupBy?: string | null; filters?: ReportFilterCondition[] | null;
        dateFrom?: string | null; dateTo?: string | null; datePreset?: string | null;
      };
      if (!metricKey) {
        res.status(400).json({ error: 'metricKey é obrigatório' });
        return;
      }
      const result = await runMetricQuery({ metricKey, groupBy, filters, dateFrom, dateTo, datePreset });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  static async drillDown(req: Request, res: Response, next: NextFunction) {
    try {
      const { metricKey, groupBy, dimension, filters, dateFrom, dateTo, datePreset, page, pageSize } = req.body as {
        metricKey?: string; groupBy?: string | null; dimension?: string | null;
        filters?: ReportFilterCondition[] | null; dateFrom?: string | null; dateTo?: string | null;
        datePreset?: string | null; page?: number; pageSize?: number;
      };
      if (!metricKey) {
        res.status(400).json({ error: 'metricKey é obrigatório' });
        return;
      }
      const result = await runDrillDownQuery({ metricKey, groupBy, dimension, filters, dateFrom, dateTo, datePreset, page, pageSize });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
