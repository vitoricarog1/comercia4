import express from 'express';
import analyticsService from '../services/analyticsService.js';
import { authMiddleware } from '../middleware/auth.js';
const router = express.Router();

// Use authMiddleware as authenticateToken
const authenticateToken = authMiddleware;

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

// Registrar evento de analytics
router.post('/events', async (req, res) => {
    try {
        const { eventCategory, eventAction, eventLabel, eventValue, metadata } = req.body;
        const userId = req.user.id;
        
        // Adicionar informações de contexto
        const enrichedMetadata = {
            ...metadata,
            ip_address: req.ip,
            user_agent: req.get('User-Agent'),
            timestamp: new Date().toISOString()
        };
        
        const result = await analyticsService.trackEvent(
            userId,
            eventCategory,
            eventAction,
            eventLabel,
            eventValue,
            enrichedMetadata
        );
        
        res.json(result);
    } catch (error) {
        console.error('Erro ao registrar evento:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Registrar métrica de performance
router.post('/performance', async (req, res) => {
    try {
        const { metricType, metricValue, metadata } = req.body;
        const userId = req.user.id;
        
        const result = await analyticsService.trackPerformance(
            userId,
            metricType,
            metricValue,
            metadata || {}
        );
        
        res.json(result);
    } catch (error) {
        console.error('Erro ao registrar métrica:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter dashboard de métricas
router.get('/dashboard', async (req, res) => {
    try {
        const { dateRange = '7d' } = req.query;
        const userId = req.user.id;
        
        const metrics = await analyticsService.getDashboardMetrics(userId, dateRange);
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Erro ao obter dashboard:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter métricas básicas
router.get('/metrics/basic', async (req, res) => {
    try {
        const { dateRange = '7d' } = req.query;
        const userId = req.user.id;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));
        
        const metrics = await analyticsService.getBasicMetrics(userId, startDate, endDate);
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Erro ao obter métricas básicas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter eventos por categoria
router.get('/events/by-category', async (req, res) => {
    try {
        const { dateRange = '7d' } = req.query;
        const userId = req.user.id;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));
        
        const events = await analyticsService.getEventsByCategory(userId, startDate, endDate);
        
        res.json({
            success: true,
            data: events
        });
    } catch (error) {
        console.error('Erro ao obter eventos por categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter métricas de performance
router.get('/metrics/performance', async (req, res) => {
    try {
        const { dateRange = '7d' } = req.query;
        const userId = req.user.id;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));
        
        const metrics = await analyticsService.getPerformanceMetrics(userId, startDate, endDate);
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Erro ao obter métricas de performance:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter tendências diárias
router.get('/trends/daily', async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const userId = req.user.id;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));
        
        const trends = await analyticsService.getDailyTrends(userId, startDate, endDate);
        
        res.json({
            success: true,
            data: trends
        });
    } catch (error) {
        console.error('Erro ao obter tendências diárias:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Obter top ações
router.get('/actions/top', async (req, res) => {
    try {
        const { dateRange = '7d', limit = 10 } = req.query;
        const userId = req.user.id;
        
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - parseInt(dateRange));
        
        const actions = await analyticsService.getTopActions(userId, startDate, endDate);
        
        res.json({
            success: true,
            data: actions.slice(0, parseInt(limit))
        });
    } catch (error) {
        console.error('Erro ao obter top ações:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Análise de funil
router.post('/funnel', async (req, res) => {
    try {
        const { steps } = req.body;
        const userId = req.user.id;
        
        if (!steps || !Array.isArray(steps)) {
            return res.status(400).json({ error: 'Steps do funil são obrigatórios' });
        }
        
        const analysis = await analyticsService.getFunnelAnalysis(userId, steps);
        
        res.json({
            success: true,
            data: analysis
        });
    } catch (error) {
        console.error('Erro ao analisar funil:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Segmentação de usuário
router.get('/user/segment', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const segment = await analyticsService.getUserSegments(userId);
        
        res.json({
            success: true,
            data: segment
        });
    } catch (error) {
        console.error('Erro ao obter segmento do usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Gerar relatório Excel
router.get('/reports/excel', async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const userId = req.user.id;
        
        const workbook = await analyticsService.generateExcelReport(userId, dateRange);
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`);
        
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao gerar relatório Excel:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Gerar relatório PDF
router.get('/reports/pdf', async (req, res) => {
    try {
        const { dateRange = '30d' } = req.query;
        const userId = req.user.id;
        
        const doc = await analyticsService.generatePDFReport(userId, dateRange);
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-report-${new Date().toISOString().split('T')[0]}.pdf`);
        
        doc.pipe(res);
        doc.end();
    } catch (error) {
        console.error('Erro ao gerar relatório PDF:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Eventos em lote (para otimização)
router.post('/events/batch', async (req, res) => {
    try {
        const { events } = req.body;
        const userId = req.user.id;
        
        if (!events || !Array.isArray(events)) {
            return res.status(400).json({ error: 'Lista de eventos é obrigatória' });
        }
        
        const results = [];
        
        for (const event of events) {
            const enrichedMetadata = {
                ...event.metadata,
                ip_address: req.ip,
                user_agent: req.get('User-Agent'),
                timestamp: new Date().toISOString()
            };
            
            const result = await analyticsService.trackEvent(
                userId,
                event.eventCategory,
                event.eventAction,
                event.eventLabel,
                event.eventValue,
                enrichedMetadata
            );
            
            results.push(result);
        }
        
        res.json({
            success: true,
            processed: results.length,
            results
        });
    } catch (error) {
        console.error('Erro ao processar eventos em lote:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// Estatísticas gerais
router.get('/stats', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Obter estatísticas dos últimos 30 dias
        const metrics = await analyticsService.getDashboardMetrics(userId, '30d');
        const segment = await analyticsService.getUserSegments(userId);
        
        res.json({
            success: true,
            data: {
                ...metrics,
                userSegment: segment
            }
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

export default router;