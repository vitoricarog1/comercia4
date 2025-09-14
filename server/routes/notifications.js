import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import notificationService from '../services/notificationService.js';
import { executeMainQuery } from '../config/database.js';
const router = express.Router();

// Use authMiddleware as authenticateToken
const authenticateToken = authMiddleware;
// Use executeMainQuery as db
const db = { query: executeMainQuery };

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Buscar notificações do usuário
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 50, offset = 0, unread_only = false } = req.query;
        
        const notifications = await notificationService.getUserNotifications(
            userId, 
            parseInt(limit), 
            parseInt(offset), 
            unread_only === 'true'
        );
        
        // Buscar contagem total
        let countQuery = `
            SELECT COUNT(*) as total
            FROM notifications n
            WHERE n.user_id = ?
        `;
        
        const countParams = [userId];
        
        if (unread_only === 'true') {
            countQuery += ' AND n.status != "read"';
        }
        
        const countResult = await db.query(countQuery, countParams);
        const total = countResult[0].total;
        
        res.json({
            success: true,
            data: {
                notifications,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    has_more: (parseInt(offset) + parseInt(limit)) < total
                }
            }
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar notificações'
        });
    }
});

// Marcar notificação como lida
router.patch('/:id/read', async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;
        
        const success = await notificationService.markAsRead(notificationId, userId);
        
        if (success) {
            res.json({
                success: true,
                message: 'Notificação marcada como lida'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar notificação como lida'
        });
    }
});

// Marcar todas as notificações como lidas
router.patch('/mark-all-read', async (req, res) => {
    try {
        const userId = req.user.id;
        
        await db.execute(`
            UPDATE notifications 
            SET status = 'read', read_at = NOW() 
            WHERE user_id = ? AND status != 'read'
        `, [userId]);
        
        res.json({
            success: true,
            message: 'Todas as notificações foram marcadas como lidas'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar todas as notificações como lidas'
        });
    }
});

// Deletar notificação
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = req.params.id;
        
        const result = await db.query(`
            DELETE FROM notifications 
            WHERE id = ? AND user_id = ?
        `, [notificationId, userId]);
        
        if (result.affectedRows > 0) {
            res.json({
                success: true,
                message: 'Notificação deletada com sucesso'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao deletar notificação'
        });
    }
});

// Buscar configurações de notificação do usuário
router.get('/settings', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Buscar configurações gerais
        const settings = await db.query(`
            SELECT * FROM notification_settings WHERE user_id = ?
        `, [userId]);
        
        // Buscar preferências por tipo
        const preferences = await db.query(`
            SELECT np.*, nt.name, nt.description, nt.category, nt.priority
            FROM notification_preferences np
            JOIN notification_types nt ON np.notification_type_id = nt.id
            WHERE np.user_id = ?
        `, [userId]);
        
        // Buscar todos os tipos disponíveis
        const types = await db.query(`
            SELECT * FROM notification_types ORDER BY category, name
        `);
        
        res.json({
            success: true,
            data: {
                general_settings: settings[0] || {
                    email_enabled: true,
                    push_enabled: true,
                    sms_enabled: false,
                    email_frequency: 'immediate',
                    push_frequency: 'immediate',
                    quiet_hours_start: '22:00:00',
                    quiet_hours_end: '08:00:00',
                    timezone: 'America/Sao_Paulo'
                },
                type_preferences: preferences,
                available_types: types
            }
        });
    } catch (error) {
        console.error('Error fetching notification settings:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar configurações de notificação'
        });
    }
});

// Atualizar configurações gerais de notificação
router.put('/settings', async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;
        
        const success = await notificationService.updateNotificationSettings(userId, settings);
        
        if (success) {
            res.json({
                success: true,
                message: 'Configurações atualizadas com sucesso'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Erro ao atualizar configurações'
            });
        }
    } catch (error) {
        console.error('Error updating notification settings:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar configurações'
        });
    }
});

// Atualizar preferências por tipo de notificação
router.put('/settings/types/:typeId', async (req, res) => {
    try {
        const userId = req.user.id;
        const typeId = req.params.typeId;
        const { email_enabled, push_enabled, sms_enabled } = req.body;
        
        await db.execute(`
            INSERT INTO notification_preferences 
            (user_id, notification_type_id, email_enabled, push_enabled, sms_enabled)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            email_enabled = VALUES(email_enabled),
            push_enabled = VALUES(push_enabled),
            sms_enabled = VALUES(sms_enabled)
        `, [userId, typeId, email_enabled, push_enabled, sms_enabled]);
        
        res.json({
            success: true,
            message: 'Preferências atualizadas com sucesso'
        });
    } catch (error) {
        console.error('Error updating type preferences:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar preferências'
        });
    }
});

// Registrar dispositivo para push notifications
router.post('/devices', async (req, res) => {
    try {
        const userId = req.user.id;
        const { device_token, device_type, device_info = {} } = req.body;
        
        if (!device_token || !device_type) {
            return res.status(400).json({
                success: false,
                message: 'Token do dispositivo e tipo são obrigatórios'
            });
        }
        
        const success = await notificationService.registerPushDevice(
            userId, device_token, device_type, device_info
        );
        
        if (success) {
            res.json({
                success: true,
                message: 'Dispositivo registrado com sucesso'
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Erro ao registrar dispositivo'
            });
        }
    } catch (error) {
        console.error('Error registering push device:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao registrar dispositivo'
        });
    }
});

// Listar dispositivos registrados
router.get('/devices', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const devices = await db.query(`
            SELECT id, device_type, device_name, app_version, os_version, 
                   is_active, last_used_at, created_at
            FROM push_devices 
            WHERE user_id = ?
            ORDER BY last_used_at DESC
        `, [userId]);
        
        res.json({
            success: true,
            data: devices
        });
    } catch (error) {
        console.error('Error fetching devices:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar dispositivos'
        });
    }
});

// Remover dispositivo
router.delete('/devices/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const deviceId = req.params.id;
        
        const result = await db.query(`
            UPDATE push_devices 
            SET is_active = FALSE 
            WHERE id = ? AND user_id = ?
        `, [deviceId, userId]);
        
        if (result.affectedRows > 0) {
            res.json({
                success: true,
                message: 'Dispositivo removido com sucesso'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Dispositivo não encontrado'
            });
        }
    } catch (error) {
        console.error('Error removing device:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover dispositivo'
        });
    }
});

// Buscar estatísticas de notificação
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = '30' } = req.query; // dias
        
        // Estatísticas gerais
        const generalStats = await db.query(`
            SELECT 
                COUNT(*) as total_notifications,
                COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_notifications,
                COUNT(CASE WHEN status = 'read' THEN 1 END) as read_notifications,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_notifications,
                COUNT(CASE WHEN read_at IS NULL AND status = 'sent' THEN 1 END) as unread_notifications
            FROM notifications 
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        `, [userId, parseInt(period)]);
        
        // Estatísticas por canal
        const channelStats = await db.query(`
            SELECT 
                nd.channel,
                COUNT(*) as total_deliveries,
                COUNT(CASE WHEN nd.status = 'sent' THEN 1 END) as successful_deliveries,
                COUNT(CASE WHEN nd.status = 'failed' THEN 1 END) as failed_deliveries
            FROM notification_deliveries nd
            JOIN notifications n ON nd.notification_id = n.id
            WHERE n.user_id = ? AND nd.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY nd.channel
        `, [userId, parseInt(period)]);
        
        // Estatísticas por tipo
        const typeStats = await db.query(`
            SELECT 
                nt.name,
                nt.category,
                COUNT(*) as notification_count
            FROM notifications n
            JOIN notification_types nt ON n.notification_type_id = nt.id
            WHERE n.user_id = ? AND n.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY nt.id, nt.name, nt.category
            ORDER BY notification_count DESC
        `, [userId, parseInt(period)]);
        
        // Estatísticas diárias
        const dailyStats = await db.query(`
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as notification_count,
                COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count
            FROM notifications 
            WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        `, [userId, parseInt(period)]);
        
        res.json({
            success: true,
            data: {
                general: generalStats[0],
                by_channel: channelStats,
                by_type: typeStats,
                daily: dailyStats,
                period_days: parseInt(period)
            }
        });
    } catch (error) {
        console.error('Error fetching notification stats:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao buscar estatísticas'
        });
    }
});

// Testar notificação (enviar notificação de teste)
router.post('/test', async (req, res) => {
    try {
        const userId = req.user.id;
        const { channels = ['email', 'push'] } = req.body;
        
        // Buscar tipo de notificação de teste
        let [testType] = await db.execute(`
            SELECT id FROM notification_types WHERE name = 'test_notification'
        `);
        
        // Se não existir, criar tipo de teste
        if (testType.length === 0) {
            await db.execute(`
                INSERT INTO notification_types (name, description, category, priority)
                VALUES ('test_notification', 'Notificação de teste', 'system', 'low')
            `);
            
            [testType] = await db.execute(`
                SELECT id FROM notification_types WHERE name = 'test_notification'
            `);
        }
        
        const notificationId = await notificationService.createNotification(
            userId,
            testType[0].id,
            'Notificação de Teste',
            'Esta é uma notificação de teste para verificar se suas configurações estão funcionando corretamente.',
            { test: true, channels },
            'low'
        );
        
        res.json({
            success: true,
            message: 'Notificação de teste enviada',
            notification_id: notificationId
        });
    } catch (error) {
        console.error('Error sending test notification:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao enviar notificação de teste'
        });
    }
});

// Criar notificação personalizada (admin)
router.post('/create', async (req, res) => {
    try {
        // Verificar se é admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado'
            });
        }
        
        const { 
            user_id, 
            notification_type_id, 
            title, 
            message, 
            data, 
            priority = 'medium',
            scheduled_at 
        } = req.body;
        
        if (!user_id || !notification_type_id || !title || !message) {
            return res.status(400).json({
                success: false,
                message: 'Campos obrigatórios: user_id, notification_type_id, title, message'
            });
        }
        
        const notificationId = await notificationService.createNotification(
            user_id,
            notification_type_id,
            title,
            message,
            data,
            priority,
            scheduled_at
        );
        
        res.json({
            success: true,
            message: 'Notificação criada com sucesso',
            notification_id: notificationId
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar notificação'
        });
    }
});

export default router;