import { Request, Response, NextFunction } from 'express';
import { ReportsService, ReportWidgetInput } from '../services/reports.service';
import { runMetricQuery } from '../services/reports/report-query.service';
import { runDrillDownQuery } from '../services/reports/report-drilldown.service';
import { listMetrics } from '../services/reports/metrics-catalog';
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

      const { name, description, layout, widgets } = req.body as {
        name?: string; description?: string | null; layout?: unknown; widgets?: ReportWidgetInput[];
      };

      if (widgets) {
        for (const w of widgets) {
          if (!w.id || !w.type || !w.title || !w.metricKey) {
            res.status(400).json({ error: 'Cada widget precisa de id, type, title e metricKey' });
            return;
          }
          if (!ReportsService.isValidWidgetType(w.type)) {
            res.status(400).json({ error: `Tipo de widget inválido: ${w.type}` });
            return;
          }
        }
      }

      const report = await ReportsService.update(req.params.id, { name, description, layout, widgets }, user);
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

  static async queryMetric(req: Request, res: Response, next: NextFunction) {
    try {
      const { metricKey, groupBy, filters, dateFrom, dateTo, datePreset } = req.body as {
        metricKey?: string; groupBy?: string | null; filters?: Record<string, string> | null;
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
        filters?: Record<string, string> | null; dateFrom?: string | null; dateTo?: string | null;
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
