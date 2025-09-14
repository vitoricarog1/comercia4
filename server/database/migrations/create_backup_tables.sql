-- Tabela para configurações de backup automático
CREATE TABLE IF NOT EXISTS backup_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    schedule VARCHAR(100) NOT NULL DEFAULT '0 2 * * *', -- Cron expression
    enabled BOOLEAN DEFAULT true,
    max_backups INT DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_config (user_id),
    INDEX idx_user_enabled (user_id, enabled),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para registro de backups
CREATE TABLE IF NOT EXISTS backups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    filename VARCHAR(500) NOT NULL,
    file_path TEXT NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    type ENUM('full', 'incremental', 'database', 'files') DEFAULT 'full',
    status ENUM('pending', 'in_progress', 'completed', 'failed', 'deleted') DEFAULT 'pending',
    error_message TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    INDEX idx_user_created (user_id, created_at),
    INDEX idx_status (status),
    INDEX idx_type (type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela para registro de restaurações
CREATE TABLE IF NOT EXISTS backup_restores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    backup_id INT NULL,
    backup_filename VARCHAR(500) NOT NULL,
    restored_by INT NULL,
    restored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'in_progress', 'completed', 'failed') DEFAULT 'completed',
    error_message TEXT NULL,
    INDEX idx_user_restored (user_id, restored_at),
    INDEX idx_backup_id (backup_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (backup_id) REFERENCES backups(id) ON DELETE SET NULL,
    FOREIGN KEY (restored_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabela para logs de backup
CREATE TABLE IF NOT EXISTS backup_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    backup_id INT NULL,
    action ENUM('backup_start', 'backup_complete', 'backup_failed', 'restore_start', 'restore_complete', 'restore_failed', 'cleanup', 'config_change') NOT NULL,
    message TEXT NOT NULL,
    details JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_action (user_id, action),
    INDEX idx_backup_id (backup_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (backup_id) REFERENCES backups(id) ON DELETE SET NULL
);

-- Tabela para estatísticas de backup
CREATE TABLE IF NOT EXISTS backup_statistics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    date DATE NOT NULL,
    total_backups INT DEFAULT 0,
    successful_backups INT DEFAULT 0,
    failed_backups INT DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    avg_backup_time INT DEFAULT 0, -- em segundos
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_date (user_id, date),
    INDEX idx_user_date (user_id, date),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Inserir configurações padrão para usuários existentes
INSERT IGNORE INTO backup_configs (user_id, schedule, enabled)
SELECT id, '0 2 * * *', true
FROM users;

-- Criar índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_backups_user_status_created ON backups(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_backup_logs_user_created ON backup_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_backup_restores_user_status ON backup_restores(user_id, status);

-- Criar view para estatísticas de backup por usuário
CREATE OR REPLACE VIEW backup_summary AS
SELECT 
    b.user_id,
    COUNT(*) as total_backups,
    SUM(CASE WHEN b.status = 'completed' THEN 1 ELSE 0 END) as successful_backups,
    SUM(CASE WHEN b.status = 'failed' THEN 1 ELSE 0 END) as failed_backups,
    SUM(b.size) as total_size,
    MAX(b.created_at) as last_backup,
    AVG(CASE WHEN b.status = 'completed' THEN TIMESTAMPDIFF(SECOND, b.created_at, b.completed_at) END) as avg_backup_time
FROM backups b
WHERE b.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY b.user_id;

-- Stored procedure para limpeza automática de backups antigos
DELIMITER //
CREATE OR REPLACE PROCEDURE CleanOldBackups()
BEGIN
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_user_id INT;
    DECLARE v_max_backups INT;
    DECLARE user_cursor CURSOR FOR 
        SELECT user_id, max_backups FROM backup_configs WHERE enabled = true;
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = TRUE;

    OPEN user_cursor;
    
    user_loop: LOOP
        FETCH user_cursor INTO v_user_id, v_max_backups;
        IF done THEN
            LEAVE user_loop;
        END IF;
        
        -- Deletar backups antigos para este usuário
        DELETE FROM backups 
        WHERE user_id = v_user_id 
        AND id NOT IN (
            SELECT id FROM (
                SELECT id FROM backups 
                WHERE user_id = v_user_id 
                AND status = 'completed'
                ORDER BY created_at DESC 
                LIMIT v_max_backups
            ) as keep_backups
        )
        AND status = 'completed'
        AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY);
        
        -- Log da limpeza
        INSERT INTO backup_logs (user_id, action, message)
        VALUES (v_user_id, 'cleanup', CONCAT('Limpeza automática executada, mantendo ', v_max_backups, ' backups'));
        
    END LOOP;
    
    CLOSE user_cursor;
END//
DELIMITER ;

-- Criar evento para limpeza automática (executa diariamente às 4:00)
CREATE EVENT IF NOT EXISTS backup_cleanup_event
ON SCHEDULE EVERY 1 DAY
STARTS TIMESTAMP(CURDATE(), '04:00:00')
DO
  CALL CleanOldBackups();

-- Ativar o event scheduler se não estiver ativo
SET GLOBAL event_scheduler = ON;

-- Inserir logs iniciais para o primeiro usuário (se existir)
INSERT INTO backup_logs (user_id, action, message)
SELECT 1, 'config_change', 'Sistema de backup inicializado'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

INSERT INTO backup_logs (user_id, action, message)
SELECT 1, 'config_change', 'Tabelas de backup criadas com sucesso'
WHERE EXISTS (SELECT 1 FROM users WHERE id = 1);

SELECT 'Tabelas de backup criadas com sucesso!' as status;