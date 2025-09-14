import express from 'express';
import { body, query, param } from 'express-validator';
import integrationController from '../controllers/integrationController.js';
import { authMiddleware } from '../middleware/auth.js';
import { auditLog } from '../middleware/security.js';
const router = express.Router();

// Use authMiddleware as authenticateToken
const authenticateToken = authMiddleware;

// Get all integrations
router.get('/', 
  authenticateToken,
  auditLog,
  integrationController.getIntegrations
);

// Setup Telegram integration
router.post('/telegram/setup',
  authenticateToken,
  [
    body('botToken')
      .notEmpty()
      .withMessage('Bot token is required')
      .isLength({ min: 10 })
      .withMessage('Invalid bot token format'),
    body('webhookUrl')
      .isURL()
      .withMessage('Valid webhook URL is required')
  ],
  auditLog,
  integrationController.setupTelegram
);

// Setup Instagram integration
router.post('/instagram/setup',
  authenticateToken,
  [
    body('accessToken')
      .notEmpty()
      .withMessage('Access token is required'),
    body('pageId')
      .notEmpty()
      .withMessage('Page ID is required')
  ],
  auditLog,
  integrationController.setupInstagram
);

// Setup Facebook Messenger integration
router.post('/facebook-messenger/setup',
  authenticateToken,
  [
    body('accessToken')
      .notEmpty()
      .withMessage('Access token is required'),
    body('pageId')
      .notEmpty()
      .withMessage('Page ID is required'),
    body('verifyToken')
      .notEmpty()
      .withMessage('Verify token is required')
  ],
  auditLog,
  integrationController.setupFacebookMessenger
);

// Setup Email integration
router.post('/email/setup',
  authenticateToken,
  [
    body('host')
      .notEmpty()
      .withMessage('SMTP host is required'),
    body('port')
      .isInt({ min: 1, max: 65535 })
      .withMessage('Valid port number is required'),
    body('secure')
      .isBoolean()
      .withMessage('Secure flag must be boolean'),
    body('user')
      .isEmail()
      .withMessage('Valid email address is required'),
    body('pass')
      .notEmpty()
      .withMessage('Password is required')
  ],
  auditLog,
  integrationController.setupEmail
);

// Disable integration
router.delete('/:platform',
  authenticateToken,
  [
    param('platform')
      .isIn(['telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp'])
      .withMessage('Invalid platform')
  ],
  auditLog,
  integrationController.disableIntegration
);

// Send message through integration
router.post('/send-message',
  authenticateToken,
  [
    body('platform')
      .isIn(['telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp'])
      .withMessage('Invalid platform'),
    body('recipient')
      .notEmpty()
      .withMessage('Recipient is required'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ max: 4096 })
      .withMessage('Message too long')
  ],
  auditLog,
  integrationController.sendMessage
);

// Get integration messages
router.get('/messages',
  authenticateToken,
  [
    query('platform')
      .optional()
      .isIn(['telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp'])
      .withMessage('Invalid platform'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Offset must be non-negative')
  ],
  integrationController.getMessages
);

// Get integration analytics
router.get('/analytics',
  authenticateToken,
  [
    query('platform')
      .optional()
      .isIn(['telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp'])
      .withMessage('Invalid platform'),
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid start date format'),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid end date format')
  ],
  integrationController.getAnalytics
);

// Test integration connection
router.get('/:platform/test',
  authenticateToken,
  [
    param('platform')
      .isIn(['telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp'])
      .withMessage('Invalid platform')
  ],
  integrationController.testConnection
);

// Webhook endpoints (no authentication required)
// Telegram webhook
router.post('/webhooks/telegram',
  integrationController.telegramWebhook
);

// Facebook webhook (Instagram and Messenger)
router.get('/webhooks/facebook',
  integrationController.facebookWebhook
);

router.post('/webhooks/facebook',
  integrationController.facebookWebhook
);

// WhatsApp webhook (for future implementation)
router.get('/webhooks/whatsapp', (req, res) => {
  // Webhook verification
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

router.post('/webhooks/whatsapp', (req, res) => {
  // WhatsApp webhook handler (to be implemented)
  console.log('WhatsApp webhook received:', req.body);
  res.status(200).send('OK');
});

export default router;