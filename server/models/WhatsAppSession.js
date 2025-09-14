const db = require('../config/database');

class WhatsAppSession {
  constructor(data = {}) {
    this.id = data.id;
    this.phoneNumber = data.phone_number;
    this.contactName = data.contact_name;
    this.agentId = data.agent_id;
    this.status = data.status || 'active';
    this.lastActivity = data.last_activity;
    this.metadata = data.metadata ? JSON.parse(data.metadata) : {};
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  // Criar nova sessão
  static async create(sessionData) {
    try {
      const [result] = await db.execute(
        `INSERT INTO whatsapp_sessions (phone_number, contact_name, agent_id, status, metadata, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          sessionData.phoneNumber,
          sessionData.contactName,
          sessionData.agentId || null,
          sessionData.status || 'active',
          JSON.stringify(sessionData.metadata || {})
        ]
      );

      return await this.findById(result.insertId);
    } catch (error) {
      console.error('Erro ao criar sessão WhatsApp:', error);
      throw error;
    }
  }

  // Buscar sessão por ID
  static async findById(id) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM whatsapp_sessions WHERE id = ?',
        [id]
      );

      return rows.length > 0 ? new WhatsAppSession(rows[0]) : null;
    } catch (error) {
      console.error('Erro ao buscar sessão por ID:', error);
      throw error;
    }
  }

  // Buscar sessão por número de telefone
  static async findByPhoneNumber(phoneNumber) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM whatsapp_sessions WHERE phone_number = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
        [phoneNumber]
      );

      return rows.length > 0 ? new WhatsAppSession(rows[0]) : null;
    } catch (error) {
      console.error('Erro ao buscar sessão por telefone:', error);
      throw error;
    }
  }

  // Buscar sessões por agente
  static async findByAgent(agentId) {
    try {
      const [rows] = await db.execute(
        'SELECT * FROM whatsapp_sessions WHERE agent_id = ? AND status = "active" ORDER BY last_activity DESC',
        [agentId]
      );

      return rows.map(row => new WhatsAppSession(row));
    } catch (error) {
      console.error('Erro ao buscar sessões por agente:', error);
      throw error;
    }
  }

  // Buscar todas as sessões ativas
  static async findActive() {
    try {
      const [rows] = await db.execute(
        `SELECT ws.*, a.name as agent_name, a.email as agent_email
         FROM whatsapp_sessions ws
         LEFT JOIN agents a ON ws.agent_id = a.id
         WHERE ws.status = 'active'
         ORDER BY ws.last_activity DESC`
      );

      return rows.map(row => {
        const session = new WhatsAppSession(row);
        session.agentName = row.agent_name;
        session.agentEmail = row.agent_email;
        return session;
      });
    } catch (error) {
      console.error('Erro ao buscar sessões ativas:', error);
      throw error;
    }
  }

  // Atualizar sessão
  async update(updateData) {
    try {
      const fields = [];
      const values = [];

      if (updateData.contactName !== undefined) {
        fields.push('contact_name = ?');
        values.push(updateData.contactName);
        this.contactName = updateData.contactName;
      }

      if (updateData.agentId !== undefined) {
        fields.push('agent_id = ?');
        values.push(updateData.agentId);
        this.agentId = updateData.agentId;
      }

      if (updateData.status !== undefined) {
        fields.push('status = ?');
        values.push(updateData.status);
        this.status = updateData.status;
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
          `UPDATE whatsapp_sessions SET ${fields.join(', ')} WHERE id = ?`,
          values
        );
      }

      return this;
    } catch (error) {
      console.error('Erro ao atualizar sessão:', error);
      throw error;
    }
  }

  // Atualizar última atividade
  async updateLastActivity() {
    try {
      await db.execute(
        'UPDATE whatsapp_sessions SET last_activity = NOW(), updated_at = NOW() WHERE id = ?',
        [this.id]
      );

      this.lastActivity = new Date();
      return this;
    } catch (error) {
      console.error('Erro ao atualizar última atividade:', error);
      throw error;
    }
  }

  // Atribuir agente à sessão
  async assignAgent(agentId) {
    try {
      await this.update({ agentId });
      
      // Registrar no log de auditoria
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
         VALUES (?, 'assign_agent', 'whatsapp_session', ?, ?, NOW())`,
        [
          agentId,
          this.id,
          JSON.stringify({
            phone_number: this.phoneNumber,
            contact_name: this.contactName,
            previous_agent: this.agentId
          })
        ]
      );

      return this;
    } catch (error) {
      console.error('Erro ao atribuir agente:', error);
      throw error;
    }
  }

  // Encerrar sessão
  async close(reason = 'completed') {
    try {
      await this.update({ status: 'closed' });
      
      // Adicionar razão do encerramento aos metadados
      const metadata = { ...this.metadata, closeReason: reason, closedAt: new Date() };
      await this.update({ metadata });

      return this;
    } catch (error) {
      console.error('Erro ao encerrar sessão:', error);
      throw error;
    }
  }

  // Obter estatísticas da sessão
  async getStats() {
    try {
      const [stats] = await db.execute(
        `SELECT 
          COUNT(*) as total_messages,
          COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound_messages,
          COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound_messages,
          MIN(created_at) as first_message,
          MAX(created_at) as last_message,
          AVG(CASE WHEN direction = 'outbound' AND created_at > (
            SELECT created_at FROM messages m2 
            WHERE m2.conversation_id = messages.conversation_id 
            AND m2.direction = 'inbound' 
            AND m2.created_at < messages.created_at 
            ORDER BY m2.created_at DESC LIMIT 1
          ) THEN TIMESTAMPDIFF(SECOND, (
            SELECT created_at FROM messages m2 
            WHERE m2.conversation_id = messages.conversation_id 
            AND m2.direction = 'inbound' 
            AND m2.created_at < messages.created_at 
            ORDER BY m2.created_at DESC LIMIT 1
          ), messages.created_at) END) as avg_response_time
        FROM messages 
        JOIN conversations ON messages.conversation_id = conversations.id
        WHERE conversations.phone_number = ?`,
        [this.phoneNumber]
      );

      return stats[0];
    } catch (error) {
      console.error('Erro ao obter estatísticas da sessão:', error);
      throw error;
    }
  }

  // Buscar sessões que precisam de atenção (sem atividade recente)
  static async findStale(minutesThreshold = 30) {
    try {
      const [rows] = await db.execute(
        `SELECT * FROM whatsapp_sessions 
         WHERE status = 'active' 
         AND last_activity < DATE_SUB(NOW(), INTERVAL ? MINUTE)
         ORDER BY last_activity ASC`,
        [minutesThreshold]
      );

      return rows.map(row => new WhatsAppSession(row));
    } catch (error) {
      console.error('Erro ao buscar sessões inativas:', error);
      throw error;
    }
  }

  // Transferir sessão para outro agente
  async transfer(newAgentId, reason = '') {
    try {
      const previousAgentId = this.agentId;
      
      await this.update({ agentId: newAgentId });
      
      // Registrar transferência no log
      await db.execute(
        `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, created_at)
         VALUES (?, 'transfer_session', 'whatsapp_session', ?, ?, NOW())`,
        [
          newAgentId,
          this.id,
          JSON.stringify({
            phone_number: this.phoneNumber,
            contact_name: this.contactName,
            previous_agent: previousAgentId,
            new_agent: newAgentId,
            reason: reason
          })
        ]
      );

      return this;
    } catch (error) {
      console.error('Erro ao transferir sessão:', error);
      throw error;
    }
  }

  // Converter para JSON
  toJSON() {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      contactName: this.contactName,
      agentId: this.agentId,
      status: this.status,
      lastActivity: this.lastActivity,
      metadata: this.metadata,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      agentName: this.agentName,
      agentEmail: this.agentEmail
    };
  }
}

module.exports = WhatsAppSession;