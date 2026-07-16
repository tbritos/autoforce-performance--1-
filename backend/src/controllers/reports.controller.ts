import { Request, Response, NextFunction } from 'express';
import { ReportsService, ReportWidgetInput } from '../services/reports.service';
import { runMetricQuery } from '../services/reports/report-query.service';
import { listMetrics } from '../services/reports/metrics-catalog';

export class ReportsController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await ReportsService.list());
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const report = await ReportsService.get(req.params.id);
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
      const createdBy = (req as Request & { user?: { email?: string } }).user?.email ?? null;
      const report = await ReportsService.create({ name: name.trim(), description: description ?? null, createdBy });
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
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

      const report = await ReportsService.update(req.params.id, { name, description, layout, widgets });
      res.json(report);
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await ReportsService.remove(req.params.id);
      res.status(204).end();
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
      const { metricKey, groupBy, filters, dateFrom, dateTo } = req.body as {
        metricKey?: string; groupBy?: string | null; filters?: Record<string, string> | null;
        dateFrom?: string | null; dateTo?: string | null;
      };
      if (!metricKey) {
        res.status(400).json({ error: 'metricKey é obrigatório' });
        return;
      }
      const result = await runMetricQuery({ metricKey, groupBy, filters, dateFrom, dateTo });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
