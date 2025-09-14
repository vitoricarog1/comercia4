import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function updateRoleEnum() {
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

    // Verificar estrutura atual
    console.log('\n📋 ESTRUTURA ATUAL DO CAMPO ROLE:');
    const [columns] = await connection.execute('DESCRIBE users');
    const roleColumn = columns.find(col => col.Field === 'role');
    console.log(`Tipo atual: ${roleColumn.Type}`);

    // Alterar o ENUM para incluir 'barbearia'
    console.log('\n🔄 ALTERANDO ENUM PARA INCLUIR "barbearia"...');
    await connection.execute(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin', 'user', 'barbearia') DEFAULT 'user'
    `);
    console.log('✅ ENUM alterado com sucesso!');

    // Verificar nova estrutura
    console.log('\n📋 NOVA ESTRUTURA DO CAMPO ROLE:');
    const [newColumns] = await connection.execute('DESCRIBE users');
    const newRoleColumn = newColumns.find(col => col.Field === 'role');
    console.log(`Novo tipo: ${newRoleColumn.Type}`);

    // Agora atualizar o usuário da barbearia
    console.log('\n🔄 ATUALIZANDO USUÁRIO DA BARBEARIA...');
    const [updateResult] = await connection.execute(
      'UPDATE users SET role = ? WHERE email = ?',
      ['barbearia', 'login@barbearia.com']
    );
    
    console.log(`Linhas afetadas: ${updateResult.affectedRows}`);
    
    // Verificar resultado final
    console.log('\n📋 VERIFICAÇÃO FINAL:');
    const [finalUsers] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ?',
      ['login@barbearia.com']
    );
    
    const finalUser = finalUsers[0];
    console.log(`ID: ${finalUser.id}`);
    console.log(`Nome: ${finalUser.name}`);
    console.log(`Email: ${finalUser.email}`);
    console.log(`Role: '${finalUser.role}'`);
    
    if (finalUser.role === 'barbearia') {
      console.log('\n🎉 SUCESSO! USUÁRIO DA BARBEARIA CONFIGURADO!');
      console.log('✅ Agora o login redirecionará para /barbearia');
    } else {
      console.log('\n❌ Ainda há problema com o role');
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

updateRoleEnum();