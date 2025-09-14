-- Migração para adicionar campos específicos da barbearia na tabela agents
-- Data: 2025-01-15
-- Descrição: Adiciona campos para configurações WhatsApp e modelo específico da barbearia

-- Adicionar campos para configurações específicas da barbearia
ALTER TABLE agents 
ADD COLUMN IF NOT EXISTS user_id INT,
ADD COLUMN IF NOT EXISTS model_config JSON,
ADD COLUMN IF NOT EXISTS whatsapp_config JSON,
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS metadata JSON;

-- Adicionar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_phone ON agents(phone_number);

-- Adicionar foreign key para user_id (se a tabela users existir)
-- ALTER TABLE agents ADD CONSTRAINT fk_agents_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

SELECT 'Campos da barbearia adicionados com sucesso na tabela agents!' as status;