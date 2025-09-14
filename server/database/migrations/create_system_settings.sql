-- Tabela para configurações do sistema
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    description TEXT,
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_category_key (category, setting_key),
    INDEX idx_category (category),
    INDEX idx_setting_key (setting_key)
);

-- Inserir configurações padrão
INSERT INTO system_settings (category, setting_key, setting_value, description, data_type, is_public) VALUES
('general', 'site_name', 'IA Agents SaaS', 'Nome do site', 'string', TRUE),
('general', 'site_description', 'Plataforma de agentes de IA para automação', 'Descrição do site', 'string', TRUE),
('general', 'maintenance_mode', 'false', 'Modo de manutenção', 'boolean', FALSE),
('email', 'smtp_host', '', 'Servidor SMTP', 'string', FALSE),
('email', 'smtp_port', '587', 'Porta SMTP', 'number', FALSE),
('email', 'smtp_user', '', 'Usuário SMTP', 'string', FALSE),
('email', 'smtp_password', '', 'Senha SMTP', 'string', FALSE),
('security', 'max_login_attempts', '5', 'Máximo de tentativas de login', 'number', FALSE),
('security', 'session_timeout', '3600', 'Timeout da sessão em segundos', 'number', FALSE),
('billing', 'currency', 'BRL', 'Moeda padrão', 'string', TRUE),
('billing', 'tax_rate', '0.00', 'Taxa de imposto', 'number', TRUE),
('features', 'max_agents_free', '2', 'Máximo de agentes no plano gratuito', 'number', TRUE),
('features', 'max_agents_basic', '10', 'Máximo de agentes no plano básico', 'number', TRUE),
('features', 'max_agents_premium', '50', 'Máximo de agentes no plano premium', 'number', TRUE),
('features', 'max_agents_enterprise', '-1', 'Máximo de agentes no plano enterprise (-1 = ilimitado)', 'number', TRUE);

SELECT 'Tabela system_settings criada com sucesso!' as status;