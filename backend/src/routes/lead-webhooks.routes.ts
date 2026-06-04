import { Router } from 'express';
import cors from 'cors';
import { LeadWebhooksController } from '../controllers/lead-webhooks.controller';

const publicIngestCors = cors({
  origin: '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
});

export const publicLeadWebhooksRouter = Router();
publicLeadWebhooksRouter.options('/:publicId', publicIngestCors);
publicLeadWebhooksRouter.post('/:publicId', publicIngestCors, LeadWebhooksController.ingest);

export const protectedLeadWebhooksRouter = Router();
protectedLeadWebhooksRouter.get('/', LeadWebhooksController.listSources);
protectedLeadWebhooksRouter.post('/', LeadWebhooksController.createSource);
protectedLeadWebhooksRouter.patch('/:id', LeadWebhooksController.updateSource);
protectedLeadWebhooksRouter.delete('/:id', LeadWebhooksController.deleteSource);
protectedLeadWebhooksRouter.post('/:id/regenerate-url', LeadWebhooksController.regenerateUrl);
protectedLeadWebhooksRouter.get('/:id/inspect', LeadWebhooksController.inspectSource);
protectedLeadWebhooksRouter.post('/:id/test', LeadWebhooksController.sendTestPayload);
protectedLeadWebhooksRouter.get('/:id/logs', LeadWebhooksController.listLogs);
