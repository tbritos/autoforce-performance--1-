import { Router } from 'express';
import { WhatsAppController } from '../controllers/whatsapp.controller';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

router.get('/phone-numbers', WhatsAppController.getPhoneNumbers);
router.get('/numbers', WhatsAppController.getNumbers);
router.get('/health', WhatsAppController.getNumberHealth);
router.post('/numbers', WhatsAppController.registerNumber);
router.get('/meeting-slots', WhatsAppController.getMeetingSlots);
router.post('/meeting-bookings/sync', WhatsAppController.syncMeetingBookings);
router.get('/templates', WhatsAppController.getTemplates);
router.get('/inbox', WhatsAppController.getInbox);
router.post('/templates', WhatsAppController.createTemplate);
router.delete('/templates/:templateName', WhatsAppController.deleteTemplate);
router.get('/leads/:leadId/conversation', WhatsAppController.getConversation);
router.post('/media/upload', upload.single('file'), WhatsAppController.uploadMedia);
router.get('/media/:mediaId', WhatsAppController.getMedia);
router.post('/leads/:leadId/send', WhatsAppController.sendMessage);
router.post('/leads/:leadId/send-template', WhatsAppController.sendTemplate);
router.patch('/leads/:leadId/handoff', WhatsAppController.updateHandoff);
router.post('/leads/:leadId/ai-reply', WhatsAppController.triggerAiReply);
router.get('/webhook', WhatsAppController.verifyWebhook);
router.post('/webhook', WhatsAppController.receiveWebhook);

export default router;
