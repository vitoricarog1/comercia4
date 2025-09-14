import axios from 'axios';
import GeminiService from './geminiService.js';
import { executeMainQuery } from '../config/database.js';

class WhatsAppService {
  constructor() {
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.baseURL = 'https://graph.facebook.com/v18.0';
  }

  async sendMessage(to, message, messageType = 'text') {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp não configurado. Configure WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID');
    }

    try {
      const payload = {
        messaging_product: 'whatsapp',
        to: to.replace(/\D/g, ''), // Remove caracteres não numéricos
        type: messageType
      };

      if (messageType === 'text') {
        payload.text = { body: message };
      }

      const response = await axios.post(
        `${this.baseURL}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: response.data.messages[0].id,
        status: 'sent'
      };
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error.response?.data || error.message);
      throw new Error('Erro ao enviar mensagem via WhatsApp');
    }
  }

  async getProfile(phoneNumber) {
    if (!this.accessToken) {
      throw new Error('WhatsApp não configurado');
    }

    try {
      const response = await axios.get(
        `${this.baseURL}/${phoneNumber.replace(/\D/g, '')}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao obter perfil WhatsApp:', error);
      return null;
    }
  }

  // Webhook para receber mensagens
  handleWebhook(body) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      if (value?.messages) {
        return value.messages.map(message => ({
          id: message.id,
          from: message.from,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text?.body,
          image: message.image,
          document: message.document,
          audio: message.audio
        }));
      }

      return [];
    } catch (error) {
      console.error('Erro ao processar webhook:', error);
      return [];
    }
  }

  // Processar mensagem recebida
  async processIncomingMessage(message, userId) {
    try {
      const { from, text, timestamp } = message;
      
      // Buscar ou criar conversa
      let conversationQuery = `
        SELECT id FROM conversations 
        WHERE customer_phone = ? AND status = 'active' AND user_id = ?
        ORDER BY created_at DESC LIMIT 1
      `;
      
      let conversations = await executeMainQuery(conversationQuery, [from, userId]);
      let conversationId;
      
      if (conversations.length === 0) {
        // Criar nova conversa
        const createConvQuery = `
          INSERT INTO conversations (user_id, customer_phone, channel_type, status, start_time)
          VALUES (?, ?, 'whatsapp', 'active', NOW())
        `;
        
        const result = await executeMainQuery(createConvQuery, [userId, from]);
        conversationId = result.insertId;
      } else {
        conversationId = conversations[0].id;
      }
      
      // Salvar mensagem recebida
      await executeMainQuery(`
        INSERT INTO messages (conversation_id, content, sender, message_type, timestamp)
        VALUES (?, ?, 'user', 'text', FROM_UNIXTIME(?))
      `, [conversationId, text, timestamp]);
      
      // Processar com Gemini
      const geminiResponse = await GeminiService.processAgendamento(text, from, userId);
      
      // Enviar resposta
      if (geminiResponse.resposta) {
        await this.sendMessage(from, geminiResponse.resposta);
        
        // Salvar resposta
        await executeMainQuery(`
          INSERT INTO messages (conversation_id, content, sender, message_type, timestamp)
          VALUES (?, ?, 'agent', 'text', NOW())
        `, [conversationId, geminiResponse.resposta]);
      }
      
      return geminiResponse;
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      throw error;
    }
  }

  verifyWebhook(mode, token, challenge) {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    
    return null;
  }
}

export default WhatsAppService;