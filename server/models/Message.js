const db = require('../config/database');

class Message {
  constructor(data = {}) {
    this.id = data.id;
    this.conversationId = data.conversation_id;
    this.content = data.content;
    this.direction = data.direction; // 'inbound' or 'outbound'
    this.messageType = data.message_type || 'text';
    this.mediaUrl = data.media_url;
    this.whatsappMessageId = data.whatsapp_message_id;
    this.status = data.status || 'sent';
    this.responseTime = data.response_time;
    this.metadata = data.metadata ? JSON.parse(data.metadata) : {};
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Criar nova mensagem
  static async create(messageData) {
    try {
      const [result] = await db.execute(
        `INSERT INTO messages (conversation_id, content, direction, message_type, media_url, whatsapp_message_id, status, metadata, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          messageData.conversation_id,
          messageData.content,
          messageData.direction,
          messageData.message_type || 'text',
          messageData.media_url || null,
          messageData.whatsapp_message_id || null,
          messageData.status || 'sent',
          JSON.stringify(messageData.metadata || {})
        ]
      );

      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Erro ao criar mensagem:', error);
      throw error;
    }
  }

  // Buscar mensagem por ID
  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM messages WHERE id = ?',
        [id]
      );

      return rows.length > 0 ? new Message(rows[0]) : null;
    } catch (error) {
      console.error('Erro ao buscar mensagem por ID:', error);
      throw error;
    }
  }

  // Buscar mensagens por conversa
  static async findByConversationId(conversationId, limit = 50, offset = 0) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM messages 
         WHERE conversation_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [conversationId, limit, offset]
      );

      return rows.map(row => new Message(row));
    } catch (error) {
      console.error('Erro ao buscar mensagens por conversa:', error);
      throw error;
    }
  }

  // Buscar mensagens por WhatsApp Message ID
  static async findByWhatsAppMessageId(whatsappMessageId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM messages WHERE whatsapp_message_id = ?',
        [whatsappMessageId]
      );

      return rows.length > 0 ? new Message(rows[0]) : null;
    } catch (error) {
      console.error('Erro ao buscar mensagem por WhatsApp ID:', error);
      throw error;
    }
  }

  // Atualizar mensagem
  async update(updateData) {
    try {
      const fields = [];
      const values = [];

      if (updateData.content !== undefined) {
        fields.push('content = ?');
        values.push(updateData.content);
        this.content = updateData.content;
      }

      if (updateData.status !== undefined) {
        fields.push('status = ?');
        values.push(updateData.status);
        this.status = updateData.status;
      }

      if (updateData.response_time !== undefined) {
        fields.push('response_time = ?');
        values.push(updateData.response_time);
        this.responseTime = updateData.response_time;
      }

      if (updateData.metadata !== undefined) {
        fields.push('metadata = ?');
        values.push(JSON.stringify(updateData.metadata));
        this.metadata = updateData.metadata;
      }

      if (fields.length > 0) {
        fields.push('updated_at = NOW()');
        values.push(this.id);

        await db.execute(
          `UPDATE messages SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
      }

      return this;
    } catch (error) {
      console.error('Erro ao atualizar mensagem:', error);
      throw error;
    }
  }

  // Marcar como lida
  async markAsRead() {
    try {
      await this.update({ status: 'read' });
      return this;
    } catch (error) {
      console.error('Erro ao marcar mensagem como lida:', error);
      throw error;
    }
  }

  // Marcar como entregue
  async markAsDelivered() {
    try {
      await this.update({ status: 'delivered' });
      return this;
    } catch (error) {
      console.error('Erro ao marcar mensagem como entregue:', error);
      throw error;
    }
  }

  // Calcular tempo de resposta
  static async calculateResponseTime(conversationId, messageId) {
    try {
      const [result] = await db.execute(
        `SELECT 
          m1.created_at as current_message_time,
          m2.created_at as previous_message_time,
          TIMESTAMPDIFF(SECOND, m2.created_at, m1.created_at) as response_time_seconds
        FROM messages m1
        LEFT JOIN messages m2 ON (
          m2.conversation_id = m1.conversation_id 
          AND m2.direction = 'inbound' 
          AND m2.created_at < m1.created_at
          AND m2.id = (
            SELECT MAX(id) FROM messages m3 
            WHERE m3.conversation_id = m1.conversation_id 
            AND m3.direction = 'inbound' 
            AND m3.created_at < m1.created_at
          )
        )
        WHERE m1.id = ? AND m1.direction = 'outbound'`,
        [messageId]
      );

      if (result.length > 0 && result[0].response_time_seconds) {
        const responseTime = result[0].response_time_seconds;
        
        // Atualizar o tempo de resposta na mensagem
        await db.execute(
          'UPDATE messages SET response_time = ? WHERE id = ?',
          [responseTime, messageId]
        );

        return responseTime;
      }

      return null;
    } catch (error) {
      console.error('Erro ao calcular tempo de resposta:', error);
      throw error;
    }
  }

  // Buscar mensagens não lidas
  static async findUnread(conversationId) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM messages 
         WHERE conversation_id = ? 
         AND direction = 'inbound' 
         AND status != 'read' 
         ORDER BY created_at ASC`,
        [conversationId]
      );

      return rows.map(row => new Message(row));
    } catch (error) {
      console.error('Erro ao buscar mensagens não lidas:', error);
      throw error;
    }
  }

  // Buscar mensagens por período
  static async findByDateRange(conversationId, startDate, endDate) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM messages 
         WHERE conversation_id = ? 
         AND created_at BETWEEN ? AND ? 
         ORDER BY created_at ASC`,
        [conversationId, startDate, endDate]
      );

      return rows.map(row => new Message(row));
    } catch (error) {
      console.error('Erro ao buscar mensagens por período:', error);
      throw error;
    }
  }

  // Buscar mensagens por tipo
  static async findByType(conversationId, messageType) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM messages 
         WHERE conversation_id = ? 
         AND message_type = ? 
         ORDER BY created_at DESC`,
        [conversationId, messageType]
      );

      return rows.map(row => new Message(row));
    } catch (error) {
      console.error('Erro ao buscar mensagens por tipo:', error);
      throw error;
    }
  }

  // Obter estatísticas de mensagens
  static async getStats(conversationId) {
    try {
      const [stats] = await db.execute(
        `SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_messages,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages,
          COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_messages,
          COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_messages,
          COUNT(CASE WHEN message_type = 'document' THEN 1 END) as document_messages,
          COUNT(CASE WHEN message_type = 'audio' THEN 1 END) as audio_messages,
          AVG(CASE WHEN response_time IS NOT NULL THEN response_time END) as avg_response_time,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message
        FROM messages 
        WHERE conversation_id = ?`,
        [conversationId]
      );

      return stats[0];
    } catch (error) {
      console.error('Erro ao obter estatísticas de mensagens:', error);
      throw error;
    }
  }

  // Buscar mensagens recentes do sistema
  static async findRecent(limit = 100) {
    try {
      const [rows] = await db.execute(
        `SELECT m.*, c.phone_number, c.channel, a.name as agent_name
         FROM messages m
         JOIN conversations c ON m.conversation_id = c.id
         LEFT JOIN agents a ON c.agent_id = a.id
         ORDER BY m.created_at DESC
         LIMIT ?`,
        [limit]
      );

      return rows.map(row => {
        const message = new Message(row);
        message.phoneNumber = row.phone_number;
        message.channel = row.channel;
        message.agentName = row.agent_name;
        return message;
      });
    } catch (error) {
      console.error('Erro ao buscar mensagens recentes:', error);
      throw error;
    }
  }

  // Deletar mensagem
  async delete() {
    try {
      await db.execute('DELETE FROM messages WHERE id = ?', [this.id]);
      return true;
    } catch (error) {
      console.error('Erro ao deletar mensagem:', error);
      throw error;
    }
  }

  // Converter para JSON
  toJSON() {
    return {
      id: this.id,
      conversationId: this.conversationId,
      content: this.content,
      direction: this.direction,
      messageType: this.messageType,
      mediaUrl: this.mediaUrl,
      whatsappMessageId: this.whatsappMessageId,
      status: this.status,
      responseTime: this.responseTime,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      phoneNumber: this.phoneNumber,
      channel: this.channel,
      agentName: this.agentName
    };
  }
}

module.exports = Message;