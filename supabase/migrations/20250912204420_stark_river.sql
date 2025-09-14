-- Migration: Create main system tables
-- Description: Creates the main system tables for user management and system administration
-- Date: 2025-01-15

-- Create main users table (system-wide)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
    company VARCHAR(255),
    phone VARCHAR(20),
    avatar VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_users_email (email),
    INDEX idx_users_role (role),
    INDEX idx_users_active (is_active),
    INDEX idx_users_plan (plan),
    INDEX idx_users_created (created_at)
);

-- Create system settings table
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category VARCHAR(50) NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_category_key (category, setting_key),
    INDEX idx_settings_category (category)
);

-- Create audit logs table (system-wide)
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id INT,
    old_values JSON,
    new_values JSON,
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_user_id (user_id),
    INDEX idx_audit_logs_action (action),
    INDEX idx_audit_logs_resource (resource_type),
    INDEX idx_audit_logs_timestamp (timestamp)
);

-- Create system alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    type VARCHAR(50) NOT NULL,
    severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT false,
    is_resolved BOOLEAN DEFAULT false,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_alerts_user (user_id),
    INDEX idx_alerts_type (type),
    INDEX idx_alerts_severity (severity),
    INDEX idx_alerts_read (is_read),
    INDEX idx_alerts_resolved (is_resolved)
);

-- Create user databases tracking table
CREATE TABLE IF NOT EXISTS user_databases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    database_name VARCHAR(100) NOT NULL,
    status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_db (user_id),
    INDEX idx_user_databases_user (user_id),
    INDEX idx_user_databases_status (status)
);

-- Insert default admin user
INSERT INTO users (name, email, password, role, plan, is_active, email_verified) VALUES
('Administrador', 'admin@admin.com', '$2b$12$mAhRRRIVflNGlYHQ4otEsOOU.gk3N476xKlY9ZfUt.KPsWf9nICkS', 'admin', 'enterprise', true, true)
ON DUPLICATE KEY UPDATE
    password = VALUES(password),
    role = 'admin',
    plan = 'enterprise',
    is_active = true,
    email_verified = true;

-- Insert default system settings
INSERT INTO system_settings (category, setting_key, setting_value, description) VALUES
('general', 'site_name', 'Dinâmica', 'Nome do sistema'),
('general', 'site_description', 'Soluções em IA', 'Descrição do sistema'),
('general', 'timezone', 'America/Sao_Paulo', 'Fuso horário padrão'),
('general', 'language', 'pt-BR', 'Idioma padrão'),
('general', 'maintenance_mode', 'false', 'Modo de manutenção'),
('email', 'smtp_host', '', 'Servidor SMTP'),
('email', 'smtp_port', '587', 'Porta SMTP'),
('email', 'smtp_user', '', 'Usuário SMTP'),
('email', 'smtp_password', '', 'Senha SMTP'),
('whatsapp', 'api_url', '', 'URL da API WhatsApp'),
('whatsapp', 'access_token', '', 'Token de acesso WhatsApp'),
('whatsapp', 'webhook_url', '', 'URL do webhook'),
('ai', 'default_provider', 'chatgpt', 'Provedor de IA padrão'),
('ai', 'default_model', 'gpt-3.5-turbo', 'Modelo padrão')
ON DUPLICATE KEY UPDATE
    setting_value = VALUES(setting_value),
    description = VALUES(description);

SELECT 'Main system tables created successfully' as message;