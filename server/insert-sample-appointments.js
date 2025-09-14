import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function insertSampleAppointments() {
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

    // Buscar o ID do usuário da barbearia
    const [users] = await connection.execute(
      'SELECT id FROM users WHERE email = ?',
      ['login@barbearia.com']
    );

    if (users.length === 0) {
      console.log('❌ Usuário da barbearia não encontrado');
      return;
    }

    const userId = users[0].id;
    console.log(`✅ Usuário da barbearia encontrado: ID ${userId}`);

    // Inserir agendamentos de exemplo
    const hoje = new Date().toISOString().split('T')[0];
    
    const agendamentos = [
      {
        cliente: 'João Silva',
        telefone: '11999999999',
        email: 'joao@email.com',
        data: hoje,
        horario: '09:00:00',
        servico: 'cabelo',
        valor: 25.00,
        pago: false,
        metodo_pagamento: 'pendente',
        observacoes: 'Cliente preferencial',
        status: 'confirmado'
      },
      {
        cliente: 'Maria Santos',
        telefone: '11888888888',
        email: 'maria@email.com',
        data: hoje,
        horario: '14:30:00',
        servico: 'cabelo_barba',
        valor: 35.00,
        pago: true,
        metodo_pagamento: 'pix',
        observacoes: 'Corte moderno',
        status: 'confirmado'
      },
      {
        cliente: 'Pedro Costa',
        telefone: '11777777777',
        data: hoje,
        horario: '16:00:00',
        servico: 'barba',
        valor: 15.00,
        pago: false,
        metodo_pagamento: 'dinheiro',
        status: 'pendente'
      }
    ];

    console.log('🔄 Inserindo agendamentos de exemplo...');
    
    for (const agendamento of agendamentos) {
      await connection.execute(`
        INSERT INTO agendamentos (
          user_id, cliente, telefone, email, data, horario, servico, 
          valor, pago, metodo_pagamento, observacoes, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        agendamento.cliente,
        agendamento.telefone,
        agendamento.email || null,
        agendamento.data,
        agendamento.horario,
        agendamento.servico,
        agendamento.valor,
        agendamento.pago,
        agendamento.metodo_pagamento,
        agendamento.observacoes || null,
        agendamento.status
      ]);
      
      console.log(`✅ Agendamento criado: ${agendamento.cliente} - ${agendamento.horario}`);
    }

    console.log('\n🎉 Agendamentos de exemplo inseridos com sucesso!');
    console.log('📅 Agora o módulo da barbearia mostrará os agendamentos!');
    console.log('🚀 Acesse o sistema com login@barbearia.com para ver os dados!');

  } catch (error) {
    console.error('❌ Erro ao inserir agendamentos:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

insertSampleAppointments();