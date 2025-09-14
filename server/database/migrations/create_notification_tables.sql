-- Tabelas para sistema de notificações

-- Tabela de configurações de notificação por usuário
CREATE TABLE IF NOT EXISTS notification_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    email_frequency ENUM('immediate', 'hourly', 'daily', 'weekly') DEFAULT 'immediate',
    push_frequency ENUM('immediate', 'hourly', 'daily', 'weekly') DEFAULT 'immediate',
    quiet_hours_start TIME DEFAULT '22:00:00',
    quiet_hours_end TIME DEFAULT '08:00:00',
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_settings (user_id)
);

-- Tabela de tipos de notificação
CREATE TABLE IF NOT EXISTS notification_types (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category ENUM('system', 'security', 'billing', 'feature', 'marketing') DEFAULT 'system',
    default_enabled BOOLEAN DEFAULT TRUE,
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de preferências de notificação por tipo
CREATE TABLE IF NOT EXISTS notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_type (user_id, notification_type_id)
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    notification_type_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    status ENUM('pending', 'sent', 'failed', 'read') DEFAULT 'pending',
    scheduled_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    read_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status),
    INDEX idx_scheduled (scheduled_at),
    INDEX idx_priority (priority),
    INDEX idx_created (created_at)
);

-- Tabela de canais de entrega
CREATE TABLE IF NOT EXISTS notification_deliveries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_id INT NOT NULL,
    channel ENUM('email', 'push', 'sms', 'in_app') NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status ENUM('pending', 'sent', 'delivered', 'failed', 'bounced') DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_attempt_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    error_message TEXT,
    external_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
    INDEX idx_notification_channel (notification_id, channel),
    INDEX idx_status (status),
    INDEX idx_attempts (attempts)
);

-- Tabela de templates de notificação
CREATE TABLE IF NOT EXISTS notification_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_type_id INT NOT NULL,
    channel ENUM('email', 'push', 'sms', 'in_app') NOT NULL,
    language VARCHAR(5) DEFAULT 'pt-BR',
    subject VARCHAR(255),
    body TEXT NOT NULL,
    html_body TEXT,
    variables JSON,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE KEY unique_type_channel_lang (notification_type_id, channel, language)
);

-- Tabela de dispositivos para push notifications
CREATE TABLE IF NOT EXISTS push_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    device_token VARCHAR(500) NOT NULL,
    device_type ENUM('ios', 'android', 'web') NOT NULL,
    device_name VARCHAR(255),
    app_version VARCHAR(50),
    os_version VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_device_token (device_token),
    INDEX idx_user_active (user_id, is_active)
);

-- Tabela de estatísticas de notificação
CREATE TABLE IF NOT EXISTS notification_stats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    notification_type_id INT,
    channel ENUM('email', 'push', 'sms', 'in_app'),
    date DATE NOT NULL,
    sent_count INT DEFAULT 0,
    delivered_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    opened_count INT DEFAULT 0,
    clicked_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (notification_type_id) REFERENCES notification_types(id) ON DELETE CASCADE,
    UNIQUE KEY unique_stats (user_id, notification_type_id, channel, date),
    INDEX idx_date (date)
);

-- Inserir tipos de notificação padrão
INSERT IGNORE INTO notification_types (name, description, category, priority) VALUES
('welcome', 'Mensagem de boas-vindas para novos usuários', 'system', 'medium'),
('login_alert', 'Alerta de novo login na conta', 'security', 'high'),
('password_changed', 'Confirmação de alteração de senha', 'security', 'high'),
('two_factor_enabled', 'Confirmação de ativação do 2FA', 'security', 'medium'),
('backup_completed', 'Notificação de backup concluído', 'system', 'low'),
('backup_failed', 'Alerta de falha no backup', 'system', 'high'),
('payment_success', 'Confirmação de pagamento realizado', 'billing', 'medium'),
('payment_failed', 'Alerta de falha no pagamento', 'billing', 'high'),
('subscription_expiring', 'Aviso de expiração da assinatura', 'billing', 'high'),
('subscription_expired', 'Notificação de assinatura expirada', 'billing', 'critical'),
('api_limit_reached', 'Alerta de limite de API atingido', 'system', 'high'),
('new_feature', 'Anúncio de nova funcionalidade', 'feature', 'low'),
('maintenance_scheduled', 'Aviso de manutenção programada', 'system', 'medium'),
('security_breach', 'Alerta de violação de segurança', 'security', 'critical'),
('integration_connected', 'Confirmação de integração conectada', 'feature', 'low'),
('integration_failed', 'Alerta de falha na integração', 'feature', 'medium');

-- Inserir templates padrão para email
INSERT IGNORE INTO notification_templates (notification_type_id, channel, subject, body, html_body) VALUES
((SELECT id FROM notification_types WHERE name = 'welcome'), 'email', 
 'Bem-vindo ao IA Agents!', 
 'Olá! Bem-vindo ao IA Agents. Sua conta foi criada com sucesso.',
 '<h2>Bem-vindo ao IA Agents!</h2><p>Olá! Bem-vindo ao IA Agents. Sua conta foi criada com sucesso.</p>'),

((SELECT id FROM notification_types WHERE name = 'login_alert'), 'email',
 'Novo login detectado em sua conta',
 'Um novo login foi detectado em sua conta. Se não foi você, altere sua senha imediatamente.',
 '<h2>Novo login detectado</h2><p>Um novo login foi detectado em sua conta. Se não foi você, altere sua senha imediatamente.</p>'),

((SELECT id FROM notification_types WHERE name = 'backup_completed'), 'email',
 'Backup concluído com sucesso',
 'Seu backup foi concluído com sucesso.',
 '<h2>Backup Concluído</h2><p>Seu backup foi concluído com sucesso.</p>'),

((SELECT id FROM notification_types WHERE name = 'payment_success'), 'email',
 'Pagamento confirmado',
 'Seu pagamento foi processado com sucesso.',
 '<h2>Pagamento Confirmado</h2><p>Seu pagamento foi processado com sucesso.</p>');

-- Inserir templates para push notifications
INSERT IGNORE INTO notification_templates (notification_type_id, channel, subject, body) VALUES
((SELECT id FROM notification_types WHERE name = 'welcome'), 'push', 
 'Bem-vindo!', 'Sua conta foi criada com sucesso no IA Agents.'),

((SELECT id FROM notification_types WHERE name = 'login_alert'), 'push',
 'Novo login', 'Novo login detectado em sua conta.'),

((SELECT id FROM notification_types WHERE name = 'backup_completed'), 'push',
 'Backup concluído', 'Seu backup foi concluído com sucesso.'),

((SELECT id FROM notification_types WHERE name = 'api_limit_reached'), 'push',
 'Limite atingido', 'Você atingiu o limite de requisições da API.');

-- Criar índices para performance
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_status_scheduled ON notifications(status, scheduled_at);
CREATE INDEX idx_deliveries_status_attempts ON notification_deliveries(status, attempts);

-- Criar view para estatísticas rápidas
CREATE OR REPLACE VIEW notification_summary AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(n.id) as total_notifications,
    COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as sent_notifications,
    COUNT(CASE WHEN n.status = 'read' THEN 1 END) as read_notifications,
    COUNT(CASE WHEN n.read_at IS NULL AND n.status = 'sent' THEN 1 END) as unread_notifications,
    MAX(n.created_at) as last_notification_at
FROM users u
LEFT JOIN notifications n ON u.id = n.user_id
GROUP BY u.id, u.email;

-- Procedure para limpeza de notificações antigas
DELIMITER //
CREATE PROCEDURE CleanOldNotifications()
BEGIN
    -- Deletar notificações lidas há mais de 30 dias
    DELETE FROM notifications 
    WHERE status = 'read' 
    AND read_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- Deletar notificações expiradas
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL 
    AND expires_at < NOW();
    
    -- Deletar estatísticas antigas (mais de 1 ano)
    DELETE FROM notification_stats 
    WHERE date < DATE_SUB(CURDATE(), INTERVAL 1 YEAR);
    
    -- Desativar dispositivos não utilizados há mais de 90 dias
    UPDATE push_devices 
    SET is_active = FALSE 
    WHERE last_used_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
    AND is_active = TRUE;
END //
DELIMITER ;

-- Event para limpeza automática (executa diariamente às 3:00)
CREATE EVENT IF NOT EXISTS cleanup_notifications
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '03:00:00')
DO
  CALL CleanOldNotifications();

SELECT 'Tabelas de notificação criadas com sucesso!' as message;