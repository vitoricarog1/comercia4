-- Migração para criar tabelas específicas da barbearia
-- Data: 2025-01-15
-- Descrição: Cria tabelas para agendamentos, base de conhecimento e configurações da barbearia

-- Tabela de agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    cliente VARCHAR(255) NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    data DATE NOT NULL,
    horario TIME NOT NULL,
    servico ENUM('cabelo', 'barba', 'cabelo_barba') NOT NULL,
    valor DECIMAL(10,2) DEFAULT 0.00,
    pago BOOLEAN DEFAULT false,
    metodo_pagamento ENUM('dinheiro', 'pix', 'cartao', 'pendente') DEFAULT 'pendente',
    observacoes TEXT,
    criado_por_ia BOOLEAN DEFAULT false,
    status ENUM('confirmado', 'pendente', 'cancelado', 'concluido') DEFAULT 'pendente',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_agendamentos_user (user_id),
    INDEX idx_agendamentos_data (data),
    INDEX idx_agendamentos_status (status),
    INDEX idx_agendamentos_data_horario (data, horario),
    INDEX idx_agendamentos_telefone (telefone)
);

-- Tabela de base de conhecimento para RAG
CREATE TABLE IF NOT EXISTS knowledge_base (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'geral',
    tags JSON,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_knowledge_category (category),
    INDEX idx_knowledge_active (is_active),
    FULLTEXT idx_knowledge_content (title, content)
);

-- Atualizar tabela users para incluir role 'barbearia'
ALTER TABLE users MODIFY COLUMN role ENUM('admin', 'user', 'barbearia') DEFAULT 'user';

-- Inserir conhecimento base para a barbearia
INSERT INTO knowledge_base (title, content, category) VALUES
('Horários de Funcionamento', 'A barbearia funciona de segunda a sábado, das 08:00 às 18:00. Domingos fechado.', 'horarios'),
('Serviços e Preços', 'Corte de Cabelo: R$ 25,00. Barba: R$ 15,00. Cabelo + Barba: R$ 35,00. Todos os serviços incluem finalização com produtos de qualidade.', 'servicos'),
('Política de Cancelamento', 'Cancelamentos devem ser feitos com pelo menos 2 horas de antecedência. Cancelamentos de última hora podem ser cobrados.', 'politicas'),
('Formas de Pagamento', 'Aceitamos dinheiro, PIX, cartão de débito e crédito. Pagamento pode ser feito no local ou antecipado via PIX.', 'pagamento'),
('Localização', 'Estamos localizados na Rua das Flores, 123, Centro. Próximo ao shopping e com estacionamento gratuito.', 'localizacao'),
('Produtos Utilizados', 'Utilizamos apenas produtos de alta qualidade das marcas Wahl, Andis e QOD Barber Shop.', 'produtos')
ON DUPLICATE KEY UPDATE content = VALUES(content);

SELECT 'Tabelas da barbearia criadas com sucesso!' as status;