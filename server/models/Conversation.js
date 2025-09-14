import { executeUserQuery } from '../config/database.js';

class Conversation {
  static async create(userId, conversationData) {
    const {
      agent_id,
      customer_name,
      customer_email,
      customer_phone,
      channel_type,
      status = 'active',
      priority = 1
    } = conversationData;
    
    const query = `
      INSERT INTO conversations (
        agent_id, customer_name, customer_email, 
        customer_phone, channel_type, status, priority
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      agent_id, customer_name, customer_email,
      customer_phone, channel_type, status, priority
    ];
    
    const result = await executeUserQuery(userId, query, values);
    return { id: result.insertId, ...conversationData };
  }

  static async findById(userId, id) {
    const query = `
      SELECT c.*, a.name as agent_name,
             COUNT(m.id) as message_count,
             MAX(m.timestamp) as last_message_time
      FROM conversations c
      LEFT JOIN agents a ON c.agent_id = a.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.id = ?
      GROUP BY c.id, a.name
    `;
    
    const result = await executeUserQuery(userId, query, [id]);
    return result[0];
  }

  static async findByAgentId(userId, agentId, limit = 50, offset = 0, filters = {}) {
    let query = `
      SELECT c.*, a.name as agent_name,
             COUNT(m.id) as message_count,
             MAX(m.timestamp) as last_message_time
      FROM conversations c
      LEFT JOIN agents a ON c.agent_id = a.id
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.agent_id = ?
    `;
    
    const values = [agentId];

    if (filters.status) {
      query += ` AND c.status = ?`;
      values.push(filters.status);
    }

    if (filters.channel_type) {
      query += ` AND c.channel_type = ?`;
      values.push(filters.channel_type);
    }

    query += `
      GROUP BY c.id, a.name
      ORDER BY c.start_time DESC
      LIMIT ? OFFSET ?
    `;
    
    values.push(limit, offset);
    
    const result = await executeUserQuery(userId, query, values);
    return result;
  }

  static async findAll(userId, limit = 50, offset = 0, filters = {}) {
    let query = `
      SELECT c.*, a.name as agent_name,
             COUNT(m.id) as message_count,
             MAX(m.timestamp) as last_message_time
      FROM conversations c
      LEFT JOIN agents a ON c.agent_id = a.id
      LEFT JOIN messages m ON c.id = m.conversation_id
    `;
    
    const conditions = [];
    const values = [];

    if (filters.status) {
      conditions.push(`c.status = ?`);
      values.push(filters.status);
    }

    if (filters.channel_type) {
      conditions.push(`c.channel_type = ?`);
      values.push(filters.channel_type);
    }

    if (filters.agent_id) {
      conditions.push(`c.agent_id = ?`);
      values.push(filters.agent_id);
    }

    if (filters.search) {
      conditions.push(`(c.customer_name LIKE ? OR c.customer_email LIKE ? OR c.customer_phone LIKE ?)`);
      values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      GROUP BY c.id, a.name
      ORDER BY c.start_time DESC
      LIMIT ? OFFSET ?
    `;
    
    values.push(limit, offset);
    
    const result = await executeUserQuery(userId, query, values);
    return result;
  }

  static async update(userId, id, conversationData) {
    const fields = [];
    const values = [];

    Object.keys(conversationData).forEach(key => {
      if (conversationData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(conversationData[key]);
      }
    });

    if (fields.length === 0) return null;

    values.push(id);

    const query = `
      UPDATE conversations 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;

    await executeUserQuery(userId, query, values);
    return await this.findById(userId, id);
  }

  static async delete(userId, id) {
    const query = 'DELETE FROM conversations WHERE id = ?';
    const result = await executeUserQuery(userId, query, [id]);
    return result.affectedRows > 0;
  }

  static async getStats(userId) {
    const queries = await Promise.all([
      executeUserQuery(userId, 'SELECT COUNT(*) as total FROM conversations'),
      executeUserQuery(userId, 'SELECT COUNT(*) as active FROM conversations WHERE status = \'active\''),
      executeUserQuery(userId, 'SELECT AVG(satisfaction_rating) as avg FROM conversations WHERE satisfaction_rating IS NOT NULL'),
      executeUserQuery(userId, 'SELECT status, COUNT(*) as count FROM conversations GROUP BY status'),
      executeUserQuery(userId, 'SELECT channel_type, COUNT(*) as count FROM conversations GROUP BY channel_type'),
      executeUserQuery(userId, `
        SELECT DATE(start_time) as date, COUNT(*) as count 
        FROM conversations 
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(start_time)
        ORDER BY date
      `)
    ]);

    return {
      total: parseInt(queries[0][0]?.total || 0),
      active: parseInt(queries[1][0]?.active || 0),
      avgSatisfaction: parseFloat(queries[2][0]?.avg || 0),
      statusDistribution: queries[3],
      channelDistribution: queries[4],
      dailyConversations: queries[5]
    };
  }

  static async findByPhoneNumber(userId, phoneNumber) {
    const query = `
      SELECT c.*, a.name as agent_name
      FROM conversations c
      LEFT JOIN agents a ON c.agent_id = a.id
      WHERE c.customer_phone = ?
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    
    const result = await executeUserQuery(userId, query, [phoneNumber]);
    return result[0];
  }
}

export default Conversation;