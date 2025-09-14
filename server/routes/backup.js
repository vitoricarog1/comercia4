import express from 'express';
import BackupService from '../services/backupService.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();

// Use authMiddleware as authenticateToken
const authenticateToken = authMiddleware;

const backupService = BackupService;

// Configurar backup automático
router.post('/configure', authenticateToken, async (req, res) => {
  try {
    const { schedule } = req.body;
    const userId = req.user.id;

    if (!schedule) {
      return res.status(400).json({ error: 'Schedule é obrigatório' });
    }

    const result = await backupService.setupAutomaticBackup(userId, schedule);
    res.json(result);
  } catch (error) {
    console.error('Erro ao configurar backup:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar backup manual
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await backupService.createFullBackup(userId);
    res.json({
      success: true,
      message: 'Backup criado com sucesso',
      backup: result
    });
  } catch (error) {
    console.error('Erro ao criar backup:', error);
    res.status(500).json({ error: 'Erro ao criar backup' });
  }
});

// Listar backups
router.get('/list', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const backups = await backupService.listBackups(userId);
    res.json({
      success: true,
      backups
    });
  } catch (error) {
    console.error('Erro ao listar backups:', error);
    res.status(500).json({ error: 'Erro ao listar backups' });
  }
});

// Restaurar backup
router.post('/restore/:backupId', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;
    const userId = req.user.id;
    
    // Buscar informações do backup
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ai_agents_saas_main'
    });

    const [backup] = await connection.execute(
      'SELECT file_name, file_path FROM backups WHERE id = ? AND user_id = ?',
      [backupId, userId]
    );

    await connection.end();

    if (!backup.length) {
      return res.status(404).json({ error: 'Backup não encontrado' });
    }

    const result = await backupService.restoreBackup(userId, backup[0].file_name);
    res.json(result);
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    res.status(500).json({ error: 'Erro ao restaurar backup' });
  }
});

// Deletar backup
router.delete('/:backupId', authenticateToken, async (req, res) => {
  try {
    const { backupId } = req.params;
    const userId = req.user.id;
    
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ai_agents_saas_main'
    });

    // Buscar backup
    const [backup] = await connection.execute(
      'SELECT file_path FROM backups WHERE id = ? AND user_id = ?',
      [backupId, userId]
    );

    if (!backup.length) {
      await connection.end();
      return res.status(404).json({ error: 'Backup não encontrado' });
    }

    // Deletar arquivo físico
    const fs = require('fs');
    if (fs.existsSync(backup[0].file_path)) {
      fs.unlinkSync(backup[0].file_path);
    }

    // Deletar registro do banco
    await connection.execute(
      'DELETE FROM backups WHERE id = ? AND user_id = ?',
      [backupId, userId]
    );

    await connection.end();

    res.json({ success: true, message: 'Backup deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar backup:', error);
    res.status(500).json({ error: 'Erro ao deletar backup' });
  }
});

// Obter configuração de backup
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ai_agents_saas_main'
    });

    const [config] = await connection.execute(
      'SELECT * FROM backup_configs WHERE user_id = ?',
      [userId]
    );

    await connection.end();

    res.json({
      success: true,
      config: config.length ? config[0] : null
    });
  } catch (error) {
    console.error('Erro ao obter configuração:', error);
    res.status(500).json({ error: 'Erro ao obter configuração' });
  }
});

// Obter estatísticas de backup
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ai_agents_saas_main'
    });

    // Estatísticas gerais
    const [totalBackups] = await connection.execute(
      'SELECT COUNT(*) as total FROM backups WHERE user_id = ?',
      [userId]
    );

    const [totalSize] = await connection.execute(
      'SELECT SUM(file_size) as total_size FROM backups WHERE user_id = ?',
      [userId]
    );

    const [lastBackup] = await connection.execute(
      'SELECT created_at FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    const [successfulBackups] = await connection.execute(
      'SELECT COUNT(*) as successful FROM backups WHERE user_id = ? AND status = "completed"',
      [userId]
    );

    await connection.end();

    res.json({
      success: true,
      stats: {
        total_backups: totalBackups[0].total,
        total_size: totalSize[0].total_size || 0,
        last_backup: lastBackup.length ? lastBackup[0].created_at : null,
        successful_backups: successfulBackups[0].successful,
        success_rate: totalBackups[0].total > 0 ? 
          (successfulBackups[0].successful / totalBackups[0].total * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro ao obter estatísticas' });
  }
});

// Testar configuração de backup
router.post('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Criar um backup de teste (menor)
    const result = await backupService.createFullBackup(userId);
    
    res.json({
      success: true,
      message: 'Teste de backup realizado com sucesso',
      test_result: result
    });
  } catch (error) {
    console.error('Erro no teste de backup:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro no teste de backup',
      details: error.message
    });
  }
});

export default router;