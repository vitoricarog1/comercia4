import { executeUserQuery, executeMainQuery } from '../config/database.js';
import AIService from '../services/aiService.js';

class SocketHandlers {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
  }

  // Inicializar handlers
  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`🔌 Cliente conectado: ${socket.id}`);

      // Autenticação do socket
      socket.on('authenticate', async (data) => {
        try {
          const { userId, token } = data;
          
          // Verificar token (implementar validação JWT)
          if (this.validateToken(token, userId)) {
            this.connectedUsers.set(userId, socket.id);
            this.userSockets.set(socket.id, userId);
            
            socket.userId = userId;
            socket.join(`user_${userId}`);
            
            console.log(`✅ Usuário ${userId} autenticado no socket ${socket.id}`);
            
            // Enviar status de conexão
            socket.emit('authenticated', { success: true, userId });
            
            // Enviar dados iniciais
            await this.sendInitialData(socket, userId);
          } else {
            socket.emit('authentication_error', { error: 'Token inválido' });
          }
        } catch (error) {
          console.error('Erro na autenticação do socket:', error);
          socket.emit('authentication_error', { error: 'Erro interno' });
        }
      });

      // Handler para nova mensagem
      socket.on('send_message', async (data) => {
        await this.handleSendMessage(socket, data);
      });

      // Handler para typing indicator
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handler para atualização de status de agente
      socket.on('update_agent_status', async (data) => {
        await this.handleAgentStatusUpdate(socket, data);
      });

      // Handler para join conversation room
      socket.on('join_conversation', (data) => {
        this.handleJoinConversation(socket, data);
      });

      // Handler para leave conversation room
      socket.on('leave_conversation', (data) => {
        this.handleLeaveConversation(socket, data);
      });

      // Handler para buscar mensagens em tempo real
      socket.on('get_conversation_messages', async (data) => {
        await this.handleGetConversationMessages(socket, data);
      });

      // Handler para WhatsApp session updates
      socket.on('whatsapp_session_update', async (data) => {
        await this.handleWhatsAppSessionUpdate(socket, data);
      });

      // Handler para métricas em tempo real
      socket.on('get_real_time_metrics', async () => {
        await this.handleGetRealTimeMetrics(socket);
      });

      // Desconexão
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  // Validar token JWT (implementar com biblioteca jwt)
  validateToken(token, userId) {
    // TODO: Implementar validação JWT real
    // Por enquanto, aceitar qualquer token não vazio
    return token && userId;
  }

  // Enviar dados iniciais após autenticação
  async sendInitialData(socket, userId) {
    try {
      // Buscar conversas ativas
      const conversations = await executeUserQuery(userId, `
        SELECT c.*, a.name as agent_name, a.is_active as agent_status,
               COUNT(m.id) as message_count,
               MAX(m.timestamp) as last_message_time
        FROM conversations c
        LEFT JOIN agents a ON c.agent_id = a.id
        LEFT JOIN messages m ON m.conversation_id = c.id
        WHERE c.status = 'active'
        GROUP BY c.id
        ORDER BY c.updated_at DESC
        LIMIT 20
      `);

      // Buscar agentes ativos
      const agents = await executeUserQuery(userId, `
        SELECT id, name, is_active as status, ai_provider, model, is_active
        FROM agents
        WHERE is_active = true
        ORDER BY name
      `);

      // Buscar sessões WhatsApp ativas
      const whatsappSessions = await executeUserQuery(userId, `
        SELECT ws.*, a.name as agent_name
        FROM whatsapp_sessions ws
        LEFT JOIN agents a ON ws.agent_id = a.id
        WHERE ws.status = 'active'
        ORDER BY ws.last_activity DESC
        LIMIT 10
      `);

      socket.emit('initial_data', {
        conversations,
        agents,
        whatsappSessions,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao enviar dados iniciais:', error);
      socket.emit('error', { message: 'Erro ao carregar dados iniciais' });
    }
  }

  // Handler para envio de mensagem
  async handleSendMessage(socket, data) {
    try {
      const { conversationId, message, agentId } = data;
      const userId = socket.userId;

      if (!userId || !conversationId || !message || !agentId) {
        socket.emit('message_error', { error: 'Dados incompletos' });
        return;
      }

      // Verificar se a conversa existe
      const conversations = await executeUserQuery(userId, 
        'SELECT * FROM conversations WHERE id = ?', [conversationId]
      );
      
      if (conversations.length === 0) {
        socket.emit('message_error', { error: 'Conversa não encontrada' });
        return;
      }

      // Buscar agente
      const agents = await executeUserQuery(userId, 
        'SELECT * FROM agents WHERE id = ? AND is_active = true', [agentId]
      );
      
      if (agents.length === 0) {
        socket.emit('message_error', { error: 'Agente não encontrado' });
        return;
      }

      const agent = agents[0];

      // Salvar mensagem do usuário
      const userMsgResult = await executeUserQuery(userId, `
        INSERT INTO messages (conversation_id, content, sender, message_type, timestamp)
        VALUES (?, ?, 'user', 'text', NOW())
      `, [conversationId, message]);

      const userMessage = {
        id: userMsgResult.insertId,
        conversation_id: conversationId,
        content: message,
        sender: 'user',
        message_type: 'text',
        timestamp: new Date().toISOString()
      };

      // Emitir mensagem do usuário para todos na conversa
      this.io.to(`conversation_${conversationId}`).emit('new_message', userMessage);

      // Gerar resposta da IA
      const startTime = Date.now();
      const aiResponse = await AIService.generateWithRAG(
        userId,
        agent.ai_provider,
        agent.model,
        message,
        agent,
        agent.temperature,
        agent.max_tokens
      );
      const responseTime = (Date.now() - startTime) / 1000;

      // Salvar resposta da IA
      const aiMsgResult = await executeUserQuery(userId, `
        INSERT INTO messages (conversation_id, content, sender, message_type, response_time, timestamp)
        VALUES (?, ?, 'agent', 'text', ?, NOW())
      `, [conversationId, aiResponse, responseTime]);

      const aiMessage = {
        id: aiMsgResult.insertId,
        conversation_id: conversationId,
        content: aiResponse,
        sender: 'agent',
        message_type: 'text',
        response_time: responseTime,
        timestamp: new Date().toISOString()
      };

      // Emitir resposta da IA
      this.io.to(`conversation_${conversationId}`).emit('new_message', aiMessage);

      // Atualizar conversa
      await executeUserQuery(userId, `
        UPDATE conversations SET updated_at = NOW() WHERE id = ?
      `, [conversationId]);

      // Emitir atualização da conversa
      this.io.to(`user_${userId}`).emit('conversation_updated', {
        id: conversationId,
        updated_at: new Date().toISOString(),
        last_message: aiMessage
      });

    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      socket.emit('message_error', { error: 'Erro interno do servidor' });
    }
  }

  // Handler para typing indicators
  handleTypingStart(socket, data) {
    const { conversationId } = data;
    if (conversationId) {
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        userId: socket.userId,
        conversationId
      });
    }
  }

  handleTypingStop(socket, data) {
    const { conversationId } = data;
    if (conversationId) {
      socket.to(`conversation_${conversationId}`).emit('user_stopped_typing', {
        userId: socket.userId,
        conversationId
      });
    }
  }

  // Handler para atualização de status de agente
  async handleAgentStatusUpdate(socket, data) {
    try {
      const { agentId, status } = data;
      const userId = socket.userId;

      if (!agentId || !status) {
        socket.emit('agent_status_error', { error: 'Dados incompletos' });
        return;
      }

      // Atualizar status do agente
      await executeUserQuery(userId, 
        'UPDATE agents SET is_active = ?, updated_at = NOW() WHERE id = ?', 
        [status, agentId]
      );

      // Emitir atualização para todos os usuários
      this.io.to(`user_${userId}`).emit('agent_status_updated', {
        agentId,
        status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao atualizar status do agente:', error);
      socket.emit('agent_status_error', { error: 'Erro interno' });
    }
  }

  // Handler para join conversation room
  handleJoinConversation(socket, data) {
    const { conversationId } = data;
    if (conversationId) {
      socket.join(`conversation_${conversationId}`);
      console.log(`👥 Socket ${socket.id} entrou na conversa ${conversationId}`);
    }
  }

  // Handler para leave conversation room
  handleLeaveConversation(socket, data) {
    const { conversationId } = data;
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
      console.log(`👋 Socket ${socket.id} saiu da conversa ${conversationId}`);
    }
  }

  // Handler para buscar mensagens da conversa
  async handleGetConversationMessages(socket, data) {
    try {
      const { conversationId, limit = 50, offset = 0 } = data;
      const userId = socket.userId;

      const messages = await executeUserQuery(userId, `
        SELECT id, content, sender, message_type, response_time, timestamp
        FROM messages
        WHERE conversation_id = ?
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `, [conversationId, parseInt(limit), parseInt(offset)]);

      socket.emit('conversation_messages', {
        conversationId,
        messages: messages.reverse(), // Reverter para ordem cronológica
        hasMore: messages.length === parseInt(limit)
      });

    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      socket.emit('messages_error', { error: 'Erro ao carregar mensagens' });
    }
  }

  // Handler para atualizações de sessão WhatsApp
  async handleWhatsAppSessionUpdate(socket, data) {
    try {
      const { sessionId, status, metadata } = data;
      const userId = socket.userId;

      await executeUserQuery(userId, `
        UPDATE whatsapp_sessions 
        SET status = ?, metadata = ?, last_activity = NOW(), updated_at = NOW()
        WHERE id = ?
      `, [status, JSON.stringify(metadata || {}), sessionId]);

      // Emitir atualização para todos os usuários
      this.io.to(`user_${userId}`).emit('whatsapp_session_updated', {
        sessionId,
        status,
        metadata,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erro ao atualizar sessão WhatsApp:', error);
      socket.emit('whatsapp_session_error', { error: 'Erro interno' });
    }
  }

  // Handler para métricas em tempo real
  async handleGetRealTimeMetrics(socket) {
    try {
      const userId = socket.userId;

      // Buscar métricas básicas
      const [conversationsCount] = await executeUserQuery(userId, 
        'SELECT COUNT(*) as count FROM conversations WHERE status = "active"'
      );
      
      const [messagesCount] = await executeUserQuery(userId, 
        'SELECT COUNT(*) as count FROM messages WHERE DATE(timestamp) = CURDATE()'
      );
      
      const [agentsCount] = await executeUserQuery(userId, 
        'SELECT COUNT(*) as count FROM agents WHERE is_active = true'
      );
      
      const [whatsappSessionsCount] = await executeUserQuery(userId, 
        'SELECT COUNT(*) as count FROM whatsapp_sessions WHERE status = "active"'
      );

      const metrics = {
        activeConversations: conversationsCount.count,
        todayMessages: messagesCount.count,
        activeAgents: agentsCount.count,
        activeWhatsAppSessions: whatsappSessionsCount.count,
        timestamp: new Date().toISOString()
      };

      socket.emit('real_time_metrics', metrics);

    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
      socket.emit('metrics_error', { error: 'Erro ao carregar métricas' });
    }
  }

  // Handler para desconexão
  handleDisconnect(socket) {
    const userId = this.userSockets.get(socket.id);
    
    if (userId) {
      this.connectedUsers.delete(userId);
      this.userSockets.delete(socket.id);
      console.log(`🔌 Usuário ${userId} desconectado (socket: ${socket.id})`);
    } else {
      console.log(`🔌 Cliente desconectado: ${socket.id}`);
    }
  }

  // Métodos públicos para emitir eventos de outros controladores

  // Emitir nova mensagem WhatsApp
  emitWhatsAppMessage(userId, message) {
    this.io.to(`user_${userId}`).emit('whatsapp_message_received', message);
  }

  // Emitir notificação
  emitNotification(userId, notification) {
    this.io.to(`user_${userId}`).emit('notification', notification);
  }

  // Emitir atualização de agente
  emitAgentUpdate(userId, agentData) {
    this.io.to(`user_${userId}`).emit('agent_updated', agentData);
  }

  // Emitir nova conversa
  emitNewConversation(userId, conversation) {
    this.io.to(`user_${userId}`).emit('new_conversation', conversation);
  }

  // Emitir métricas atualizadas
  emitMetricsUpdate(userId, metrics) {
    this.io.to(`user_${userId}`).emit('metrics_updated', metrics);
  }

  // Broadcast para todos os usuários conectados
  broadcastSystemNotification(notification) {
    this.io.emit('system_notification', notification);
  }
}

export default SocketHandlers;