-- Tabela de sessões de pagamento
CREATE TABLE IF NOT EXISTS payment_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  provider ENUM('stripe', 'paypal', 'pix') NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'expired') DEFAULT 'pending',
  amount DECIMAL(10,2) NOT NULL,
  pix_code TEXT NULL,
  expires_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_session_id (session_id),
  INDEX idx_status (status)
);

-- Tabela de transações
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  provider ENUM('stripe', 'paypal', 'pix') NOT NULL,
  transaction_id VARCHAR(255) NOT NULL,
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Tabela de limites por usuário
CREATE TABLE IF NOT EXISTS user_limits (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL UNIQUE,
  max_agents INT DEFAULT 3,
  max_conversations INT DEFAULT 1000,
  max_whatsapp_sessions INT DEFAULT 1,
  max_ai_requests INT DEFAULT 5000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de requisições de IA (para controle de limites)
CREATE TABLE IF NOT EXISTS ai_requests (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  agent_id VARCHAR(36) NULL,
  conversation_id VARCHAR(36) NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  tokens_used INT DEFAULT 0,
  cost DECIMAL(10,6) DEFAULT 0.00,
  response_time DECIMAL(8,3) DEFAULT 0.000,
  status ENUM('success', 'error', 'timeout') DEFAULT 'success',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
);

-- Adicionar colunas de assinatura na tabela users (se não existirem)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS subscription_status ENUM('active', 'inactive', 'cancelled', 'expired') DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS subscription_expires_at DATETIME NULL,
ADD COLUMN IF NOT EXISTS subscription_started_at DATETIME NULL;

-- Inserir limites padrão para usuários existentes
INSERT IGNORE INTO user_limits (id, user_id, max_agents, max_conversations, max_whatsapp_sessions, max_ai_requests)
SELECT 
  UUID() as id,
  id as user_id,
  3 as max_agents,
  1000 as max_conversations,
  1 as max_whatsapp_sessions,
  5000 as max_ai_requests
FROM users 
WHERE id NOT IN (SELECT user_id FROM user_limits);

-- Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status, subscription_expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_expires ON payment_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_requests_user_date ON ai_requests(user_id, created_at);

-- Trigger para limpar sessões expiradas
DELIMITER //
CREATE EVENT IF NOT EXISTS cleanup_expired_payment_sessions
ON SCHEDULE EVERY 1 HOUR
DO
BEGIN
  UPDATE payment_sessions 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
END//
DELIMITER ;

-- Ativar o event scheduler
SET GLOBAL event_scheduler = ON;