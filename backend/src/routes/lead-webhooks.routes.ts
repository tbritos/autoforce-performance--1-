import { Router } from 'express';
import { LeadWebhooksController } from '../controllers/lead-webhooks.controller';

export const publicLeadWebhooksRouter = Router();
publicLeadWebhooksRouter.post('/:publicId', LeadWebhooksController.ingest);

export const protectedLeadWebhooksRouter = Router();
protectedLeadWebhooksRouter.get('/', LeadWebhooksController.listSources);
protectedLeadWebhooksRouter.post('/', LeadWebhooksController.createSource);
protectedLeadWebhooksRouter.patch('/:id', LeadWebhooksController.updateSource);
protectedLeadWebhooksRouter.delete('/:id', LeadWebhooksController.deleteSource);
protectedLeadWebhooksRouter.post('/:id/regenerate-url', LeadWebhooksController.regenerateUrl);
protectedLeadWebhooksRouter.get('/:id/inspect', LeadWebhooksController.inspectSource);
protectedLeadWebhooksRouter.get('/:id/logs', LeadWebhooksController.listLogs);
