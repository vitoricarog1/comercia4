import WhatsAppService from '../services/whatsappService.js';
import AIService from '../services/aiService.js';
import { executeUserQuery } from '../config/database.js';

const whatsappService = new WhatsAppService();

const whatsappController = {
  // Verificar webhook
  verifyWebhook(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const result = whatsappService.verifyWebhook(mode, token, challenge);
    
    if (result) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  },

  // Processar mensagens recebidas
  async handleWebhook(req, res) {
    try {
      const messages = whatsappService.handleWebhook(req.body);
      
      for (const message of messages) {
        await this.processIncomingMessage(message);
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Erro no webhook:', error);
      res.status(500).send('Error');
    }
  },

  // Processar mensagem recebida
  async processIncomingMessage(message) {
    try {
      // Buscar sessão ativa ou criar nova
      const phoneNumber = message.from;
      
      // Buscar em todos os bancos de usuários por uma sessão ativa
      const { executeMainQuery } = require('../config/database');
      const users = await executeMainQuery('SELECT id FROM users WHERE role = "user" AND is_active = true');
      
      let session = null;
      let userId = null;

      for (const user of users) {
        try {
          const [sessions] = await executeUserQuery(user.id, 
            'SELECT * FROM whatsapp_sessions WHERE phone_number = ? AND status = "active"', 
            [phoneNumber]
          );
          
          if (sessions.length > 0) {
            session = sessions[0];
            userId = user.id;
            break;
          }
        } catch (error) {
          // Usuário pode não ter banco ainda
          continue;
        }
      }

      // Se não encontrou sessão, criar nova no primeiro usuário ativo
      if (!session && users.length > 0) {
        userId = users[0].id;
        const [result] = await executeUserQuery(userId, `
          INSERT INTO whatsapp_sessions (phone_number, status, last_activity)
          VALUES (?, 'active', NOW())
        `, [phoneNumber]);
        
        session = { id: result.insertId, phone_number: phoneNumber };
      }

      if (!session) return;

      // Buscar conversa ou criar nova
      let [conversations] = await executeUserQuery(userId, 
        'SELECT * FROM conversations WHERE customer_phone = ? AND status = "active"', 
        [phoneNumber]
      );
      
      let conversation = conversations[0];
      
      if (!conversation) {
        const [result] = await executeUserQuery(userId, `
          INSERT INTO conversations (customer_phone, channel_type, status, start_time)
          VALUES (?, 'whatsapp', 'active', NOW())
        `, [phoneNumber]);
        
        conversation = { id: result.insertId };
      }

      // Salvar mensagem recebida
      await executeUserQuery(userId, `
        INSERT INTO messages (conversation_id, content, sender, message_type, whatsapp_message_id, timestamp)
        VALUES (?, ?, 'user', ?, ?, NOW())
      `, [conversation.id, message.text || '', message.type || 'text', message.id]);

      // Se há agente atribuído, gerar resposta automática
      if (session.agent_id) {
        const [agents] = await executeUserQuery(userId, 'SELECT * FROM agents WHERE id = ?', [session.agent_id]);
        const agent = agents[0];

        if (agent && agent.is_active) {
          const aiResponse = await AIService.generateWithRAG(
            userId,
            agent.ai_provider,
            agent.model,
            message.text || '',
            agent,
            agent.temperature,
            agent.max_tokens
          );

          // Enviar resposta via WhatsApp
          await whatsappService.sendMessage(phoneNumber, aiResponse);

          // Salvar resposta no banco
          await executeUserQuery(userId, `
            INSERT INTO messages (conversation_id, content, sender, message_type, timestamp)
            VALUES (?, ?, 'agent', 'text', NOW())
          `, [conversation.id, aiResponse]);
        }
      }

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  },

  // Enviar mensagem
  async sendMessage(req, res) {
    try {
      const { phoneNumber, message, conversationId } = req.body;
      const userId = req.userId;

      const result = await whatsappService.sendMessage(phoneNumber, message);

      // Salvar no banco
      if (conversationId) {
        await executeUserQuery(userId, `
          INSERT INTO messages (conversation_id, content, sender, message_type, timestamp)
          VALUES (?, ?, 'agent', 'text', NOW())
        `, [conversationId, message]);
      }

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  },

  // Obter sessões
  async getSessions(req, res) {
    try {
      const userId = req.userId;

      const sessions = await executeUserQuery(userId, `
        SELECT ws.*, a.name as agent_name,
               COUNT(m.id) as message_count,
               MAX(m.timestamp) as last_message
        FROM whatsapp_sessions ws
        LEFT JOIN agents a ON ws.agent_id = a.id
        LEFT JOIN conversations c ON c.customer_phone = ws.phone_number
        LEFT JOIN messages m ON m.conversation_id = c.id
        GROUP BY ws.id
        ORDER BY ws.last_activity DESC
      `);

      res.json({
        success: true,
        data: { sessions }
      });

    } catch (error) {
      console.error('Erro ao buscar sessões:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  // Atribuir agente
  async assignAgent(req, res) {
    try {
      const { id } = req.params;
      const { agentId } = req.body;
      const userId = req.userId;

      await executeUserQuery(userId, `
        UPDATE whatsapp_sessions 
        SET agent_id = ?, updated_at = NOW()
        WHERE id = ?
      `, [agentId, id]);

      res.json({
        success: true,
        message: 'Agente atribuído com sucesso'
      });

    } catch (error) {
      console.error('Erro ao atribuir agente:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  }
};

export default whatsappController;