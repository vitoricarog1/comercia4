import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkAgentBarbearia() {
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

    // Buscar usuário da barbearia
    console.log('\n📋 BUSCANDO USUÁRIO DA BARBEARIA:');
    const [users] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ?',
      ['login@barbearia.com']
    );
    
    if (users.length === 0) {
      console.log('❌ Usuário da barbearia não encontrado');
      return;
    }
    
    const user = users[0];
    console.log(`ID do usuário: ${user.id}`);
    console.log(`Nome: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role}`);

    // Verificar se existe agente com ID 7
    console.log('\n📋 VERIFICANDO AGENTE ID 7:');
    const [agents7] = await connection.execute(
      'SELECT id, name, user_id FROM agents WHERE id = ?',
      [7]
    );
    
    if (agents7.length > 0) {
      const agent7 = agents7[0];
      console.log(`Agente ID 7 existe:`);
      console.log(`  Nome: ${agent7.name}`);
      console.log(`  User ID: ${agent7.user_id}`);
      
      if (agent7.user_id === user.id) {
        console.log('✅ Agente ID 7 pertence ao usuário da barbearia');
      } else {
        console.log('❌ Agente ID 7 NÃO pertence ao usuário da barbearia');
      }
    } else {
      console.log('❌ Agente ID 7 não existe');
    }

    // Verificar todos os agentes do usuário da barbearia
    console.log('\n📋 AGENTES DO USUÁRIO DA BARBEARIA:');
    const [userAgents] = await connection.execute(
      'SELECT id, name, created_at FROM agents WHERE user_id = ?',
      [user.id]
    );
    
    if (userAgents.length === 0) {
      console.log('❌ Usuário da barbearia não possui nenhum agente');
      console.log('\n💡 SOLUÇÃO: Criar um agente para o usuário da barbearia');
    } else {
      console.log(`✅ Usuário possui ${userAgents.length} agente(s):`);
      userAgents.forEach(agent => {
        console.log(`  - ID: ${agent.id}, Nome: ${agent.name}, Criado: ${agent.created_at}`);
      });
      
      console.log('\n💡 SOLUÇÃO: Alterar o agentId no frontend para um dos IDs acima');
    }

    // Verificar tabela conversations
    console.log('\n📋 VERIFICANDO CONVERSAS:');
    const [conversations] = await connection.execute(
      'SELECT COUNT(*) as total FROM conversations WHERE agent_id = ?',
      [7]
    );
    
    console.log(`Total de conversas para agente ID 7: ${conversations[0].total}`);

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAgentBarbearia();