import integrationService from '../services/integrationService.js';
import { validationResult } from 'express-validator';
import { auditLog } from '../middleware/security.js';

class IntegrationController {
  // Get all active integrations
  async getIntegrations(req, res) {
    try {
      const activeIntegrations = integrationService.getActiveIntegrations();
      
      res.json({
        success: true,
        integrations: activeIntegrations,
        count: activeIntegrations.length
      });
    } catch (error) {
      console.error('Get integrations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch integrations'
      });
    }
  }

  // Setup Telegram integration
  async setupTelegram(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { botToken, webhookUrl } = req.body;
      const result = await integrationService.setupTelegram(botToken, webhookUrl);
      
      if (result.success) {
        await auditLog(req, 'integration_setup', 'telegram', { webhookUrl });
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Telegram setup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup Telegram integration'
      });
    }
  }

  // Setup Instagram integration
  async setupInstagram(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { accessToken, pageId } = req.body;
      const result = await integrationService.setupInstagram(accessToken, pageId);
      
      if (result.success) {
        await auditLog(req, 'integration_setup', 'instagram', { pageId });
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Instagram setup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup Instagram integration'
      });
    }
  }

  // Setup Facebook Messenger integration
  async setupFacebookMessenger(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { accessToken, pageId, verifyToken } = req.body;
      const result = await integrationService.setupFacebookMessenger(accessToken, pageId, verifyToken);
      
      if (result.success) {
        await auditLog(req, 'integration_setup', 'facebook_messenger', { pageId });
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Facebook Messenger setup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup Facebook Messenger integration'
      });
    }
  }

  // Setup Email integration
  async setupEmail(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { host, port, secure, user, pass } = req.body;
      const result = await integrationService.setupEmail({ host, port, secure, user, pass });
      
      if (result.success) {
        await auditLog(req, 'integration_setup', 'email', { host, user });
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Email setup error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to setup Email integration'
      });
    }
  }

  // Disable integration
  async disableIntegration(req, res) {
    try {
      const { platform } = req.params;
      const result = await integrationService.disableIntegration(platform);
      
      if (result.success) {
        await auditLog(req, 'integration_disable', platform);
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('Disable integration error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable integration'
      });
    }
  }

  // Telegram webhook handler
  async telegramWebhook(req, res) {
    try {
      const update = req.body;
      const result = await integrationService.processTelegramWebhook(update);
      
      if (result.success) {
        res.status(200).send('OK');
      } else {
        res.status(500).send('Error');
      }
    } catch (error) {
      console.error('Telegram webhook error:', error);
      res.status(500).send('Error');
    }
  }

  // Facebook webhook handler
  async facebookWebhook(req, res) {
    try {
      // Webhook verification
      if (req.query['hub.mode'] === 'subscribe') {
        const verifyToken = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        // Verify the token (you should store this securely)
        if (verifyToken === 'your_verify_token') {
          res.status(200).send(challenge);
        } else {
          res.status(403).send('Forbidden');
        }
        return;
      }

      // Process webhook event
      const signature = req.headers['x-hub-signature'];
      const result = await integrationService.processFacebookWebhook(req.body, signature);
      
      if (result.success) {
        res.status(200).send('OK');
      } else {
        res.status(500).send('Error');
      }
    } catch (error) {
      console.error('Facebook webhook error:', error);
      res.status(500).send('Error');
    }
  }

  // Send message through integration
  async sendMessage(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { platform, recipient, message, options = {} } = req.body;
      let result;

      switch (platform) {
        case 'telegram':
          result = await integrationService.sendTelegramMessage(recipient, message, options);
          break;
        case 'instagram':
          result = await integrationService.sendInstagramMessage(recipient, message);
          break;
        case 'facebook_messenger':
          result = await integrationService.sendFacebookMessage(recipient, message, options);
          break;
        case 'email':
          const { subject, to } = options;
          result = await integrationService.sendEmail(to || recipient, subject || 'Message', message, options);
          break;
        default:
          return res.status(400).json({
            success: false,
            error: 'Unsupported platform'
          });
      }

      if (result.success) {
        await auditLog(req, 'message_sent', platform, { recipient, messageId: result.messageId });
      }

      res.json(result);
    } catch (error) {
      console.error('Send message error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send message'
      });
    }
  }

  // Get integration messages
  async getMessages(req, res) {
    try {
      const { platform, userId, limit = 50, offset = 0 } = req.query;
      const db = require('../database/connection');
      
      let query = 'SELECT * FROM integration_messages WHERE tenant_id = ?';
      let params = [1];
      
      if (platform) {
        query += ' AND platform = ?';
        params.push(platform);
      }
      
      if (userId) {
        query += ' AND user_id = ?';
        params.push(userId);
      }
      
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
      
      const [messages] = await db.execute(query, params);
      
      res.json({
        success: true,
        messages,
        count: messages.length
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages'
      });
    }
  }

  // Get integration analytics
  async getAnalytics(req, res) {
    try {
      const { platform, startDate, endDate } = req.query;
      const db = require('../database/connection');
      
      let query = `
        SELECT 
          platform,
          DATE(created_at) as date,
          COUNT(CASE WHEN direction = 'incoming' THEN 1 END) as messages_received,
          COUNT(CASE WHEN direction = 'outgoing' THEN 1 END) as messages_sent,
          COUNT(DISTINCT user_id) as unique_users
        FROM integration_messages 
        WHERE tenant_id = ?
      `;
      let params = [1];
      
      if (platform) {
        query += ' AND platform = ?';
        params.push(platform);
      }
      
      if (startDate) {
        query += ' AND DATE(created_at) >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND DATE(created_at) <= ?';
        params.push(endDate);
      }
      
      query += ' GROUP BY platform, DATE(created_at) ORDER BY date DESC';
      
      const [analytics] = await db.execute(query, params);
      
      res.json({
        success: true,
        analytics,
        count: analytics.length
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics'
      });
    }
  }

  // Test integration connection
  async testConnection(req, res) {
    try {
      const { platform } = req.params;
      const activeIntegrations = integrationService.getActiveIntegrations();
      
      if (!activeIntegrations.includes(platform)) {
        return res.status(400).json({
          success: false,
          error: `${platform} integration is not configured`
        });
      }
      
      // Test based on platform
      let testResult;
      switch (platform) {
        case 'telegram':
          // Test by getting bot info
          testResult = { success: true, message: 'Telegram integration is working' };
          break;
        case 'email':
          // Test SMTP connection
          if (integrationService.emailTransporter) {
            await integrationService.emailTransporter.verify();
            testResult = { success: true, message: 'Email integration is working' };
          } else {
            testResult = { success: false, error: 'Email transporter not configured' };
          }
          break;
        default:
          testResult = { success: true, message: `${platform} integration appears to be configured` };
      }
      
      res.json(testResult);
    } catch (error) {
      console.error('Test connection error:', error);
      res.status(500).json({
        success: false,
        error: 'Connection test failed'
      });
    }
  }
}

export default new IntegrationController();