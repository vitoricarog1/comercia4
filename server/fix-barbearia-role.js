import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function fixBarbeariaRole() {
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

    // Verificar estrutura da tabela users
    console.log('\n📋 VERIFICANDO ESTRUTURA DA TABELA USERS:');
    const [columns] = await connection.execute('DESCRIBE users');
    columns.forEach(col => {
      if (col.Field === 'role') {
        console.log(`Campo role: ${col.Field} - Tipo: ${col.Type} - Null: ${col.Null} - Default: ${col.Default}`);
      }
    });

    // Verificar usuário atual
    console.log('\n📋 DADOS ATUAIS DO USUÁRIO:');
    const [currentUsers] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ?',
      ['login@barbearia.com']
    );
    
    if (currentUsers.length === 0) {
      console.log('❌ Usuário não encontrado');
      return;
    }
    
    const user = currentUsers[0];
    console.log(`ID: ${user.id}`);
    console.log(`Nome: ${user.name}`);
    console.log(`Email: ${user.email}`);
    console.log(`Role: '${user.role}' (length: ${user.role ? user.role.length : 0})`);

    // Forçar atualização do role
    console.log('\n🔄 FORÇANDO ATUALIZAÇÃO DO ROLE...');
    const [updateResult] = await connection.execute(
      'UPDATE users SET role = ? WHERE email = ?',
      ['barbearia', 'login@barbearia.com']
    );
    
    console.log(`Linhas afetadas: ${updateResult.affectedRows}`);
    
    // Verificar novamente
    console.log('\n📋 DADOS APÓS ATUALIZAÇÃO:');
    const [updatedUsers] = await connection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ?',
      ['login@barbearia.com']
    );
    
    const updatedUser = updatedUsers[0];
    console.log(`ID: ${updatedUser.id}`);
    console.log(`Nome: ${updatedUser.name}`);
    console.log(`Email: ${updatedUser.email}`);
    console.log(`Role: '${updatedUser.role}' (length: ${updatedUser.role ? updatedUser.role.length : 0})`);
    
    if (updatedUser.role === 'barbearia') {
      console.log('\n✅ ROLE ATUALIZADO COM SUCESSO!');
      console.log('🎉 O usuário agora será redirecionado para /barbearia');
    } else {
      console.log('\n❌ FALHA NA ATUALIZAÇÃO DO ROLE');
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

fixBarbeariaRole();