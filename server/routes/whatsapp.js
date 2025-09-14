import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import whatsappController from '../controllers/whatsappController.js';

const router = express.Router();

// Webhook verification (sem auth)
router.get('/webhook', whatsappController.verifyWebhook);
router.post('/webhook', whatsappController.handleWebhook);

// Rotas protegidas
router.use(authMiddleware);

router.post('/send', whatsappController.sendMessage);
router.get('/sessions', whatsappController.getSessions);
router.post('/sessions/:id/assign', whatsappController.assignAgent);

export default router;