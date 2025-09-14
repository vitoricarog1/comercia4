import axios from 'axios';

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

  verifyWebhook(mode, token, challenge) {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    
    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    
    return null;
  }
}

export default WhatsAppService;