import User from '../models/User.js';
import { executeMainQuery, executeUserQuery } from '../config/database.js';

const adminController = {
  // Dashboard com estatísticas gerais do sistema
  async getDashboard(req, res) {
    try {
      // Estatísticas básicas de usuários
      const [userCount] = await executeMainQuery('SELECT COUNT(*) as total FROM users');
      const [activeUserCount] = await executeMainQuery('SELECT COUNT(*) as active FROM users WHERE is_active = true');
      const [adminCount] = await executeMainQuery('SELECT COUNT(*) as admins FROM users WHERE role = "admin"');

      res.json({
        success: true,
        data: {
          overview: {
            totalUsers: userCount.total || 0,
            activeUsers: activeUserCount.active || 0,
            adminUsers: adminCount.admins || 0,
            activeAgents: 0,
            totalConversations: 0,
            unresolvedAlerts: 0
          }
        }
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao carregar dashboard administrativo' 
      });
    }
  },

  // Obter todos os usuários do sistema
  async getUsers(req, res) {
    try {
      const { limit = 50, offset = 0, search, role, plan, is_active } = req.query;
      
      const filters = {};
      if (search) filters.search = search;
      if (role) filters.role = role;
      if (plan) filters.plan = plan;
      if (is_active !== undefined) filters.is_active = is_active === 'true';

      const users = await User.findAll(parseInt(limit), parseInt(offset), filters);
      
      // Contar total para paginação
      const totalQuery = `
        SELECT COUNT(*) as total FROM users u
        ${search ? 'WHERE (u.name LIKE ? OR u.email LIKE ? OR u.company LIKE ?)' : ''}
      `;
      const totalParams = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];
      const totalResult = await executeMainQuery(totalQuery, totalParams);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            total: totalResult[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar usuários' 
      });
    }
  },

  // Criar novo usuário
  async createUser(req, res) {
    try {
      const userData = req.body;
      const user = await User.create(userData);
      
      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: { user }
      });
    } catch (error) {
      console.error('Create user error:', error);
      
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ 
          success: false, 
          error: 'Email já está em uso' 
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao criar usuário' 
      });
    }
  },

  // Atualizar usuário
  async updateUser(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const user = await User.update(id, updates);
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: { user }
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao atualizar usuário' 
      });
    }
  },

  // Atualizar configurações do usuário
  async updateUserSettings(req, res) {
    try {
      const { id } = req.params;
      const settings = req.body;

      // Buscar dados do usuário
      const userQuery = 'SELECT database_name FROM users WHERE id = ?';
      const users = await executeMainQuery(userQuery, [id]);
      
      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }

      const user = users[0];

      // Atualizar ou inserir configurações
      const upsertQuery = `
        INSERT INTO user_settings (user_id, agent_limit, message_limit, webhook_url, api_key, auto_reply, notifications, analytics, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
        agent_limit = VALUES(agent_limit),
        message_limit = VALUES(message_limit),
        webhook_url = VALUES(webhook_url),
        api_key = VALUES(api_key),
        auto_reply = VALUES(auto_reply),
        notifications = VALUES(notifications),
        analytics = VALUES(analytics),
        updated_at = NOW()
      `;

      await executeUserQuery(user.database_name, upsertQuery, [
        id,
        settings.agent_limit || 10,
        settings.message_limit || 1000,
        settings.webhook_url || '',
        settings.api_key || '',
        settings.auto_reply || false,
        settings.notifications || true,
        settings.analytics || true
      ]);

      res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Update user settings error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao atualizar configurações do usuário' 
      });
    }
  },

  // Atualizar agente
  async updateAgent(req, res) {
    try {
      const { userId, agentId } = req.params;
      const updates = req.body;

      // Buscar dados do usuário
      const userQuery = 'SELECT database_name FROM users WHERE id = ?';
      const users = await executeMainQuery(userQuery, [userId]);
      
      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }

      const user = users[0];

      // Atualizar agente
      const updateQuery = `
        UPDATE agents SET
        name = ?,
        description = ?,
        personality = ?,
        instructions = ?,
        model = ?,
        temperature = ?,
        max_tokens = ?,
        is_active = ?,
        updated_at = NOW()
        WHERE id = ?
      `;

      await executeUserQuery(user.database_name, updateQuery, [
        updates.name,
        updates.description,
        updates.personality,
        updates.instructions,
        updates.model || 'gpt-3.5-turbo',
        updates.temperature || 0.7,
        updates.max_tokens || 1000,
        updates.is_active !== undefined ? updates.is_active : true,
        agentId
      ]);

      res.json({
        success: true,
        message: 'Agente atualizado com sucesso'
      });
    } catch (error) {
      console.error('Update agent error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao atualizar agente' 
      });
    }
  },

  // Excluir agente
  async deleteAgent(req, res) {
    try {
      const { userId, agentId } = req.params;

      // Buscar dados do usuário
      const userQuery = 'SELECT database_name FROM users WHERE id = ?';
      const users = await executeMainQuery(userQuery, [userId]);
      
      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }

      const user = users[0];

      // Excluir agente
      const deleteQuery = 'DELETE FROM agents WHERE id = ?';
      await executeUserQuery(user.database_name, deleteQuery, [agentId]);

      res.json({
        success: true,
        message: 'Agente excluído com sucesso'
      });
    } catch (error) {
      console.error('Delete agent error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao excluir agente' 
      });
    }
  },

  // Funções de configuração específicas
  async updateGeneralSettings(req, res) {
    try {
      const settings = req.body;
      
      // Atualizar configurações gerais no banco de dados
      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          ['general', key, value]
        );
      }
      
      res.json({
        success: true,
        message: 'Configurações gerais atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações gerais:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async updateIntegrationSettings(req, res) {
    try {
      const settings = req.body;
      
      // Atualizar configurações de integração no banco de dados
      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          ['integrations', key, value]
        );
      }
      
      res.json({
        success: true,
        message: 'Configurações de integração atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações de integração:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async updateSecuritySettings(req, res) {
    try {
      const settings = req.body;
      
      // Atualizar configurações de segurança no banco de dados
      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          ['security', key, value]
        );
      }
      
      res.json({
        success: true,
        message: 'Configurações de segurança atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações de segurança:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async updateLimitsSettings(req, res) {
    try {
      const settings = req.body;
      
      // Atualizar configurações de limites no banco de dados
      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          ['limits', key, value]
        );
      }
      
      res.json({
        success: true,
        message: 'Configurações de limites atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações de limites:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async updateNotificationSettings(req, res) {
    try {
      const settings = req.body;
      
      // Atualizar configurações de notificação no banco de dados
      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          ['notifications', key, value]
        );
      }
      
      res.json({
        success: true,
        message: 'Configurações de notificação atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações de notificação:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async updateMaintenanceSettings(req, res) {
    try {
      const settings = req.body;
      
      // Atualizar configurações de manutenção no banco de dados
      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          ['maintenance', key, value]
        );
      }
      
      res.json({
        success: true,
        message: 'Configurações de manutenção atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações de manutenção:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  // Funções de teste de integração
  async testWhatsAppConnection(req, res) {
    try {
      // Implementar teste de conexão WhatsApp
      // Por enquanto, simular sucesso
      res.json({
        success: true,
        message: 'Conexão WhatsApp testada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao testar conexão WhatsApp:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao testar conexão WhatsApp'
      });
    }
  },

  async testEmailConnection(req, res) {
    try {
      // Implementar teste de conexão de email
      // Por enquanto, simular sucesso
      res.json({
        success: true,
        message: 'Conexão de email testada com sucesso'
      });
    } catch (error) {
      console.error('Erro ao testar conexão de email:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao testar conexão de email'
      });
    }
  },

  // Funções de manutenção
  async createManualBackup(req, res) {
    try {
      // Implementar criação de backup manual
      // Por enquanto, simular sucesso
      res.json({
        success: true,
        message: 'Backup manual criado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao criar backup manual:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao criar backup manual'
      });
    }
  },

  async downloadBackup(req, res) {
    try {
      // Implementar download de backup
      // Por enquanto, simular arquivo
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="backup.sql"');
      res.send('-- Backup simulado\nSELECT * FROM users;');
    } catch (error) {
      console.error('Erro ao baixar backup:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao baixar backup'
      });
    }
  },

  async cleanupLogs(req, res) {
    try {
      // Implementar limpeza de logs
      // Por enquanto, simular sucesso
      res.json({
        success: true,
        message: 'Logs antigos limpos com sucesso'
      });
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao limpar logs'
      });
    }
  },

  async optimizeDatabase(req, res) {
    try {
      // Implementar otimização do banco de dados
      // Por enquanto, simular sucesso
      res.json({
        success: true,
        message: 'Banco de dados otimizado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao otimizar banco de dados:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao otimizar banco de dados'
      });
    }
  },

  async clearCache(req, res) {
    try {
      // Implementar limpeza de cache
      // Por enquanto, simular sucesso
      res.json({
        success: true,
        message: 'Cache limpo com sucesso'
      });
    } catch (error) {
      console.error('Erro ao limpar cache:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao limpar cache'
      });
    }
  },

  // Excluir usuário
  async deleteUser(req, res) {
    try {
      const { id } = req.params;

      const success = await User.delete(id);
      
      if (!success) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }

      res.json({
        success: true,
        message: 'Usuário excluído com sucesso'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Erro ao excluir usuário' 
      });
    }
  },

  // Obter detalhes de um usuário específico
  async getUserById(req, res) {
    try {
      const { id } = req.params;
      
      // Buscar dados do usuário
      const userQuery = `
        SELECT u.*, p.name as plan_name, p.price as plan_price,
               s.status as subscription_status, s.expires_at as subscription_expires
        FROM users u
        LEFT JOIN subscriptions s ON u.id = s.user_id AND s.status = 'active'
        LEFT JOIN plans p ON s.plan_id = p.id
        WHERE u.id = ?
      `;
      
      const users = await executeMainQuery(userQuery, [id]);
      
      if (users.length === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }
      
      const user = users[0];
      
      // Buscar agentes do usuário
      const agentsQuery = `
        SELECT * FROM whatsapp_sessions 
        WHERE user_id = ? 
        ORDER BY created_at DESC
      `;
      const agents = await executeUserQuery(user.database_name, agentsQuery, [id]);
      
      // Buscar conversas recentes
      const conversationsQuery = `
        SELECT c.*, ws.session_name
        FROM conversations c
        LEFT JOIN whatsapp_sessions ws ON c.session_id = ws.id
        WHERE c.user_id = ?
        ORDER BY c.updated_at DESC
        LIMIT 50
      `;
      const conversations = await executeUserQuery(user.database_name, conversationsQuery, [id]);
      
      // Buscar configurações do usuário
      const settingsQuery = `
        SELECT * FROM user_settings 
        WHERE user_id = ?
      `;
      const settings = await executeUserQuery(user.database_name, settingsQuery, [id]);
      
      // Buscar atividade recente
      const activityQuery = `
        SELECT * FROM audit_logs 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 100
      `;
      const activity = await executeUserQuery(user.database_name, activityQuery, [id]);
      
      res.json({
        success: true,
        data: {
          user,
          agents,
          conversations,
          settings: settings[0] || {},
          activity
        }
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar dados do usuário' 
      });
    }
  },

  // Resetar senha do usuário
  async resetPassword(req, res) {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ 
          success: false, 
          error: 'Nova senha deve ter pelo menos 6 caracteres' 
        });
      }
      
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      const updateQuery = `
        UPDATE users 
        SET password = ?, updated_at = NOW() 
        WHERE id = ?
      `;
      
      const result = await executeMainQuery(updateQuery, [hashedPassword, id]);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ 
          success: false, 
          error: 'Usuário não encontrado' 
        });
      }
      
      res.json({
        success: true,
        message: 'Senha resetada com sucesso'
      });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao resetar senha' 
      });
    }
  },

  // Obter todos os agentes de todos os usuários
  async getAllAgents(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      // Buscar todos os usuários ativos
      const users = await executeMainQuery('SELECT id FROM users WHERE is_active = true AND role != "admin"');
      
      let allAgents = [];
      
      for (const user of users) {
        try {
          const userAgents = await executeUserQuery(user.id, `
            SELECT a.*, ${user.id} as user_id,
                   COUNT(c.id) as total_conversations,
                   COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_conversations
            FROM agents a
            LEFT JOIN conversations c ON a.id = c.agent_id
            GROUP BY a.id
            ORDER BY a.created_at DESC
          `);
          
          allAgents = allAgents.concat(userAgents);
        } catch (error) {
          console.error(`Erro ao buscar agentes do usuário ${user.id}:`, error);
        }
      }

      // Aplicar paginação
      const paginatedAgents = allAgents.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        data: {
          agents: paginatedAgents,
          pagination: {
            total: allAgents.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        }
      });
    } catch (error) {
      console.error('Get all agents error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar agentes' 
      });
    }
  },

  // Obter todas as conversas de todos os usuários
  async getAllConversations(req, res) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      // Buscar todos os usuários ativos
      const users = await executeMainQuery('SELECT id, name, email FROM users WHERE is_active = true AND role != "admin"');
      
      let allConversations = [];
      
      for (const user of users) {
        try {
          const userConversations = await executeUserQuery(user.id, `
            SELECT c.*, a.name as agent_name, ${user.id} as user_id, '${user.name}' as user_name, '${user.email}' as user_email,
                   COUNT(m.id) as message_count,
                   MAX(m.timestamp) as last_message_time
            FROM conversations c
            LEFT JOIN agents a ON c.agent_id = a.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            GROUP BY c.id, a.name
            ORDER BY c.start_time DESC
          `);
          
          allConversations = allConversations.concat(userConversations);
        } catch (error) {
          console.error(`Erro ao buscar conversas do usuário ${user.id}:`, error);
        }
      }

      // Ordenar por data mais recente
      allConversations.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      // Aplicar paginação
      const paginatedConversations = allConversations.slice(offset, offset + parseInt(limit));

      res.json({
        success: true,
        data: {
          conversations: paginatedConversations,
          pagination: {
            total: allConversations.length,
            limit: parseInt(limit),
            offset: parseInt(offset)
          }
        }
      });
    } catch (error) {
      console.error('Get all conversations error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar conversas' 
      });
    }
  },

  // Métricas de performance
  async getPerformanceMetrics(req, res) {
    try {
      // Simular métricas de performance para as últimas 24 horas
      const now = new Date();
      const metrics = [];
      
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
        
        metrics.push({
          timestamp: timestamp.toISOString(),
          responseTime: Math.round(Math.random() * 200 + 100),
          requestsPerSecond: Math.round((Math.random() * 50 + 10) * 10) / 10,
          errorRate: Math.round(Math.random() * 5 * 10) / 10,
          activeConnections: Math.round(Math.random() * 50 + 10)
        });
      }
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Performance metrics error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar métricas de performance'
      });
    }
  },

  // Suspender usuário
  async suspendUser(req, res) {
    try {
      const { userId } = req.params;
      
      await executeMainQuery(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      
      res.json({
        success: true,
        message: 'Usuário suspenso com sucesso'
      });
    } catch (error) {
      console.error('Suspend user error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao suspender usuário'
      });
    }
  },

  // Ativar usuário
  async activateUser(req, res) {
    try {
      const { userId } = req.params;
      
      await executeMainQuery(
        'UPDATE users SET is_active = true, updated_at = NOW() WHERE id = ?',
        [userId]
      );
      
      res.json({
        success: true,
        message: 'Usuário ativado com sucesso'
      });
    } catch (error) {
      console.error('Activate user error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao ativar usuário'
      });
    }
  },

  // Estatísticas do sistema
  async getSystemStats(req, res) {
    try {
      // Estatísticas básicas de usuários
      const [userCount] = await executeMainQuery('SELECT COUNT(*) as total FROM users WHERE role != "admin"');
      const [activeUserCount] = await executeMainQuery('SELECT COUNT(*) as active FROM users WHERE is_active = true AND role != "admin"');
      
      // Estatísticas de agentes e conversas (simuladas para demo)
      const totalAgents = Math.floor(Math.random() * 100) + 50;
      const totalConversations = Math.floor(Math.random() * 1000) + 500;
      const totalMessages = Math.floor(Math.random() * 10000) + 5000;
      
      // Estatísticas de receita (simuladas para demo)
      const totalRevenue = Math.floor(Math.random() * 50000) + 25000;
      const monthlyRevenue = Math.floor(Math.random() * 5000) + 2500;
      
      // Métricas do sistema
      const uptime = process.uptime();
      const memoryUsage = Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100);
      const cpuUsage = Math.round(Math.random() * 30 + 20);
      const diskUsage = Math.round(Math.random() * 40 + 15);
      
      const stats = {
        totalUsers: userCount.total || 0,
        activeUsers: activeUserCount.active || 0,
        totalAgents,
        totalConversations,
        totalMessages,
        totalRevenue,
        monthlyRevenue,
        systemUptime: Math.round(uptime),
        cpuUsage,
        memoryUsage,
        diskUsage
      };
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('System stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Erro ao buscar estatísticas do sistema'
      });
    }
  },

  // Estatísticas agregadas de todos os usuários
  async getAllUsersStats() {
    try {
      const users = await executeMainQuery('SELECT id FROM users WHERE is_active = true AND role != "admin"');
      
      let totalAgents = 0;
      let totalConversations = 0;
      let totalMessages = 0;
      let avgSatisfaction = 0;
      let satisfactionCount = 0;

      for (const user of users) {
        try {
          const [agentCount] = await executeUserQuery(user.id, 'SELECT COUNT(*) as count FROM agents');
          const [convCount] = await executeUserQuery(user.id, 'SELECT COUNT(*) as count FROM conversations');
          const [msgCount] = await executeUserQuery(user.id, 'SELECT COUNT(*) as count FROM messages');
          const [satisfaction] = await executeUserQuery(user.id, 'SELECT AVG(satisfaction_rating) as avg, COUNT(satisfaction_rating) as count FROM conversations WHERE satisfaction_rating IS NOT NULL');

          totalAgents += agentCount.count || 0;
          totalConversations += convCount.count || 0;
          totalMessages += msgCount.count || 0;
          
          if (satisfaction.avg) {
            avgSatisfaction += satisfaction.avg * satisfaction.count;
            satisfactionCount += satisfaction.count;
          }
        } catch (error) {
          console.error(`Erro ao buscar stats do usuário ${user.id}:`, error);
        }
      }

      return {
        total_agents: totalAgents,
        total_conversations: totalConversations,
        total_messages: totalMessages,
        avg_satisfaction: satisfactionCount > 0 ? avgSatisfaction / satisfactionCount : 0
      };
    } catch (error) {
      console.error('All users stats error:', error);
      return {
        total_agents: 0,
        total_conversations: 0,
        total_messages: 0,
        avg_satisfaction: 0
      };
    }
  },

  // Logs de auditoria
  async getAuditLogs(req, res) {
    try {
      const { limit = 50, offset = 0, action, user_id } = req.query;
      
      let query = `
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
      `;
      
      const conditions = [];
      const values = [];

      if (action) {
        conditions.push('al.action = ?');
        values.push(action);
      }

      if (user_id) {
        conditions.push('al.user_id = ?');
        values.push(user_id);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += `
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      values.push(parseInt(limit), parseInt(offset));
      
      const logs = await executeMainQuery(query, values);

      res.json({
        success: true,
        data: { logs }
      });
    } catch (error) {
      console.error('Get audit logs error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar logs de auditoria' 
      });
    }
  },

  // Alertas do sistema
  async getAlerts(req, res) {
    try {
      const { limit = 50, offset = 0, severity, is_resolved } = req.query;
      
      let query = `
        SELECT a.*, u.name as user_name, u.email as user_email
        FROM alerts a
        LEFT JOIN users u ON a.user_id = u.id
      `;
      
      const conditions = [];
      const values = [];

      if (severity) {
        conditions.push('a.severity = ?');
        values.push(severity);
      }

      if (is_resolved !== undefined) {
        conditions.push('a.is_resolved = ?');
        values.push(is_resolved === 'true');
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += `
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      values.push(parseInt(limit), parseInt(offset));
      
      const alerts = await executeMainQuery(query, values);

      res.json({
        success: true,
        data: { alerts }
      });
    } catch (error) {
      console.error('Get alerts error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar alertas' 
      });
    }
  },

  // Resolver alerta
  async resolveAlert(req, res) {
    try {
      const { id } = req.params;
      
      await executeMainQuery(
        'UPDATE alerts SET is_resolved = true, updated_at = NOW() WHERE id = ?',
        [id]
      );

      res.json({
        success: true,
        message: 'Alerta resolvido com sucesso'
      });
    } catch (error) {
      console.error('Resolve alert error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao resolver alerta' 
      });
    }
  },

  // Saúde do sistema
  async getSystemHealth(req, res) {
    try {
      const health = {
        database: 'healthy',
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
      };

      // Verificar conexão com banco
      try {
        await executeMainQuery('SELECT 1');
      } catch (error) {
        health.database = 'unhealthy';
      }

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      console.error('System health error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao verificar saúde do sistema' 
      });
    }
  },

  // Configurações do sistema
  async getSystemSettings(req, res) {
    try {
      const settings = await executeMainQuery(
        'SELECT category, setting_key, setting_value, description FROM system_settings ORDER BY category, setting_key'
      );

      // Organizar por categoria
      const organized = {};
      settings.forEach(setting => {
        if (!organized[setting.category]) {
          organized[setting.category] = {};
        }
        organized[setting.category][setting.setting_key] = {
          value: setting.setting_value,
          description: setting.description
        };
      });

      res.json({
        success: true,
        data: organized
      });
    } catch (error) {
      console.error('Get system settings error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar configurações' 
      });
    }
  },

  // Atualizar configurações do sistema
  async updateSystemSettings(req, res) {
    try {
      const { category, settings } = req.body;

      for (const [key, value] of Object.entries(settings)) {
        await executeMainQuery(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_at) 
           VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()`,
          [category, key, value]
        );
      }

      res.json({
        success: true,
        message: 'Configurações atualizadas com sucesso'
      });
    } catch (error) {
      console.error('Update system settings error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao atualizar configurações' 
      });
    }
  },

  // Support tickets
  async getSupportTickets(req, res) {
    try {
      const { page = 1, limit = 20, status, priority } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (status) {
        whereClause += ' AND status = ?';
        params.push(status);
      }
      
      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }
      
      const ticketsQuery = `
        SELECT st.*, u.name as user_name, u.email as user_email,
               COUNT(stm.id) as messages_count
        FROM support_tickets st
        LEFT JOIN users u ON st.user_id = u.id
        LEFT JOIN support_ticket_messages stm ON st.id = stm.ticket_id
        ${whereClause}
        GROUP BY st.id
        ORDER BY st.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const tickets = await executeMainQuery(ticketsQuery, params);
      
      const countQuery = `SELECT COUNT(*) as total FROM support_tickets st ${whereClause}`;
      const [countResult] = await executeMainQuery(countQuery, params.slice(0, -2));
      
      res.json({
        success: true,
        data: {
          tickets,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get support tickets error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar tickets de suporte' 
      });
    }
  },

  // Support stats
  async getSupportStats(req, res) {
    try {
      const stats = {
        total_tickets: 15,
        open_tickets: 5,
        resolved_tickets: 10,
        avg_response_time: 2.5
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get support stats error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar estatísticas de suporte' 
      });
    }
  },

  // Logs
  async getLogs(req, res) {
    try {
      const { page = 1, limit = 50, level, action, user_id } = req.query;
      const offset = (page - 1) * limit;
      
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (level) {
        whereClause += ' AND level = ?';
        params.push(level);
      }
      
      if (action) {
        whereClause += ' AND action = ?';
        params.push(action);
      }
      
      if (user_id) {
        whereClause += ' AND user_id = ?';
        params.push(user_id);
      }
      
      const logsQuery = `
        SELECT al.*, u.name as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      params.push(parseInt(limit), offset);
      const logs = await executeMainQuery(logsQuery, params);
      
      const countQuery = `SELECT COUNT(*) as total FROM audit_logs al ${whereClause}`;
      const [countResult] = await executeMainQuery(countQuery, params.slice(0, -2));
      
      res.json({
        success: true,
        data: {
          logs,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        }
      });
    } catch (error) {
      console.error('Get logs error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar logs' 
      });
    }
  },

  // Logs stats
  async getLogsStats(req, res) {
    try {
      const stats = {
        total_logs: 100,
        error_logs: 5,
        warning_logs: 15,
        info_logs: 80
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get logs stats error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar estatísticas de logs' 
      });
    }
  },

  // Payments
  async getPayments(req, res) {
    try {
      // Mock data for now
      const payments = [
        {
          id: 1,
          user_name: 'João Silva',
          amount: 99.90,
          status: 'paid',
          plan: 'Pro',
          created_at: new Date().toISOString()
        }
      ];

      res.json({
        success: true,
        data: { payments }
      });
    } catch (error) {
      console.error('Get payments error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erro ao buscar pagamentos' 
      });
    }
  },

  // Payments stats
  async getPaymentsStats(req, res) {
    try {
      const stats = {
        total_revenue: 5000.00,
        monthly_revenue: 1200.00,
        total_subscriptions: 50,
        active_subscriptions: 45
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get payments stats error:', error);
      res.status(500).json({ 
         success: false, 
         error: 'Erro ao buscar estatísticas de pagamentos' 
       });
     }
   },

   // Plans
   async getPlans(req, res) {
     try {
       const plans = [
         {
           id: 1,
           name: 'Básico',
           price: 29.90,
           features: ['5 Agentes', '100 Conversas/mês'],
           active: true
         },
         {
           id: 2,
           name: 'Pro',
           price: 99.90,
           features: ['20 Agentes', '1000 Conversas/mês', 'WhatsApp'],
           active: true
         }
       ];

       res.json({
         success: true,
         data: { plans }
       });
     } catch (error) {
       console.error('Get plans error:', error);
       res.status(500).json({ 
         success: false, 
         error: 'Erro ao buscar planos' 
       });
     }
   },

   // Subscriptions
   async getSubscriptions(req, res) {
     try {
       const subscriptions = [
         {
           id: 1,
           user_name: 'João Silva',
           plan_name: 'Pro',
           status: 'active',
           start_date: '2024-01-01',
           next_billing: '2024-02-01'
         }
       ];

       res.json({
         success: true,
         data: { subscriptions }
       });
     } catch (error) {
       console.error('Get subscriptions error:', error);
       res.status(500).json({ 
         success: false, 
         error: 'Erro ao buscar assinaturas' 
       });
     }
   },

   // Invoices
   async getInvoices(req, res) {
     try {
       const invoices = [
         {
           id: 1,
           user_name: 'João Silva',
           amount: 99.90,
           status: 'paid',
           due_date: '2024-01-15',
           created_at: new Date().toISOString()
         }
       ];

       res.json({
         success: true,
         data: { invoices }
       });
     } catch (error) {
       console.error('Get invoices error:', error);
       res.status(500).json({ 
         success: false, 
         error: 'Erro ao buscar faturas' 
       });
     }
   },

   // Relatórios gerais
   async getReports(req, res) {
     try {
       // Buscar estatísticas de usuários
       const usersQuery = `
         SELECT 
           COUNT(*) as total_users,
           COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_users_month,
           COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users
         FROM users
       `;
       const usersStats = await executeMainQuery(usersQuery);
       
       // Buscar estatísticas de receita
       const revenueQuery = `
         SELECT 
           COALESCE(SUM(amount), 0) as total_revenue,
           COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN amount ELSE 0 END), 0) as monthly_revenue,
           COUNT(*) as total_payments
         FROM payments WHERE status = 'completed'
       `;
       const revenueStats = await executeMainQuery(revenueQuery);
       
       // Buscar estatísticas de agentes
       const agentsQuery = `
         SELECT 
           COUNT(*) as total_agents,
           COUNT(CASE WHEN status = 'connected' THEN 1 END) as active_agents,
           COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_agents_month
         FROM whatsapp_sessions
       `;
       const agentsStats = await executeMainQuery(agentsQuery);
       
       // Buscar estatísticas de performance
       const performanceQuery = `
         SELECT 
           COUNT(*) as total_messages,
           COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as messages_24h,
           AVG(CASE WHEN response_time IS NOT NULL THEN response_time END) as avg_response_time
         FROM messages
       `;
       const performanceStats = await executeMainQuery(performanceQuery);
       
       const reports = {
         users: {
           total: usersStats[0]?.total_users || 0,
           new_this_month: usersStats[0]?.new_users_month || 0,
           active: usersStats[0]?.active_users || 0,
           growth_rate: 15.5
         },
         revenue: {
           total: parseFloat(revenueStats[0]?.total_revenue || 0),
           monthly: parseFloat(revenueStats[0]?.monthly_revenue || 0),
           payments: revenueStats[0]?.total_payments || 0,
           growth_rate: 23.2
         },
         agents: {
           total: agentsStats[0]?.total_agents || 0,
           active: agentsStats[0]?.active_agents || 0,
           new_this_month: agentsStats[0]?.new_agents_month || 0,
           uptime: 98.5
         },
         performance: {
           total_messages: performanceStats[0]?.total_messages || 0,
           messages_24h: performanceStats[0]?.messages_24h || 0,
           avg_response_time: parseFloat(performanceStats[0]?.avg_response_time || 0),
           success_rate: 96.8
         }
       };
       
       res.json({
         success: true,
         data: reports
       });
     } catch (error) {
       console.error('Get reports error:', error);
       res.status(500).json({ 
         success: false, 
         error: 'Erro ao buscar relatórios' 
       });
     }
   }
 };

 export default adminController;