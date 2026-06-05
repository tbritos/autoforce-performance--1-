import { Request, Response, NextFunction } from 'express';
import { LeadHubService, LeadFilter } from '../services/lead-hub.service';
import { LeadStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { PlatformConnectionService } from '../services/platform-connection.service';

function parseFilters(q: Request['query']): LeadFilter {
  return {
    status:     q.status     as LeadStatus | undefined,
    search:     q.search     as string | undefined,
    isHot:      q.isHot === 'true' ? true : q.isHot === 'false' ? false : undefined,
    tag:        q.tag        as string | undefined,
    assignedTo: q.assignedTo as string | undefined,
    startDate:  q.startDate  as string | undefined,
    endDate:    q.endDate    as string | undefined,
    customField: q.customField as string | undefined,
    customValue: q.customValue as string | undefined,
    page:       q.page     ? Number(q.page)     : 1,
    pageSize:   q.pageSize ? Number(q.pageSize) : 25,
  };
}

export class LeadHubController {

  static async getLeadStats(req: Request, res: Response, next: NextFunction) {
    try {
      const { start, end } = req.query as { start?: string; end?: string };
      const startDate = start ? new Date(start) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate   = end   ? new Date(end)   : new Date();
      endDate.setHours(23, 59, 59, 999);
      const stats = await LeadHubService.getLeadStats(startDate, endDate);
      res.json(stats);
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeadHubService.listLeads(parseFilters(req.query));
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  // GET /api/lead-hub/export  — CSV download
  static async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const rows = await LeadHubService.exportLeads(parseFilters(req.query));
      if (rows.length === 0) {
        res.status(204).end();
        return;
      }
      const headers = Object.keys(rows[0]);
      const escape  = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const lines   = [
        headers.join(','),
        ...rows.map(r => headers.map(h => escape(r[h] ?? '')).join(',')),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leads_${new Date().toISOString().slice(0,10)}.csv"`);
      res.send('﻿' + lines.join('\r\n')); // BOM para Excel
    } catch (err) {
      next(err);
    }
  }

  // POST /api/lead-hub/migrate-webhook  — one-time WebhookLead migration
  static async migrateWebhook(_req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LeadHubService.migrateWebhookLeads();
      res.json({ message: 'Migração concluída', ...result });
    } catch (err) {
      next(err);
    }
  }

  static async profile(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
      const lead = await LeadHubService.getLeadProfile(email);
      if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
      res.json(lead);
    } catch (err) {
      next(err);
    }
  }

  static async getAllConversions(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const conversions = await LeadHubService.getAllConversions(id);
      res.json(conversions);
    } catch (err) {
      next(err);
    }
  }

  static async profileById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Lead ID is required' }); return; }
      const lead = await LeadHubService.getLeadProfileById(id);
      if (!lead) { res.status(404).json({ error: 'Lead not found' }); return; }
      res.json(lead);
    } catch (err) {
      next(err);
    }
  }

  static async updateProfileById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Lead ID is required' }); return; }
      const lead = await LeadHubService.updateLeadProfileById(id, req.body);
      res.json(lead);
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      const { status, reason } = req.body as { status: LeadStatus; reason?: string };
      const changedBy = (req as any).user?.email;
      if (!email || !status) {
        res.status(400).json({ error: 'Email and status are required' });
        return;
      }
      const lead = await LeadHubService.updateLeadStatus(email, status, changedBy, reason);
      res.json(lead);
    } catch (err) {
      next(err);
    }
  }

  static async updateStatusById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body as { status: LeadStatus; reason?: string };
      const changedBy = (req as any).user?.email;
      if (!id || !status) {
        res.status(400).json({ error: 'Lead ID and status are required' });
        return;
      }
      const lead = await LeadHubService.updateLeadStatusById(id, status, changedBy, reason);
      res.json(lead);
    } catch (err) {
      next(err);
    }
  }

  static async funnel(_req: Request, res: Response, next: NextFunction) {
    try {
      const counts = await LeadHubService.getFunnelCounts();
      res.json(counts);
    } catch (err) {
      next(err);
    }
  }

  static async getAllTags(_req: Request, res: Response, next: NextFunction) {
    try {
      const tags = await LeadHubService.getAllTags();
      res.json(tags);
    } catch (err) {
      next(err);
    }
  }

  static async bySource(_req: Request, res: Response, next: NextFunction) {
    try {
      const data = await LeadHubService.getBySource();
      res.json(data);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/lead-hub/:email/tags  — body: { tag: string }
  static async addTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      const { tag } = req.body as { tag: string };
      if (!tag?.trim()) { res.status(400).json({ error: 'Tag é obrigatória' }); return; }
      const lead = await LeadHubService.addTag(email, tag.trim());
      res.json({ tags: lead.tags });
    } catch (err) {
      next(err);
    }
  }

  static async addTagById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { tag } = req.body as { tag: string };
      if (!tag?.trim()) { res.status(400).json({ error: 'Tag Ã© obrigatÃ³ria' }); return; }
      const lead = await LeadHubService.addTagById(id, tag.trim());
      res.json({ tags: lead.tags });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/lead-hub/:email/tags/:tag
  static async removeTag(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, tag } = req.params;
      const lead = await LeadHubService.removeTag(email, decodeURIComponent(tag));
      res.json({ tags: lead.tags });
    } catch (err) {
      next(err);
    }
  }

  static async removeTagById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, tag } = req.params;
      const lead = await LeadHubService.removeTagById(id, decodeURIComponent(tag));
      res.json({ tags: lead.tags });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/lead-hub/:email/notes  — body: { notes: string }
  static async updateNotes(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      const { notes } = req.body as { notes: string };
      await LeadHubService.updateNotes(email, notes ?? '');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  static async updateNotesById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { notes } = req.body as { notes: string };
      await LeadHubService.updateNotesById(id, notes ?? '');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  }

  // POST /api/lead-hub/import  — body: { rows: { email, name?, phone?, company?, jobTitle?, city?, state?, tags?, source? }[] }
  static async importLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const { rows } = req.body as { rows?: Record<string, string>[] };
      if (!Array.isArray(rows) || rows.length === 0) {
        res.status(400).json({ error: 'rows deve ser um array não vazio' });
        return;
      }
      if (rows.length > 5000) {
        res.status(400).json({ error: 'Máximo de 5000 leads por importação' });
        return;
      }

      let created = 0, updated = 0, errors = 0;
      const errorDetails: { row: number; email: string; error: string }[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const email = (row.email ?? '').trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          errors++;
          errorDetails.push({ row: i + 1, email: row.email ?? '', error: 'Email inválido' });
          continue;
        }

        try {
          const existing = await LeadHubService.getLeadProfile(email).catch(() => null);

          const tags = row.tags
            ? row.tags.split(/[,;|]/).map((t: string) => t.trim()).filter(Boolean)
            : [];

          await LeadHubService.upsertLead(
            {
              email,
              name: row.name?.trim() || undefined,
              phone: row.phone?.trim() || undefined,
              company: row.company?.trim() || undefined,
              jobTitle: row.jobTitle?.trim() || row.cargo?.trim() || undefined,
              city: row.city?.trim() || row.cidade?.trim() || undefined,
              state: row.state?.trim() || row.estado?.trim() || undefined,
            },
            {
              source: row.source?.trim() || 'importacao_csv',
              medium: undefined,
              campaign: undefined,
              landingPage: undefined,
            }
          );

          if (tags.length > 0) {
            for (const tag of tags) {
              await LeadHubService.addTag(email, tag).catch(() => {});
            }
          }

          if (existing) updated++; else created++;
        } catch (err) {
          errors++;
          errorDetails.push({ row: i + 1, email, error: err instanceof Error ? err.message : String(err) });
        }
      }

      res.json({ ok: true, total: rows.length, created, updated, errors, errorDetails: errorDetails.slice(0, 50) });
    } catch (err) {
      next(err);
    }
  }

  static async deleteLead(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.params;
      if (!email) { res.status(400).json({ error: 'Email is required' }); return; }
      await LeadHubService.deleteLead(email);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  static async deleteLeadById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Lead ID is required' }); return; }
      await LeadHubService.deleteLeadById(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }

  static async getPipedriveEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Lead ID is required' }); return; }

      const lead = await prisma.lead.findUnique({
        where: { id },
        select: { email: true, pipedriveDealId: true },
      });

      if (!lead?.pipedriveDealId) {
        res.json({ events: [], dealUrl: null });
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const events = await (prisma as any).pipedriveDealEvent.findMany({
        where: { leadEmail: lead.email },
        orderBy: { occurredAt: 'asc' },
      });

      // Build Pipedrive deal URL from connection metadata or env
      let dealUrl: string | null = null;
      try {
        const conn = await PlatformConnectionService.getConnection('PIPEDRIVE');
        const meta = (conn?.metadata ?? {}) as Record<string, unknown>;
        const domain = (meta.domain as string) || process.env.PIPEDRIVE_DOMAIN || '';
        if (domain) {
          dealUrl = `https://${domain}.pipedrive.com/deal/${lead.pipedriveDealId}`;
        }
      } catch { /* non-fatal */ }

      res.json({ events, dealUrl });
    } catch (err) {
      next(err);
    }
  }
}
