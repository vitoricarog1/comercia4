import { executeMainQuery, createUserDatabase } from '../config/database.js';
import bcrypt from 'bcryptjs';

class User {
  static async create(userData) {
    const { 
      name, 
      email, 
      password, 
      role = 'user', 
      plan = 'free',
      company,
      phone 
    } = userData;
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    const query = `
      INSERT INTO users (name, email, password, role, plan, company, phone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [name, email, hashedPassword, role, plan, company, phone];
    const result = await executeMainQuery(query, values);
    
    // Criar banco de dados para o usuário (se não for admin)
    if (role !== 'admin') {
      try {
        await createUserDatabase(result.insertId);
        
        // Registrar o banco criado
        await executeMainQuery(
          'INSERT INTO user_databases (user_id, database_name) VALUES (?, ?)',
          [result.insertId, `ai_agents_user_${result.insertId}`]
        );
      } catch (error) {
        console.error('Erro ao criar banco do usuário:', error);
        // Reverter criação do usuário se falhar
        await executeMainQuery('DELETE FROM users WHERE id = ?', [result.insertId]);
        throw new Error('Erro ao criar banco de dados do usuário');
      }
    }
    
    // Retornar usuário criado
    const user = await this.findById(result.insertId);
    return user;
  }

  static async findById(id) {
    const query = `
      SELECT id, name, email, role, plan, company, phone, avatar, is_active, 
             email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE id = ?
    `;
    
    const result = await executeMainQuery(query, [id]);
    return result[0];
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, name, email, password, role, plan, company, phone, avatar, 
             is_active, email_verified, last_login, created_at, updated_at
      FROM users 
      WHERE email = ?
    `;
    
    const result = await executeMainQuery(query, [email]);
    return result[0];
  }

  static async findAll(limit = 50, offset = 0, filters = {}) {
    let query = `
      SELECT u.id, u.name, u.email, u.role, u.plan, u.company, u.phone,
             u.is_active, u.email_verified, u.last_login, u.created_at,
             ud.database_name, ud.status as db_status
      FROM users u
      LEFT JOIN user_databases ud ON u.id = ud.user_id
    `;
    
    const conditions = [];
    const values = [];

    if (filters.role) {
      conditions.push(`u.role = ?`);
      values.push(filters.role);
    }

    if (filters.plan) {
      conditions.push(`u.plan = ?`);
      values.push(filters.plan);
    }

    if (filters.is_active !== undefined) {
      conditions.push(`u.is_active = ?`);
      values.push(filters.is_active);
    }

    if (filters.search) {
      conditions.push(`(u.name LIKE ? OR u.email LIKE ? OR u.company LIKE ?)`);
      values.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    values.push(limit, offset);
    
    const result = await executeMainQuery(query, values);
    return result;
  }

  static async update(id, userData) {
    const fields = [];
    const values = [];

    Object.keys(userData).forEach(key => {
      if (userData[key] !== undefined && key !== 'id' && key !== 'password') {
        fields.push(`${key} = ?`);
        values.push(userData[key]);
      }
    });

    if (userData.password) {
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      fields.push(`password = ?`);
      values.push(hashedPassword);
    }

    if (fields.length === 0) return null;

    values.push(id);

    const query = `
      UPDATE users 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;

    await executeMainQuery(query, values);
    
    // Return updated user
    return await this.findById(id);
  }

  static async delete(id) {
    // Verificar se não é admin
    const user = await this.findById(id);
    if (!user) return false;
    
    if (user.role === 'admin') {
      throw new Error('Não é possível excluir usuário administrador');
    }

    // Excluir banco de dados do usuário
    try {
      const dbName = `ai_agents_user_${id}`;
      await executeMainQuery(`DROP DATABASE IF EXISTS \`${dbName}\``);
      console.log(`🗑️ Database ${dbName} excluído`);
    } catch (error) {
      console.error('Erro ao excluir database do usuário:', error);
    }

    // Excluir usuário
    const query = 'DELETE FROM users WHERE id = ?';
    const result = await executeMainQuery(query, [id]);
    return result.affectedRows > 0;
  }

  static async validatePassword(plainPassword, hashedPassword) {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(id) {
    const query = `
      UPDATE users 
      SET last_login = NOW(), updated_at = NOW()
      WHERE id = ?
    `;
    await executeMainQuery(query, [id]);
  }

  static async getStats() {
    const queries = await Promise.all([
      executeMainQuery('SELECT COUNT(*) as total FROM users'),
      executeMainQuery('SELECT COUNT(*) as active FROM users WHERE is_active = true'),
      executeMainQuery('SELECT plan, COUNT(*) as count FROM users GROUP BY plan'),
      executeMainQuery(`
        SELECT DATE(created_at) as date, COUNT(*) as count 
        FROM users 
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(created_at)
        ORDER BY date
      `),
      executeMainQuery(`
        SELECT role, COUNT(*) as count 
        FROM users 
        GROUP BY role
      `)
    ]);

    return {
      total: parseInt(queries[0][0].total),
      active: parseInt(queries[1][0].active),
      planDistribution: queries[2],
      dailySignups: queries[3],
      roleDistribution: queries[4]
    };
  }

  static async getDetailedStats() {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_users,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_30d,
        COUNT(CASE WHEN last_login >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN 1 END) as active_users_7d,
        COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users
      FROM users
    `;
    
    const result = await executeMainQuery(query);
    return result[0];
  }
}

export default User;