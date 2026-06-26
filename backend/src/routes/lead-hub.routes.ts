import { Router } from 'express';
import { LeadHubController } from '../controllers/lead-hub.controller';
import { CustomFieldsController } from '../controllers/custom-fields.controller';

const router = Router();

// ─── Custom field definitions ─────────────────────────────────────────────────
// GET  /api/lead-hub/custom-fields        — list all field definitions
// POST /api/lead-hub/custom-fields        — create a new field definition
router.get('/custom-fields', CustomFieldsController.list);
router.post('/custom-fields', CustomFieldsController.create);

// GET    /api/lead-hub/custom-fields/:id  — get single field definition
// PATCH  /api/lead-hub/custom-fields/:id  — update field definition
// DELETE /api/lead-hub/custom-fields/:id  — delete field definition
router.get('/custom-fields/:id', CustomFieldsController.get);
router.patch('/custom-fields/:id', CustomFieldsController.update);
router.delete('/custom-fields/:id', CustomFieldsController.remove);

// ─── Lead list, export, funnel ───────────────────────────────────────────────
// GET  /api/lead-hub          — paginated list with filters
// GET  /api/lead-hub/export   — CSV download (same filters)
// GET  /api/lead-hub/funnel   — counts by status
// POST /api/lead-hub/migrate-webhook — one-time WebhookLead → Lead migration
router.get('/stats', LeadHubController.getLeadStats);
router.get('/drill-down', LeadHubController.drillDown);
router.get('/export', LeadHubController.exportCsv);
router.post('/import', LeadHubController.importLeads);
router.get('/funnel', LeadHubController.funnel);
router.get('/tags', LeadHubController.getAllTags);
router.get('/by-source', LeadHubController.bySource);
router.get('/conversion-sources', LeadHubController.conversionSources);
router.post('/migrate-webhook', LeadHubController.migrateWebhook);
router.get('/field-values', LeadHubController.getFieldValues);
router.get('/', LeadHubController.list);

// ─── Lead profile ─────────────────────────────────────────────────────────────
// GET    /api/lead-hub/:email                       — full 360° profile
// PATCH  /api/lead-hub/:email/status                — change funnel status
// PATCH  /api/lead-hub/:email/notes                 — update notes
// POST   /api/lead-hub/:email/tags                  — add tag
// DELETE /api/lead-hub/:email/tags/:tag             — remove tag
// PATCH  /api/lead-hub/:email/custom-fields/:field  — patch a single custom field value
// DELETE /api/lead-hub/:email                       — soft delete
router.get('/id/:id', LeadHubController.profileById);
router.get('/id/:id/conversions', LeadHubController.getAllConversions);
router.get('/id/:id/pipedrive-events', LeadHubController.getPipedriveEvents);
router.patch('/id/:id', LeadHubController.updateProfileById);
router.patch('/id/:id/status', LeadHubController.updateStatusById);
router.patch('/id/:id/notes', LeadHubController.updateNotesById);
router.post('/id/:id/tags', LeadHubController.addTagById);
router.delete('/id/:id/tags/:tag', LeadHubController.removeTagById);
router.patch('/id/:id/custom-fields', CustomFieldsController.patchValuesByLeadId);
router.patch('/id/:id/custom-fields/:field', CustomFieldsController.patchValueByLeadId);
router.delete('/id/:id', LeadHubController.deleteLeadById);
router.get('/:email', LeadHubController.profile);
router.patch('/:email/status', LeadHubController.updateStatus);
router.patch('/:email/notes', LeadHubController.updateNotes);
router.post('/:email/tags', LeadHubController.addTag);
router.delete('/:email/tags/:tag', LeadHubController.removeTag);
router.patch('/:email/custom-fields/:field', CustomFieldsController.patchValue);
router.delete('/:email', LeadHubController.deleteLead);

export default router;
