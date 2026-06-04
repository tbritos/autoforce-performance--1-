import express, { NextFunction, Request, Response, Router } from 'express';
import cors from 'cors';
import { LeadWebhooksController } from '../controllers/lead-webhooks.controller';

const publicIngestCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
});

const parseMultipartFormData = (raw: string, contentType: string): Record<string, string> => {
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1];
  if (!boundary) return {};
  const fields: Record<string, string> = {};

  for (const part of raw.split(`--${boundary}`)) {
    const name = part.match(/name="([^"]+)"/)?.[1];
    if (!name || part.includes('filename=')) continue;
    const value = part.split('\r\n\r\n')[1];
    if (value === undefined) continue;
    fields[name] = value.replace(/\r\n--$/, '').replace(/\r\n$/, '').trim();
  }

  return fields;
};

const normalizePublicPayload = (req: Request, _res: Response, next: NextFunction) => {
  if (req.method === 'GET') {
    req.body = { ...req.query };
    next();
    return;
  }

  if (Buffer.isBuffer(req.body)) {
    const text = req.body.toString('utf8');
    const contentType = req.headers['content-type'] || '';
    if (String(contentType).includes('multipart/form-data')) {
      req.body = parseMultipartFormData(text, String(contentType));
    } else {
      try {
        req.body = JSON.parse(text);
      } catch {
        req.body = { raw: text };
      }
    }
  }

  next();
};

export const publicLeadWebhooksRouter = Router();
publicLeadWebhooksRouter.options('/:publicId', publicIngestCors);
publicLeadWebhooksRouter.get('/:publicId', publicIngestCors, normalizePublicPayload, LeadWebhooksController.ingest);
publicLeadWebhooksRouter.post(
  '/:publicId',
  publicIngestCors,
  express.raw({ type: ['text/plain', 'multipart/form-data', 'application/octet-stream'], limit: '2mb' }),
  normalizePublicPayload,
  LeadWebhooksController.ingest
);

export const protectedLeadWebhooksRouter = Router();
protectedLeadWebhooksRouter.get('/', LeadWebhooksController.listSources);
protectedLeadWebhooksRouter.post('/', LeadWebhooksController.createSource);
protectedLeadWebhooksRouter.patch('/:id', LeadWebhooksController.updateSource);
protectedLeadWebhooksRouter.delete('/:id', LeadWebhooksController.deleteSource);
protectedLeadWebhooksRouter.post('/:id/regenerate-url', LeadWebhooksController.regenerateUrl);
protectedLeadWebhooksRouter.get('/:id/inspect', LeadWebhooksController.inspectSource);
protectedLeadWebhooksRouter.post('/:id/test', LeadWebhooksController.sendTestPayload);
protectedLeadWebhooksRouter.get('/:id/logs', LeadWebhooksController.listLogs);
