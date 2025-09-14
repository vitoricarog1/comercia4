import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import whatsappController from '../controllers/whatsappController.js';
import WhatsAppService from '../services/whatsappService.js';
import { executeMainQuery } from '../config/database.js';

const router = express.Router();

const whatsappService = new WhatsAppService();

// Webhook verification (sem auth)
router.get('/webhook', whatsappController.verifyWebhook);

// Webhook handler - processar mensagens recebidas
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // Verificar se é uma mensagem
    if (body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0]) {
      const change = body.entry[0].changes[0];
      
      if (change.value && change.value.messages) {
        for (const message of change.value.messages) {
          // Buscar usuário da barbearia (assumindo que há apenas um)
          const users = await executeMainQuery(
            'SELECT id FROM users WHERE role = "barbearia" AND is_active = true LIMIT 1'
          );
          
          if (users.length > 0) {
            const userId = users[0].id;
            
            // Processar mensagem
            await whatsappService.processIncomingMessage({
              from: message.from,
              text: message.text?.body || '',
              timestamp: message.timestamp,
              id: message.id
            }, userId);
          }
        }
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no webhook WhatsApp:', error);
    res.status(500).send('Error');
  }
});

// Rotas protegidas
router.use(authMiddleware);

router.post('/send', whatsappController.sendMessage);
router.get('/sessions', whatsappController.getSessions);
router.post('/sessions/:id/assign', whatsappController.assignAgent);

export default router;