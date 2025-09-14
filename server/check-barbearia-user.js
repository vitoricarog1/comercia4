import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function checkBarbeariaUser() {
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

    // Verificar usuário da barbearia
    const [users] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ?',
      ['login@barbearia.com']
    );

    if (users.length === 0) {
      console.log('❌ Usuário da barbearia não encontrado');
      return;
    }

    const user = users[0];
    console.log('\n📋 DADOS DO USUÁRIO DA BARBEARIA:');
    console.log(`ID: ${user.id}`);
    console.log(`Nome: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: ${user.role || 'NULL/VAZIO'}`);

    // Se o role estiver vazio, vamos atualizá-lo
    if (!user.role || user.role === '' || user.role === 'user') {
      console.log('\n🔄 Atualizando role para "barbearia"...');
      await connection.execute(
        'UPDATE users SET role = ? WHERE id = ?',
        ['barbearia', user.id]
      );
      console.log('✅ Role atualizado com sucesso!');
      
      // Verificar novamente
      const [updatedUsers] = await connection.execute(
        'SELECT id, name, email, role FROM users WHERE email = ?',
        ['login@barbearia.com']
      );
      
      const updatedUser = updatedUsers[0];
      console.log('\n📋 DADOS ATUALIZADOS:');
      console.log(`Role: ${updatedUser.role}`);
    } else {
      console.log('\n✅ Role já está correto!');
    }

  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkBarbeariaUser();