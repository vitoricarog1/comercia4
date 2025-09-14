import { executeUserQuery } from '../config/database.js';

class Agent {
  static async create(userId, agentData) {
    const {
      name,
      description,
      objective,
      personality = 'professional',
      ai_provider,
      model,
      system_prompt,
      temperature = 0.7,
      max_tokens = 1000
    } = agentData;
    
    const query = `
      INSERT INTO agents (name, description, objective, personality, 
                         ai_provider, model, system_prompt, temperature, max_tokens)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [name, description, objective, personality, 
                   ai_provider, model, system_prompt, temperature, max_tokens];
    
    const result = await executeUserQuery(userId, query, values);
    return { id: result.insertId, ...agentData };
  }

  static async findById(userId, id) {
    const query = `
      SELECT a.*,
             COUNT(c.id) as total_conversations,
             AVG(c.satisfaction_rating) as avg_satisfaction,
             COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_conversations
      FROM agents a
      LEFT JOIN conversations c ON a.id = c.agent_id
      WHERE a.id = ?
      GROUP BY a.id
    `;
    
    const result = await executeUserQuery(userId, query, [id]);
    return result[0];
  }

  static async findByUserId(userId, limit = 50, offset = 0) {
    const query = `
      SELECT a.*, 
             COUNT(c.id) as total_conversations,
             COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_conversations,
             AVG(CASE WHEN m.response_time IS NOT NULL THEN m.response_time END) as avg_response_time,
             AVG(c.satisfaction_rating) as avg_satisfaction
      FROM agents a
      LEFT JOIN conversations c ON a.id = c.agent_id
      LEFT JOIN messages m ON c.id = m.conversation_id AND m.sender = 'agent'
      GROUP BY a.id
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const result = await executeUserQuery(userId, query, [limit, offset]);
    return result;
  }

  static async update(userId, id, agentData) {
    const fields = [];
    const values = [];

    Object.keys(agentData).forEach(key => {
      if (agentData[key] !== undefined && key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(agentData[key]);
      }
    });

    if (fields.length === 0) return null;

    values.push(id);

    const query = `
      UPDATE agents 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;

    await executeUserQuery(userId, query, values);
    return await this.findById(userId, id);
  }

  static async delete(userId, id) {
    const query = 'DELETE FROM agents WHERE id = ?';
    const result = await executeUserQuery(userId, query, [id]);
    return result.affectedRows > 0;
  }

  static async getStats(userId) {
    const queries = await Promise.all([
      executeUserQuery(userId, 'SELECT COUNT(*) as total FROM agents'),
      executeUserQuery(userId, 'SELECT COUNT(*) as active FROM agents WHERE is_active = true'),
      executeUserQuery(userId, 'SELECT ai_provider, COUNT(*) as count FROM agents GROUP BY ai_provider'),
      executeUserQuery(userId, `
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM agents 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
      `),
      executeUserQuery(userId, `
        SELECT personality, COUNT(*) as count 
        FROM agents 
        GROUP BY personality
      `)
    ]);

    return {
      total: parseInt(queries[0][0]?.total || 0),
      active: parseInt(queries[1][0]?.active || 0),
      providerDistribution: queries[2],
      dailyCreated: queries[3],
      personalityDistribution: queries[4]
    };
  }
}

export default Agent;