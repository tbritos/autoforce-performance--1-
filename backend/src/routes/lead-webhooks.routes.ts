import express, { NextFunction, Request, Response, Router } from 'express';
import cors from 'cors';
import { LeadWebhooksController } from '../controllers/lead-webhooks.controller';

const publicIngestCors = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],
});

const parseMultipartFormData = (raw: string, contentType: string): Record<string, string> => {
  const boundary = contentType.match(/boundary=([^;]+)/i)?.[1]?.replace(/^"|"$/g, '');
  if (!boundary) return {};
  const fields: Record<string, string> = {};

  for (const part of raw.split(`--${boundary}`)) {
    const name = part.match(/name="([^"]+)"/)?.[1];
    if (!name || part.includes('filename=')) continue;
    const value = part.split(/\r?\n\r?\n/)[1];
    if (value === undefined) continue;
    fields[name] = value.replace(/\r?\n--$/, '').replace(/\r?\n$/, '').trim();
  }

  return fields;
};

const parseTextPayload = (text: string): Record<string, unknown> => {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to form-style parsing.
  }

  if (trimmed.includes('=') && trimmed.includes('&')) {
    return Object.fromEntries(new URLSearchParams(trimmed));
  }

  const lineFields = trimmed
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return null;
      return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()] as const;
    })
    .filter((entry): entry is readonly [string, string] => Boolean(entry?.[0]));

  if (lineFields.length > 0) {
    return Object.fromEntries(lineFields);
  }

  return { raw: text };
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
      req.body = parseTextPayload(text);
    }
  }

  if (
    req.query &&
    Object.keys(req.query).length > 0 &&
    (!req.body || (typeof req.body === 'object' && !Array.isArray(req.body) && Object.keys(req.body).length === 0))
  ) {
    req.body = { ...req.query };
  }

  next();
};

export const publicLeadWebhooksRouter = Router();
publicLeadWebhooksRouter.options('/:publicId', publicIngestCors);
publicLeadWebhooksRouter.get('/:publicId', publicIngestCors, normalizePublicPayload, LeadWebhooksController.ingest);
publicLeadWebhooksRouter.post(
  '/:publicId',
  publicIngestCors,
  express.json({ type: ['application/json', 'application/*+json'], limit: '2mb' }),
  express.urlencoded({ extended: true, type: 'application/x-www-form-urlencoded', limit: '2mb' }),
  express.raw({ type: ['text/plain', 'multipart/form-data', 'application/octet-stream'], limit: '2mb' }),
  normalizePublicPayload,
  LeadWebhooksController.ingest
);

export const protectedLeadWebhooksRouter = Router();
protectedLeadWebhooksRouter.get('/', LeadWebhooksController.listSources);
protectedLeadWebhooksRouter.post('/', LeadWebhooksController.createSource);
protectedLeadWebhooksRouter.get('/by-public/:publicId/inspect', LeadWebhooksController.inspectSourceByPublicId);
protectedLeadWebhooksRouter.patch('/:id', LeadWebhooksController.updateSource);
protectedLeadWebhooksRouter.delete('/:id', LeadWebhooksController.deleteSource);
protectedLeadWebhooksRouter.post('/:id/regenerate-url', LeadWebhooksController.regenerateUrl);
protectedLeadWebhooksRouter.get('/:id/inspect', LeadWebhooksController.inspectSource);
protectedLeadWebhooksRouter.post('/:id/test', LeadWebhooksController.sendTestPayload);
protectedLeadWebhooksRouter.get('/:id/logs', LeadWebhooksController.listLogs);
