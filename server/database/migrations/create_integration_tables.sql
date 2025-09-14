-- Integration Settings Table
CREATE TABLE IF NOT EXISTS integration_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    config JSON NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tenant_platform (tenant_id, platform),
    INDEX idx_tenant_active (tenant_id, is_active)
);

-- Integration Messages Table
CREATE TABLE IF NOT EXISTS integration_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    chat_id VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    direction ENUM('incoming', 'outgoing') NOT NULL,
    message_id VARCHAR(255) NULL,
    metadata JSON NULL,
    status ENUM('sent', 'delivered', 'read', 'failed') DEFAULT 'sent',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_platform (tenant_id, platform),
    INDEX idx_user_chat (user_id, chat_id),
    INDEX idx_created_at (created_at),
    INDEX idx_direction_status (direction, status)
);

-- Integration Webhooks Table
CREATE TABLE IF NOT EXISTS integration_webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    webhook_url VARCHAR(500) NOT NULL,
    verify_token VARCHAR(255) NULL,
    secret_key VARCHAR(255) NULL,
    is_active BOOLEAN DEFAULT true,
    last_verified TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_tenant_platform_webhook (tenant_id, platform),
    INDEX idx_tenant_active (tenant_id, is_active)
);

-- Integration Users Table (for mapping external users to internal system)
CREATE TABLE IF NOT EXISTS integration_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    external_user_id VARCHAR(255) NOT NULL,
    internal_user_id INT NULL,
    user_data JSON NULL,
    first_contact TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contact TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT false,
    UNIQUE KEY unique_platform_external_user (platform, external_user_id),
    INDEX idx_tenant_platform (tenant_id, platform),
    INDEX idx_internal_user (internal_user_id),
    INDEX idx_last_contact (last_contact)
);

-- Integration Analytics Table
CREATE TABLE IF NOT EXISTS integration_analytics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    metric_type ENUM('messages_sent', 'messages_received', 'users_active', 'response_time', 'error_rate') NOT NULL,
    metric_value DECIMAL(10,2) NOT NULL,
    date_recorded DATE NOT NULL,
    hour_recorded TINYINT NULL,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_platform_date (tenant_id, platform, date_recorded),
    INDEX idx_metric_type_date (metric_type, date_recorded)
);

-- Integration Templates Table (for message templates)
CREATE TABLE IF NOT EXISTS integration_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    template_name VARCHAR(100) NOT NULL,
    template_content TEXT NOT NULL,
    template_type ENUM('welcome', 'goodbye', 'error', 'custom') NOT NULL,
    variables JSON NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_platform_type (tenant_id, platform, template_type),
    INDEX idx_template_name (template_name)
);

-- Integration Automation Rules Table
CREATE TABLE IF NOT EXISTS integration_automation_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    platform ENUM('telegram', 'instagram', 'facebook_messenger', 'email', 'whatsapp') NOT NULL,
    rule_name VARCHAR(100) NOT NULL,
    trigger_conditions JSON NOT NULL,
    actions JSON NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INT DEFAULT 0,
    execution_count INT DEFAULT 0,
    last_executed TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_platform_active (tenant_id, platform, is_active),
    INDEX idx_priority (priority)
);

-- Insert default templates
INSERT INTO integration_templates (tenant_id, platform, template_name, template_content, template_type, variables) VALUES
(1, 'telegram', 'welcome_message', 'Olá {{name}}! Bem-vindo ao nosso atendimento automatizado. Como posso ajudá-lo hoje?', 'welcome', '{"name": "string"}'),
(1, 'telegram', 'error_message', 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente em alguns instantes.', 'error', '{}'),
(1, 'instagram', 'welcome_message', 'Olá! Obrigado por entrar em contato. Como posso ajudá-lo?', 'welcome', '{}'),
(1, 'instagram', 'error_message', 'Ops! Algo deu errado. Por favor, tente novamente.', 'error', '{}'),
(1, 'facebook_messenger', 'welcome_message', 'Olá! Bem-vindo ao nosso atendimento. Em que posso ajudá-lo?', 'welcome', '{}'),
(1, 'facebook_messenger', 'error_message', 'Desculpe, houve um problema. Tente novamente, por favor.', 'error', '{}'),
(1, 'email', 'welcome_message', 'Obrigado por entrar em contato conosco. Recebemos sua mensagem e responderemos em breve.', 'welcome', '{}'),
(1, 'email', 'error_message', 'Houve um problema ao processar sua solicitação. Nossa equipe foi notificada.', 'error', '{}');

-- Insert default automation rules
INSERT INTO integration_automation_rules (tenant_id, platform, rule_name, trigger_conditions, actions, priority) VALUES
(1, 'telegram', 'Auto Welcome', '{"event": "first_message", "conditions": []}', '{"send_template": "welcome_message", "tag_user": "new_user"}', 1),
(1, 'instagram', 'Auto Welcome', '{"event": "first_message", "conditions": []}', '{"send_template": "welcome_message", "tag_user": "new_user"}', 1),
(1, 'facebook_messenger', 'Auto Welcome', '{"event": "first_message", "conditions": []}', '{"send_template": "welcome_message", "tag_user": "new_user"}', 1),
(1, 'email', 'Auto Reply', '{"event": "new_email", "conditions": []}', '{"send_template": "welcome_message", "create_ticket": true}', 1);

-- Create indexes for better performance
CREATE INDEX idx_integration_messages_tenant_platform_created ON integration_messages(tenant_id, platform, created_at DESC);
CREATE INDEX idx_integration_users_platform_last_contact ON integration_users(platform, last_contact DESC);
CREATE INDEX idx_integration_analytics_platform_date_metric ON integration_analytics(platform, date_recorded, metric_type);

-- Create a view for integration statistics
CREATE OR REPLACE VIEW integration_stats AS
SELECT 
    tenant_id,
    platform,
    COUNT(CASE WHEN direction = 'incoming' THEN 1 END) as messages_received,
    COUNT(CASE WHEN direction = 'outgoing' THEN 1 END) as messages_sent,
    COUNT(DISTINCT user_id) as unique_users,
    DATE(created_at) as date
FROM integration_messages 
GROUP BY tenant_id, platform, DATE(created_at);

-- Create stored procedure for cleaning old messages
DELIMITER //
CREATE PROCEDURE CleanOldIntegrationMessages(IN days_to_keep INT)
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    -- Delete messages older than specified days
    DELETE FROM integration_messages 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL days_to_keep DAY);
    
    -- Delete old analytics data (keep 1 year)
    DELETE FROM integration_analytics 
    WHERE date_recorded < DATE_SUB(CURDATE(), INTERVAL 365 DAY);
    
    COMMIT;
END //
DELIMITER ;

-- Create event for automatic cleanup (runs daily at 2 AM)
CREATE EVENT IF NOT EXISTS cleanup_integration_data
ON SCHEDULE EVERY 1 DAY
STARTS '2024-01-01 02:00:00'
DO
  CALL CleanOldIntegrationMessages(90); -- Keep 90 days of messages