-- Criação das tabelas para sistema de analytics avançados
-- Data: 2024
-- Descrição: Sistema completo de analytics com dashboards, métricas e relatórios

USE ai_agents_saas_main;

-- Tabela para armazenar eventos de analytics
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    event_action VARCHAR(100) NOT NULL,
    event_label VARCHAR(255),
    event_value DECIMAL(10,2),
    properties JSON,
    session_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    referrer VARCHAR(500),
    page_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_event_type (event_type),
    INDEX idx_event_category (event_category),
    INDEX idx_created_at (created_at),
    INDEX idx_session_id (session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para métricas agregadas diárias
CREATE TABLE IF NOT EXISTS analytics_daily_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    metric_date DATE NOT NULL,
    total_events INT DEFAULT 0,
    unique_sessions INT DEFAULT 0,
    page_views INT DEFAULT 0,
    unique_page_views INT DEFAULT 0,
    session_duration_avg DECIMAL(10,2) DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    conversion_rate DECIMAL(5,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    agents_created INT DEFAULT 0,
    agents_used INT DEFAULT 0,
    api_calls INT DEFAULT 0,
    errors_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_date (user_id, metric_date),
    INDEX idx_metric_date (metric_date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para métricas de performance
CREATE TABLE IF NOT EXISTS analytics_performance_metrics (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    metric_type VARCHAR(50) NOT NULL, -- 'page_load', 'api_response', 'agent_execution'
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'ms', 'seconds', 'bytes'
    metadata JSON,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_metric (user_id, metric_type),
    INDEX idx_recorded_at (recorded_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para funis de conversão
CREATE TABLE IF NOT EXISTS analytics_funnels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    funnel_name VARCHAR(100) NOT NULL,
    funnel_description TEXT,
    steps JSON NOT NULL, -- Array de steps do funil
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para dados de funil por usuário
CREATE TABLE IF NOT EXISTS analytics_funnel_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    funnel_id INT NOT NULL,
    user_id INT NOT NULL,
    session_id VARCHAR(255) NOT NULL,
    step_index INT NOT NULL,
    step_name VARCHAR(100) NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON,
    INDEX idx_funnel_user (funnel_id, user_id),
    INDEX idx_session_step (session_id, step_index),
    FOREIGN KEY (funnel_id) REFERENCES analytics_funnels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para dashboards personalizados
CREATE TABLE IF NOT EXISTS analytics_dashboards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    dashboard_name VARCHAR(100) NOT NULL,
    dashboard_description TEXT,
    layout JSON NOT NULL, -- Configuração do layout dos widgets
    widgets JSON NOT NULL, -- Configuração dos widgets
    is_default BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para relatórios agendados
CREATE TABLE IF NOT EXISTS analytics_scheduled_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    report_name VARCHAR(100) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly', 'custom'
    report_config JSON NOT NULL, -- Configuração do relatório
    schedule_config JSON NOT NULL, -- Configuração do agendamento
    email_recipients JSON, -- Lista de emails para envio
    last_generated_at TIMESTAMP NULL,
    next_generation_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_next_generation (next_generation_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para histórico de relatórios gerados
CREATE TABLE IF NOT EXISTS analytics_report_history (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    scheduled_report_id INT NOT NULL,
    user_id INT NOT NULL,
    report_data JSON NOT NULL,
    file_path VARCHAR(500),
    file_format VARCHAR(20), -- 'pdf', 'excel', 'csv'
    generation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
    error_message TEXT,
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_scheduled_report (scheduled_report_id),
    INDEX idx_user_id (user_id),
    INDEX idx_generated_at (generated_at),
    FOREIGN KEY (scheduled_report_id) REFERENCES analytics_scheduled_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para segmentos de usuários
CREATE TABLE IF NOT EXISTS analytics_user_segments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    segment_name VARCHAR(100) NOT NULL,
    segment_description TEXT,
    segment_criteria JSON NOT NULL, -- Critérios para o segmento
    is_dynamic BOOLEAN DEFAULT TRUE, -- Se o segmento é atualizado automaticamente
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para metas e KPIs
CREATE TABLE IF NOT EXISTS analytics_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    goal_name VARCHAR(100) NOT NULL,
    goal_description TEXT,
    goal_type VARCHAR(50) NOT NULL, -- 'conversion', 'revenue', 'engagement', 'custom'
    target_value DECIMAL(12,2) NOT NULL,
    current_value DECIMAL(12,2) DEFAULT 0,
    measurement_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly'
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_goal_type (goal_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Inserir tipos de eventos padrão
INSERT IGNORE INTO analytics_events (user_id, event_type, event_category, event_action, event_label, created_at) VALUES
(1, 'page_view', 'navigation', 'view', 'dashboard', NOW()),
(1, 'user_action', 'agent', 'create', 'new_agent', NOW()),
(1, 'user_action', 'agent', 'execute', 'agent_run', NOW()),
(1, 'system', 'api', 'call', 'openai_api', NOW()),
(1, 'conversion', 'subscription', 'upgrade', 'premium_plan', NOW());

-- Criar dashboard padrão
INSERT IGNORE INTO analytics_dashboards (user_id, dashboard_name, dashboard_description, layout, widgets, is_default) VALUES
(1, 'Dashboard Principal', 'Dashboard padrão com métricas principais', 
 JSON_OBJECT(
   'columns', 12,
   'rows', 6,
   'gap', 4
 ),
 JSON_ARRAY(
   JSON_OBJECT('id', 'overview', 'type', 'metrics_cards', 'position', JSON_OBJECT('x', 0, 'y', 0, 'w', 12, 'h', 2)),
   JSON_OBJECT('id', 'traffic', 'type', 'line_chart', 'position', JSON_OBJECT('x', 0, 'y', 2, 'w', 8, 'h', 3)),
   JSON_OBJECT('id', 'top_pages', 'type', 'table', 'position', JSON_OBJECT('x', 8, 'y', 2, 'w', 4, 'h', 3)),
   JSON_OBJECT('id', 'conversion_funnel', 'type', 'funnel_chart', 'position', JSON_OBJECT('x', 0, 'y', 5, 'w', 6, 'h', 3)),
   JSON_OBJECT('id', 'real_time', 'type', 'real_time_users', 'position', JSON_OBJECT('x', 6, 'y', 5, 'w', 6, 'h', 3))
 ),
 TRUE);

-- Criar meta padrão
INSERT IGNORE INTO analytics_goals (user_id, goal_name, goal_description, goal_type, target_value, measurement_period, start_date) VALUES
(1, 'Conversões Mensais', 'Meta de conversões para o mês atual', 'conversion', 100.00, 'monthly', CURDATE());

-- Criar índices adicionais para performance
ALTER TABLE analytics_events ADD INDEX idx_events_category_action (event_category, event_action);
ALTER TABLE analytics_performance_metrics ADD INDEX idx_performance_type_date (metric_type, recorded_at);

-- Criar view para métricas em tempo real
DROP VIEW IF EXISTS analytics_real_time_metrics;
CREATE VIEW analytics_real_time_metrics AS
SELECT 
    user_id,
    COUNT(*) as total_events,
    COUNT(DISTINCT session_id) as active_sessions,
    COUNT(CASE WHEN event_category = 'page_view' THEN 1 END) as page_views,
    COUNT(CASE WHEN event_category = 'conversion' THEN 1 END) as conversions,
    AVG(CASE WHEN event_type = 'performance' AND event_action = 'page_load' THEN event_value END) as avg_page_load_time
FROM analytics_events 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
GROUP BY user_id;

-- Stored procedure para agregar métricas diárias
DELIMITER //
DROP PROCEDURE IF EXISTS AggregateAnalyticsDaily//
CREATE PROCEDURE AggregateAnalyticsDaily(IN target_date DATE)
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE current_user_id INT;
    DECLARE user_cursor CURSOR FOR SELECT DISTINCT user_id FROM analytics_events WHERE DATE(created_at) = target_date;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;
    
    OPEN user_cursor;
    
    user_loop: LOOP
        FETCH user_cursor INTO current_user_id;
        IF done THEN
            LEAVE user_loop;
        END IF;
        
        INSERT INTO analytics_daily_metrics (
            user_id, metric_date, total_events, unique_sessions, page_views, 
            unique_page_views, agents_created, agents_used, api_calls, errors_count
        )
        SELECT 
            current_user_id,
            target_date,
            COUNT(*) as total_events,
            COUNT(DISTINCT session_id) as unique_sessions,
            COUNT(CASE WHEN event_category = 'page_view' THEN 1 END) as page_views,
            COUNT(DISTINCT CASE WHEN event_category = 'page_view' THEN page_url END) as unique_page_views,
            COUNT(CASE WHEN event_action = 'create' AND event_category = 'agent' THEN 1 END) as agents_created,
            COUNT(CASE WHEN event_action = 'execute' AND event_category = 'agent' THEN 1 END) as agents_used,
            COUNT(CASE WHEN event_category = 'api' THEN 1 END) as api_calls,
            COUNT(CASE WHEN event_category = 'error' THEN 1 END) as errors_count
        FROM analytics_events 
        WHERE user_id = current_user_id AND DATE(created_at) = target_date
        ON DUPLICATE KEY UPDATE
            total_events = VALUES(total_events),
            unique_sessions = VALUES(unique_sessions),
            page_views = VALUES(page_views),
            unique_page_views = VALUES(unique_page_views),
            agents_created = VALUES(agents_created),
            agents_used = VALUES(agents_used),
            api_calls = VALUES(api_calls),
            errors_count = VALUES(errors_count),
            updated_at = CURRENT_TIMESTAMP;
    END LOOP;
    
    CLOSE user_cursor;
END//
DELIMITER ;

-- Event para executar agregação diária automaticamente
CREATE EVENT IF NOT EXISTS daily_analytics_aggregation
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '01:00:00')
DO
  CALL AggregateAnalyticsDaily(CURDATE() - INTERVAL 1 DAY);

-- Ativar o event scheduler se não estiver ativo
SET GLOBAL event_scheduler = ON;

SELECT 'Tabelas de analytics criadas com sucesso!' as status;