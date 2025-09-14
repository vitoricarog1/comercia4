import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function setupBarbeariaTables() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ai_agents_saas_main',
    charset: 'utf8mb4'
  };

  let connection;

  try {
    console.log('🔄 Conectando ao banco de dados...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado ao banco de dados');

    // Criar tabela de agendamentos
    console.log('🔄 Criando tabela de agendamentos...');
    await connection.execute(`
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
        status ENUM('confirmado', 'pendente', 'cancelado', 'concluido') DEFAULT 'pendente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_agendamentos_user (user_id),
        INDEX idx_agendamentos_data (data),
        INDEX idx_agendamentos_status (status)
      )
    `);
    console.log('✅ Tabela agendamentos criada');

    // Criar tabela de agents se não existir
    console.log('🔄 Criando tabela de agents...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS agents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        model VARCHAR(100) DEFAULT 'gemini-pro',
        system_prompt TEXT,
        temperature DECIMAL(3,2) DEFAULT 0.7,
        max_tokens INT DEFAULT 1000,
        is_active BOOLEAN DEFAULT true,
        whatsapp_config JSON,
        model_config JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_agents_user (user_id),
        INDEX idx_agents_active (is_active)
      )
    `);
    console.log('✅ Tabela agents criada');

    // Criar tabela de conversations se não existir
    console.log('🔄 Criando tabela de conversations...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        agent_id INT,
        title VARCHAR(255),
        phone_number VARCHAR(20),
        status ENUM('active', 'archived', 'deleted') DEFAULT 'active',
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        INDEX idx_conversations_user (user_id),
        INDEX idx_conversations_agent (agent_id),
        INDEX idx_conversations_status (status)
      )
    `);
    console.log('✅ Tabela conversations criada');

    // Criar tabela de messages se não existir
    console.log('🔄 Criando tabela de messages...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        agent_id INT,
        content TEXT NOT NULL,
        role ENUM('user', 'assistant', 'system') NOT NULL,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
        INDEX idx_messages_conversation (conversation_id),
        INDEX idx_messages_user (user_id),
        INDEX idx_messages_agent (agent_id)
      )
    `);
    console.log('✅ Tabela messages criada');

    // Criar usuário da barbearia
    console.log('🔄 Criando usuário da barbearia...');
    const bcrypt = (await import('bcryptjs')).default;
    const barbeariaPassword = await bcrypt.hash('barbearia123', 12);
    
    const [existingUser] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['login@barbearia.com']
    );

    let barbeariaUserId;
    if (existingUser.length === 0) {
      const [result] = await connection.execute(`
        INSERT INTO users (name, email, password, role, plan, is_active, email_verified)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['Barbearia Login', 'login@barbearia.com', barbeariaPassword, 'user', 'premium', true, true]);
      barbeariaUserId = result.insertId;
      console.log('✅ Usuário da barbearia criado');
    } else {
      barbeariaUserId = existingUser[0].id;
      console.log('✅ Usuário da barbearia já existe');
    }

    // Criar agente da barbearia
    console.log('🔄 Criando agente da barbearia...');
    const systemPrompt = `Você é um assistente virtual da barbearia especializado em agendamentos.

Horário de funcionamento: 08:00 às 18:00
Serviços disponíveis:
- Corte de Cabelo: R$ 25,00
- Barba: R$ 15,00
- Cabelo + Barba: R$ 35,00

Agendamentos disponíveis a cada 30 minutos.

Sempre seja cordial e profissional. Quando receber uma solicitação de agendamento, colete:
1. Nome do cliente
2. Telefone
3. Serviço desejado
4. Data preferida
5. Horário preferido

Confirme todos os detalhes antes de finalizar o agendamento.`;

    const whatsappConfig = {
      apiKey: '',
      phoneNumber: ''
    };

    const modelConfig = {
      horarioFuncionamento: {
        inicio: '08:00',
        fim: '18:00'
      },
      diasFolga: [],
      intervalos: 30
    };

    await connection.execute(`
      INSERT INTO agents (user_id, name, description, system_prompt, whatsapp_config, model_config)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        system_prompt = VALUES(system_prompt),
        whatsapp_config = VALUES(whatsapp_config),
        model_config = VALUES(model_config)
    `, [
      barbeariaUserId,
      'Agente Barbearia',
      'Agente especializado em agendamentos para barbearia',
      systemPrompt,
      JSON.stringify(whatsappConfig),
      JSON.stringify(modelConfig)
    ]);
    console.log('✅ Agente da barbearia criado/atualizado');

    console.log('\n🎉 Setup das tabelas da barbearia concluído!');
    console.log('📧 Email da barbearia: login@barbearia.com');
    console.log('🔑 Senha da barbearia: barbearia123');
    console.log('\n🚀 Agora o módulo da barbearia está pronto para uso!');

  } catch (error) {
    console.error('❌ Erro no setup das tabelas da barbearia:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupBarbeariaTables();