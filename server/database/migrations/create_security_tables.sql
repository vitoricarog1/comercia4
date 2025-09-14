-- Tabela para códigos de backup do 2FA
CREATE TABLE IF NOT EXISTS user_backup_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_backup_codes_user_id (user_id),
  INDEX idx_user_backup_codes_hash (code_hash)
);

-- Tabela para logs de segurança
CREATE TABLE IF NOT EXISTS security_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL,
  event_type VARCHAR(50) NOT NULL,
  metadata JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_security_logs_user_id (user_id),
  INDEX idx_security_logs_event_type (event_type),
  INDEX idx_security_logs_created_at (created_at),
  INDEX idx_security_logs_ip (ip_address)
);

-- Tabela para sessões ativas
CREATE TABLE IF NOT EXISTS user_sessions (
  id VARCHAR(128) PRIMARY KEY,
  user_id INT NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_sessions_user_id (user_id),
  INDEX idx_user_sessions_expires_at (expires_at),
  INDEX idx_user_sessions_active (is_active)
);

-- Tabela para tentativas de login
CREATE TABLE IF NOT EXISTS login_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  user_agent TEXT NULL,
  success BOOLEAN DEFAULT false,
  failure_reason VARCHAR(100) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_attempts_email (email),
  INDEX idx_login_attempts_ip (ip_address),
  INDEX idx_login_attempts_created_at (created_at)
);

-- Tabela para detecção de intrusão
CREATE TABLE IF NOT EXISTS intrusion_attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ip_address VARCHAR(45) NOT NULL,
  attack_type VARCHAR(50) NOT NULL,
  severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  details JSON NULL,
  blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_intrusion_attempts_ip (ip_address),
  INDEX idx_intrusion_attempts_type (attack_type),
  INDEX idx_intrusion_attempts_severity (severity),
  INDEX idx_intrusion_attempts_created_at (created_at)
);

-- Tabela para IPs bloqueados
CREATE TABLE IF NOT EXISTS blocked_ips (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ip_address VARCHAR(45) NOT NULL UNIQUE,
  reason VARCHAR(255) NOT NULL,
  blocked_until TIMESTAMP NULL,
  permanent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_blocked_ips_ip (ip_address),
  INDEX idx_blocked_ips_blocked_until (blocked_until)
);

-- Tabela para audit trails
CREATE TABLE IF NOT EXISTS audit_trails (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(50) NULL,
  old_values JSON NULL,
  new_values JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_trails_user_id (user_id),
  INDEX idx_audit_trails_action (action),
  INDEX idx_audit_trails_resource (resource_type, resource_id),
  INDEX idx_audit_trails_created_at (created_at)
);

-- Tabela para configurações de segurança
CREATE TABLE IF NOT EXISTS security_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSON NOT NULL,
  description TEXT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_security_settings_key (setting_key)
);

-- Adicionar colunas de segurança à tabela users se não existirem
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT NULL,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS lock_reason VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS failed_login_attempts INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_login TIMESTAMP NULL;

-- Inserir configurações padrão de segurança
INSERT IGNORE INTO security_settings (setting_key, setting_value, description) VALUES
('max_login_attempts', '5', 'Número máximo de tentativas de login antes do bloqueio'),
('lockout_duration', '30', 'Duração do bloqueio em minutos após exceder tentativas'),
('session_timeout', '24', 'Timeout da sessão em horas'),
('password_min_length', '8', 'Comprimento mínimo da senha'),
('password_require_special', 'true', 'Exigir caracteres especiais na senha'),
('password_require_numbers', 'true', 'Exigir números na senha'),
('password_require_uppercase', 'true', 'Exigir letras maiúsculas na senha'),
('two_factor_required', 'false', 'Tornar 2FA obrigatório para todos os usuários'),
('intrusion_detection_enabled', 'true', 'Habilitar detecção de intrusão'),
('audit_log_retention_days', '90', 'Dias para manter logs de auditoria');

-- Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_users_two_factor ON users(two_factor_enabled);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login);

-- Trigger para registrar mudanças de senha
DELIMITER //
CREATE TRIGGER IF NOT EXISTS tr_users_password_change
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  IF OLD.password != NEW.password THEN
    SET NEW.password_changed_at = NOW();
    SET NEW.failed_login_attempts = 0;
    SET NEW.last_failed_login = NULL;
  END IF;
END//
DELIMITER ;

-- Procedure para limpeza automática de logs antigos
DELIMITER //
CREATE PROCEDURE IF NOT EXISTS CleanupSecurityLogs()
BEGIN
  DECLARE retention_days INT DEFAULT 90;
  
  -- Buscar configuração de retenção
  SELECT JSON_UNQUOTE(setting_value) INTO retention_days 
  FROM security_settings 
  WHERE setting_key = 'audit_log_retention_days';
  
  -- Limpar logs antigos
  DELETE FROM security_logs 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
  
  DELETE FROM login_attempts 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
  
  DELETE FROM audit_trails 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL retention_days DAY);
  
  -- Limpar tentativas de intrusão antigas (manter apenas 30 dias)
  DELETE FROM intrusion_attempts 
  WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END//
DELIMITER ;

-- Event para executar limpeza automaticamente (diariamente às 2:00)
CREATE EVENT IF NOT EXISTS ev_cleanup_security_logs
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE() + INTERVAL 1 DAY, '02:00:00')
DO
  CALL CleanupSecurityLogs();

-- Habilitar o event scheduler se não estiver habilitado
SET GLOBAL event_scheduler = ON;