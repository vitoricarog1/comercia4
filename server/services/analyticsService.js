import { executeMainQuery } from '../config/database.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import moment from 'moment';
import _ from 'lodash';

// Use executeMainQuery as db
const db = { query: executeMainQuery };

class AnalyticsService {
    constructor() {
        this.db = db;
    }

    // Registrar evento de analytics
    async trackEvent(userId, eventCategory, eventAction, eventLabel = null, eventValue = null, metadata = {}) {
        try {
            const query = `
                INSERT INTO analytics_events 
                (user_id, event_category, event_action, event_label, event_value, metadata, ip_address, user_agent)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            await this.db.query(query, [
                userId,
                eventCategory,
                eventAction,
                eventLabel,
                eventValue,
                JSON.stringify(metadata),
                metadata.ip_address || null,
                metadata.user_agent || null
            ]);

            return { success: true };
        } catch (error) {
            console.error('Erro ao registrar evento:', error);
            throw error;
        }
    }

    // Registrar métrica de performance
    async trackPerformance(userId, metricType, metricValue, metadata = {}) {
        try {
            const query = `
                INSERT INTO analytics_performance_metrics 
                (user_id, metric_type, metric_value, metadata)
                VALUES (?, ?, ?, ?)
            `;
            
            await this.db.query(query, [
                userId,
                metricType,
                metricValue,
                JSON.stringify(metadata)
            ]);

            return { success: true };
        } catch (error) {
            console.error('Erro ao registrar métrica:', error);
            throw error;
        }
    }

    // Obter dashboard de métricas
    async getDashboardMetrics(userId, dateRange = '7d') {
        try {
            const endDate = moment();
            const startDate = moment().subtract(parseInt(dateRange), 'days');

            // Métricas básicas
            const basicMetrics = await this.getBasicMetrics(userId, startDate, endDate);
            
            // Eventos por categoria
            const eventsByCategory = await this.getEventsByCategory(userId, startDate, endDate);
            
            // Métricas de performance
            const performanceMetrics = await this.getPerformanceMetrics(userId, startDate, endDate);
            
            // Tendências diárias
            const dailyTrends = await this.getDailyTrends(userId, startDate, endDate);
            
            // Top páginas/ações
            const topActions = await this.getTopActions(userId, startDate, endDate);

            return {
                basicMetrics,
                eventsByCategory,
                performanceMetrics,
                dailyTrends,
                topActions,
                dateRange: {
                    start: startDate.format('YYYY-MM-DD'),
                    end: endDate.format('YYYY-MM-DD')
                }
            };
        } catch (error) {
            console.error('Erro ao obter métricas do dashboard:', error);
            throw error;
        }
    }

    // Métricas básicas
    async getBasicMetrics(userId, startDate, endDate) {
        const query = `
            SELECT 
                COUNT(*) as total_events,
                COUNT(DISTINCT DATE(created_at)) as active_days,
                COUNT(DISTINCT event_category) as categories_used,
                AVG(CASE WHEN event_value IS NOT NULL THEN event_value END) as avg_event_value
            FROM analytics_events 
            WHERE user_id = ? AND created_at BETWEEN ? AND ?
        `;
        
        const [rows] = await this.db.query(query, [userId, startDate.format('YYYY-MM-DD HH:mm:ss'), endDate.format('YYYY-MM-DD HH:mm:ss')]);
        return rows[0];
    }

    // Eventos por categoria
    async getEventsByCategory(userId, startDate, endDate) {
        const query = `
            SELECT 
                event_category,
                COUNT(*) as count,
                COUNT(DISTINCT event_action) as unique_actions
            FROM analytics_events 
            WHERE user_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY event_category
            ORDER BY count DESC
        `;
        
        const [rows] = await this.db.query(query, [userId, startDate.format('YYYY-MM-DD HH:mm:ss'), endDate.format('YYYY-MM-DD HH:mm:ss')]);
        return rows;
    }

    // Métricas de performance
    async getPerformanceMetrics(userId, startDate, endDate) {
        const query = `
            SELECT 
                metric_type,
                AVG(metric_value) as avg_value,
                MIN(metric_value) as min_value,
                MAX(metric_value) as max_value,
                COUNT(*) as count
            FROM analytics_performance_metrics 
            WHERE user_id = ? AND recorded_at BETWEEN ? AND ?
            GROUP BY metric_type
        `;
        
        const [rows] = await this.db.query(query, [userId, startDate.format('YYYY-MM-DD HH:mm:ss'), endDate.format('YYYY-MM-DD HH:mm:ss')]);
        return rows;
    }

    // Tendências diárias
    async getDailyTrends(userId, startDate, endDate) {
        const query = `
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as events_count,
                COUNT(DISTINCT event_category) as categories_count
            FROM analytics_events 
            WHERE user_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY DATE(created_at)
            ORDER BY date
        `;
        
        const [rows] = await this.db.query(query, [userId, startDate.format('YYYY-MM-DD HH:mm:ss'), endDate.format('YYYY-MM-DD HH:mm:ss')]);
        return rows;
    }

    // Top ações
    async getTopActions(userId, startDate, endDate) {
        const query = `
            SELECT 
                event_action,
                event_category,
                COUNT(*) as count
            FROM analytics_events 
            WHERE user_id = ? AND created_at BETWEEN ? AND ?
            GROUP BY event_action, event_category
            ORDER BY count DESC
            LIMIT 10
        `;
        
        const [rows] = await this.db.query(query, [userId, startDate.format('YYYY-MM-DD HH:mm:ss'), endDate.format('YYYY-MM-DD HH:mm:ss')]);
        return rows;
    }

    // Gerar relatório em Excel
    async generateExcelReport(userId, dateRange = '30d') {
        try {
            const endDate = moment();
            const startDate = moment().subtract(parseInt(dateRange), 'days');
            
            const workbook = new ExcelJS.Workbook();
            
            // Aba de resumo
            const summarySheet = workbook.addWorksheet('Resumo');
            const basicMetrics = await this.getBasicMetrics(userId, startDate, endDate);
            
            summarySheet.addRow(['Métrica', 'Valor']);
            summarySheet.addRow(['Total de Eventos', basicMetrics.total_events]);
            summarySheet.addRow(['Dias Ativos', basicMetrics.active_days]);
            summarySheet.addRow(['Categorias Utilizadas', basicMetrics.categories_used]);
            summarySheet.addRow(['Valor Médio dos Eventos', basicMetrics.avg_event_value || 0]);
            
            // Aba de eventos por categoria
            const categorySheet = workbook.addWorksheet('Eventos por Categoria');
            const eventsByCategory = await this.getEventsByCategory(userId, startDate, endDate);
            
            categorySheet.addRow(['Categoria', 'Total de Eventos', 'Ações Únicas']);
            eventsByCategory.forEach(row => {
                categorySheet.addRow([row.event_category, row.count, row.unique_actions]);
            });
            
            // Aba de tendências diárias
            const trendsSheet = workbook.addWorksheet('Tendências Diárias');
            const dailyTrends = await this.getDailyTrends(userId, startDate, endDate);
            
            trendsSheet.addRow(['Data', 'Eventos', 'Categorias']);
            dailyTrends.forEach(row => {
                trendsSheet.addRow([row.date, row.events_count, row.categories_count]);
            });
            
            // Aba de performance
            const performanceSheet = workbook.addWorksheet('Performance');
            const performanceMetrics = await this.getPerformanceMetrics(userId, startDate, endDate);
            
            performanceSheet.addRow(['Tipo de Métrica', 'Valor Médio', 'Valor Mínimo', 'Valor Máximo', 'Contagem']);
            performanceMetrics.forEach(row => {
                performanceSheet.addRow([row.metric_type, row.avg_value, row.min_value, row.max_value, row.count]);
            });
            
            return workbook;
        } catch (error) {
            console.error('Erro ao gerar relatório Excel:', error);
            throw error;
        }
    }

    // Gerar relatório em PDF
    async generatePDFReport(userId, dateRange = '30d') {
        try {
            const endDate = moment();
            const startDate = moment().subtract(parseInt(dateRange), 'days');
            
            const doc = new PDFDocument();
            
            // Título
            doc.fontSize(20).text('Relatório de Analytics', 50, 50);
            doc.fontSize(12).text(`Período: ${startDate.format('DD/MM/YYYY')} - ${endDate.format('DD/MM/YYYY')}`, 50, 80);
            
            let yPosition = 120;
            
            // Métricas básicas
            const basicMetrics = await this.getBasicMetrics(userId, startDate, endDate);
            doc.fontSize(16).text('Resumo Geral', 50, yPosition);
            yPosition += 30;
            
            doc.fontSize(12)
                .text(`Total de Eventos: ${basicMetrics.total_events}`, 70, yPosition)
                .text(`Dias Ativos: ${basicMetrics.active_days}`, 70, yPosition + 20)
                .text(`Categorias Utilizadas: ${basicMetrics.categories_used}`, 70, yPosition + 40)
                .text(`Valor Médio dos Eventos: ${(basicMetrics.avg_event_value || 0).toFixed(2)}`, 70, yPosition + 60);
            
            yPosition += 100;
            
            // Eventos por categoria
            const eventsByCategory = await this.getEventsByCategory(userId, startDate, endDate);
            doc.fontSize(16).text('Eventos por Categoria', 50, yPosition);
            yPosition += 30;
            
            eventsByCategory.forEach(row => {
                doc.fontSize(12).text(`${row.event_category}: ${row.count} eventos (${row.unique_actions} ações únicas)`, 70, yPosition);
                yPosition += 20;
            });
            
            return doc;
        } catch (error) {
            console.error('Erro ao gerar relatório PDF:', error);
            throw error;
        }
    }

    // Obter funis de conversão
    async getFunnelAnalysis(userId, funnelSteps) {
        try {
            const results = [];
            
            for (let i = 0; i < funnelSteps.length; i++) {
                const step = funnelSteps[i];
                const query = `
                    SELECT COUNT(DISTINCT user_id) as users
                    FROM analytics_events 
                    WHERE user_id = ? AND event_category = ? AND event_action = ?
                `;
                
                const [rows] = await this.db.query(query, [userId, step.category, step.action]);
                
                results.push({
                    step: i + 1,
                    name: step.name,
                    users: rows[0].users,
                    conversion_rate: i === 0 ? 100 : (rows[0].users / results[0].users * 100).toFixed(2)
                });
            }
            
            return results;
        } catch (error) {
            console.error('Erro ao analisar funil:', error);
            throw error;
        }
    }

    // Segmentação de usuários
    async getUserSegments(userId) {
        try {
            const query = `
                SELECT 
                    CASE 
                        WHEN COUNT(*) >= 100 THEN 'power_user'
                        WHEN COUNT(*) >= 50 THEN 'regular_user'
                        WHEN COUNT(*) >= 10 THEN 'casual_user'
                        ELSE 'new_user'
                    END as segment,
                    COUNT(*) as event_count,
                    MIN(created_at) as first_event,
                    MAX(created_at) as last_event
                FROM analytics_events 
                WHERE user_id = ?
                GROUP BY user_id
            `;
            
            const [rows] = await this.db.query(query, [userId]);
            return rows[0] || { segment: 'new_user', event_count: 0 };
        } catch (error) {
            console.error('Erro ao obter segmento do usuário:', error);
            throw error;
        }
    }

    // Limpar dados antigos
    async cleanupOldData(daysToKeep = 365) {
        try {
            const cutoffDate = moment().subtract(daysToKeep, 'days').format('YYYY-MM-DD HH:mm:ss');
            
            await this.db.query('DELETE FROM analytics_events WHERE created_at < ?', [cutoffDate]);
            await this.db.query('DELETE FROM analytics_performance_metrics WHERE recorded_at < ?', [cutoffDate]);
            
            console.log(`Dados de analytics anteriores a ${cutoffDate} foram removidos`);
        } catch (error) {
            console.error('Erro ao limpar dados antigos:', error);
            throw error;
        }
    }
}

export default new AnalyticsService();