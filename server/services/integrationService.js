import axios from 'axios';
import nodemailer from 'nodemailer';
import encryptionService from './encryptionService.js';
import { executeMainQuery } from '../config/database.js';

// Use executeMainQuery as db
const db = { query: executeMainQuery };

class IntegrationService {
  constructor() {
    this.telegramBot = null;
    this.emailTransporter = null;
    this.integrations = new Map();
  }

  // Telegram Integration
  async setupTelegram(botToken, webhookUrl) {
    try {
      const encryptedToken = encryptionService.encrypt(botToken);
      
      // Store encrypted token in database
      await db.execute(
        'INSERT INTO integration_settings (tenant_id, platform, config, is_active) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE config = ?, is_active = ?',
        [1, 'telegram', JSON.stringify({ token: encryptedToken, webhook: webhookUrl }), true, JSON.stringify({ token: encryptedToken, webhook: webhookUrl }), true]
      );

      // Set webhook
      const response = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        url: webhookUrl
      });

      if (response.data.ok) {
        this.integrations.set('telegram', { token: botToken, webhook: webhookUrl });
        return { success: true, message: 'Telegram integration configured successfully' };
      }
      
      throw new Error('Failed to set Telegram webhook');
    } catch (error) {
      console.error('Telegram setup error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTelegramMessage(chatId, message, options = {}) {
    try {
      const integration = this.integrations.get('telegram');
      if (!integration) {
        throw new Error('Telegram integration not configured');
      }

      const response = await axios.post(`https://api.telegram.org/bot${integration.token}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: options.parseMode || 'HTML',
        reply_markup: options.keyboard || null
      });

      return { success: true, messageId: response.data.result.message_id };
    } catch (error) {
      console.error('Telegram send error:', error);
      return { success: false, error: error.message };
    }
  }

  async processTelegramWebhook(update) {
    try {
      if (update.message) {
        const { chat, text, from } = update.message;
        
        // Store incoming message
        await this.storeIncomingMessage('telegram', from.id, chat.id, text);
        
        // Process with AI agent
        const response = await this.processWithAI(text, {
          platform: 'telegram',
          userId: from.id,
          chatId: chat.id,
          userName: from.first_name || from.username
        });

        // Send response back
        if (response) {
          await this.sendTelegramMessage(chat.id, response);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Telegram webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Instagram Integration (via Graph API)
  async setupInstagram(accessToken, pageId) {
    try {
      const encryptedToken = encryptionService.encrypt(accessToken);
      
      await db.execute(
        'INSERT INTO integration_settings (tenant_id, platform, config, is_active) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE config = ?, is_active = ?',
        [1, 'instagram', JSON.stringify({ token: encryptedToken, pageId }), true, JSON.stringify({ token: encryptedToken, pageId }), true]
      );

      // Verify token
      const response = await axios.get(`https://graph.facebook.com/v18.0/me?access_token=${accessToken}`);
      
      if (response.data.id) {
        this.integrations.set('instagram', { token: accessToken, pageId });
        return { success: true, message: 'Instagram integration configured successfully' };
      }
      
      throw new Error('Invalid Instagram access token');
    } catch (error) {
      console.error('Instagram setup error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendInstagramMessage(recipientId, message) {
    try {
      const integration = this.integrations.get('instagram');
      if (!integration) {
        throw new Error('Instagram integration not configured');
      }

      const response = await axios.post(`https://graph.facebook.com/v18.0/${integration.pageId}/messages`, {
        recipient: { id: recipientId },
        message: { text: message }
      }, {
        headers: {
          'Authorization': `Bearer ${integration.token}`
        }
      });

      return { success: true, messageId: response.data.message_id };
    } catch (error) {
      console.error('Instagram send error:', error);
      return { success: false, error: error.message };
    }
  }

  // Facebook Messenger Integration
  async setupFacebookMessenger(accessToken, pageId, verifyToken) {
    try {
      const encryptedToken = encryptionService.encrypt(accessToken);
      
      await db.execute(
        'INSERT INTO integration_settings (tenant_id, platform, config, is_active) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE config = ?, is_active = ?',
        [1, 'facebook_messenger', JSON.stringify({ token: encryptedToken, pageId, verifyToken }), true, JSON.stringify({ token: encryptedToken, pageId, verifyToken }), true]
      );

      this.integrations.set('facebook_messenger', { token: accessToken, pageId, verifyToken });
      return { success: true, message: 'Facebook Messenger integration configured successfully' };
    } catch (error) {
      console.error('Facebook Messenger setup error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendFacebookMessage(recipientId, message, options = {}) {
    try {
      const integration = this.integrations.get('facebook_messenger');
      if (!integration) {
        throw new Error('Facebook Messenger integration not configured');
      }

      const payload = {
        recipient: { id: recipientId },
        message: { text: message }
      };

      if (options.quickReplies) {
        payload.message.quick_replies = options.quickReplies;
      }

      const response = await axios.post(`https://graph.facebook.com/v18.0/${integration.pageId}/messages`, payload, {
        headers: {
          'Authorization': `Bearer ${integration.token}`
        }
      });

      return { success: true, messageId: response.data.message_id };
    } catch (error) {
      console.error('Facebook send error:', error);
      return { success: false, error: error.message };
    }
  }

  async processFacebookWebhook(body, signature) {
    try {
      // Verify webhook signature
      const integration = this.integrations.get('facebook_messenger');
      if (!integration) {
        throw new Error('Facebook Messenger integration not configured');
      }

      if (body.object === 'page') {
        body.entry.forEach(async (entry) => {
          const webhookEvent = entry.messaging[0];
          
          if (webhookEvent.message) {
            const senderId = webhookEvent.sender.id;
            const message = webhookEvent.message.text;
            
            // Store incoming message
            await this.storeIncomingMessage('facebook_messenger', senderId, entry.id, message);
            
            // Process with AI agent
            const response = await this.processWithAI(message, {
              platform: 'facebook_messenger',
              userId: senderId,
              pageId: entry.id
            });

            // Send response back
            if (response) {
              await this.sendFacebookMessage(senderId, response);
            }
          }
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error('Facebook webhook processing error:', error);
      return { success: false, error: error.message };
    }
  }

  // Email Integration
  async setupEmail(config) {
    try {
      const encryptedConfig = {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        pass: encryptionService.encrypt(config.pass)
      };
      
      await db.execute(
        'INSERT INTO integration_settings (tenant_id, platform, config, is_active) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE config = ?, is_active = ?',
        [1, 'email', JSON.stringify(encryptedConfig), true, JSON.stringify(encryptedConfig), true]
      );

      // Create transporter
      this.emailTransporter = nodemailer.createTransporter({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass
        }
      });

      // Verify connection
      await this.emailTransporter.verify();
      
      this.integrations.set('email', config);
      return { success: true, message: 'Email integration configured successfully' };
    } catch (error) {
      console.error('Email setup error:', error);
      return { success: false, error: error.message };
    }
  }

  async sendEmail(to, subject, content, options = {}) {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email integration not configured');
      }

      const mailOptions = {
        from: options.from || this.integrations.get('email').user,
        to,
        subject,
        html: content,
        attachments: options.attachments || []
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  // Common methods
  async storeIncomingMessage(platform, userId, chatId, message) {
    try {
      await db.execute(
        'INSERT INTO integration_messages (tenant_id, platform, user_id, chat_id, message, direction, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [1, platform, userId, chatId, message, 'incoming']
      );
    } catch (error) {
      console.error('Error storing incoming message:', error);
    }
  }

  async storeOutgoingMessage(platform, userId, chatId, message) {
    try {
      await db.execute(
        'INSERT INTO integration_messages (tenant_id, platform, user_id, chat_id, message, direction, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [1, platform, userId, chatId, message, 'outgoing']
      );
    } catch (error) {
      console.error('Error storing outgoing message:', error);
    }
  }

  async processWithAI(message, context) {
    try {
      // This would integrate with your existing AI agent system
      // For now, return a simple response
      const response = `Received your message: "${message}". This is an automated response from our AI agent.`;
      
      // Store outgoing message
      await this.storeOutgoingMessage(context.platform, context.userId, context.chatId || context.pageId, response);
      
      return response;
    } catch (error) {
      console.error('AI processing error:', error);
      return 'Sorry, I encountered an error processing your message. Please try again later.';
    }
  }

  async loadIntegrations() {
    try {
      const rows = await db.query(
        'SELECT platform, config FROM integration_settings WHERE tenant_id = ? AND is_active = true',
        [1]
      );

      for (const row of rows) {
        const config = JSON.parse(row.config);
        
        switch (row.platform) {
          case 'telegram':
            if (config.token) {
              const decryptedToken = encryptionService.decrypt(config.token);
              this.integrations.set('telegram', { token: decryptedToken, webhook: config.webhook });
            }
            break;
          case 'instagram':
            if (config.token) {
              const decryptedToken = encryptionService.decrypt(config.token);
              this.integrations.set('instagram', { token: decryptedToken, pageId: config.pageId });
            }
            break;
          case 'facebook_messenger':
            if (config.token) {
              const decryptedToken = encryptionService.decrypt(config.token);
              this.integrations.set('facebook_messenger', { 
                token: decryptedToken, 
                pageId: config.pageId, 
                verifyToken: config.verifyToken 
              });
            }
            break;
          case 'email':
            if (config.pass) {
              const decryptedPass = encryptionService.decrypt(config.pass);
              const emailConfig = {
                host: config.host,
                port: config.port,
                secure: config.secure,
                user: config.user,
                pass: decryptedPass
              };
              
              this.emailTransporter = nodemailer.createTransporter({
                host: config.host,
                port: config.port,
                secure: config.secure,
                auth: {
                  user: config.user,
                  pass: decryptedPass
                }
              });
              
              this.integrations.set('email', emailConfig);
            }
            break;
        }
      }
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  }

  getActiveIntegrations() {
    return Array.from(this.integrations.keys());
  }

  async disableIntegration(platform) {
    try {
      await db.execute(
        'UPDATE integration_settings SET is_active = false WHERE tenant_id = ? AND platform = ?',
        [1, platform]
      );
      
      this.integrations.delete(platform);
      return { success: true, message: `${platform} integration disabled` };
    } catch (error) {
      console.error('Error disabling integration:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new IntegrationService();