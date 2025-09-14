import express from 'express';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import adminController from '../controllers/adminController.js';
import { validatePagination } from '../middleware/validation.js';

const router = express.Router();

// Rota de validação de token (sem middleware admin para permitir verificação)
router.get('/validate', authMiddleware, (req, res) => {
    // Se chegou até aqui, o token é válido
    if (req.user && req.user.role === 'admin') {
        res.json({
            success: true,
            message: 'Token válido',
            user: {
                id: req.user.id,
                name: req.user.name,
                email: req.user.email,
                role: req.user.role
            }
        });
    } else {
        res.status(403).json({
            success: false,
            message: 'Acesso negado. Apenas administradores.'
        });
    }
});

// Aplicar middleware de autenticação e admin para todas as outras rotas
router.use(authMiddleware);
router.use(adminMiddleware);

// Dashboard administrativo
router.get('/dashboard', adminController.getDashboard);

// Estatísticas para o painel admin
router.get('/stats', adminController.getSystemStats);
router.get('/performance', adminController.getPerformanceMetrics);

// Suspender/reativar usuários
router.patch('/users/:userId/suspend', adminController.suspendUser);
router.patch('/users/:userId/activate', adminController.activateUser);

// Gerenciamento de usuários
router.get('/users', validatePagination, adminController.getUsers);
router.post('/users', adminController.createUser);
router.get('/users/:id', adminController.getUserById);
router.put('/users/:id', adminController.updateUser);
router.put('/users/:id/settings', adminController.updateUserSettings);
router.delete('/users/:id', adminController.deleteUser);
router.post('/users/:id/reset-password', adminController.resetPassword);

// Agentes
router.put('/users/:userId/agents/:agentId', adminController.updateAgent);
router.delete('/users/:userId/agents/:agentId', adminController.deleteAgent);

// Visualização de agentes de todos os usuários
router.get('/agents', validatePagination, adminController.getAllAgents);

// Visualização de conversas de todos os usuários
router.get('/conversations', validatePagination, adminController.getAllConversations);

// Logs de auditoria
router.get('/audit-logs', validatePagination, adminController.getAuditLogs);

// Alertas do sistema
router.get('/alerts', validatePagination, adminController.getAlerts);
router.put('/alerts/:id/resolve', adminController.resolveAlert);

// Saúde do sistema
router.get('/system/health', adminController.getSystemHealth);

// Configurações do sistema
router.get('/settings', adminController.getSystemSettings);
router.put('/settings', adminController.updateSystemSettings);
router.put('/settings/general', adminController.updateGeneralSettings);
router.put('/settings/integrations', adminController.updateIntegrationSettings);
router.put('/settings/security', adminController.updateSecuritySettings);
router.put('/settings/limits', adminController.updateLimitsSettings);
router.put('/settings/notifications', adminController.updateNotificationSettings);
router.put('/settings/maintenance', adminController.updateMaintenanceSettings);

// Testes de integração
router.post('/settings/test/whatsapp', adminController.testWhatsAppConnection);
router.post('/settings/test/email', adminController.testEmailConnection);

// Manutenção do sistema
router.post('/maintenance/backup', adminController.createManualBackup);
router.get('/maintenance/backup/download', adminController.downloadBackup);
router.post('/maintenance/cleanup-logs', adminController.cleanupLogs);
router.post('/maintenance/optimize-db', adminController.optimizeDatabase);
router.post('/maintenance/clear-cache', adminController.clearCache)

// Support endpoints
router.get('/support/tickets', adminController.getSupportTickets);
router.get('/support/stats', adminController.getSupportStats);

// Logs endpoints
router.get('/logs', adminController.getLogs);
router.get('/logs/stats', adminController.getLogsStats);

// Payments endpoints
router.get('/payments', adminController.getPayments);
router.get('/payments/stats', adminController.getPaymentsStats);
router.get('/plans', adminController.getPlans);
router.get('/subscriptions', adminController.getSubscriptions);
router.get('/invoices', adminController.getInvoices);

// Relatórios
router.get('/reports', adminController.getReports);

export default router;