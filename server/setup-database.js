import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    charset: 'utf8mb4'
  };

  let connection;

  try {
    console.log('🔄 Conectando ao MySQL...');
    connection = await mysql.createConnection(config);
    console.log('✅ Conectado ao MySQL');

    // Criar banco principal
    const dbName = process.env.DB_NAME || 'ai_agents_saas_main';
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`✅ Database ${dbName} criado/verificado`);

    // Conectar ao banco criado
    await connection.changeUser({ database: dbName });

    // Criar tabelas principais
    console.log('🔄 Criando tabelas principais...');

    // Tabela de usuários
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'user') DEFAULT 'user',
        plan ENUM('free', 'basic', 'premium', 'enterprise') DEFAULT 'free',
        company VARCHAR(255),
        phone VARCHAR(20),
        avatar VARCHAR(500),
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_users_email (email),
        INDEX idx_users_role (role),
        INDEX idx_users_active (is_active)
      )
    `);

    // Tabela de bancos de usuários
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS user_databases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        database_name VARCHAR(100) NOT NULL,
        status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_db (user_id),
        INDEX idx_user_databases_user (user_id)
      )
    `);

    // Tabela de logs de auditoria
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(100),
        resource_id INT,
        old_values JSON,
        new_values JSON,
        details TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_audit_logs_user_id (user_id),
        INDEX idx_audit_logs_action (action),
        INDEX idx_audit_logs_timestamp (timestamp)
      )
    `);

    // Tabela de alertas
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        type VARCHAR(50) NOT NULL,
        severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
        title VARCHAR(255) NOT NULL,
        message TEXT,
        is_read BOOLEAN DEFAULT false,
        is_resolved BOOLEAN DEFAULT false,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_alerts_user (user_id),
        INDEX idx_alerts_type (type),
        INDEX idx_alerts_severity (severity)
      )
    `);

    // Criar usuário administrador
    const bcrypt = (await import('bcryptjs')).default;
    const adminPassword = await bcrypt.hash('admin123', 12);
    
    await connection.execute(`
      INSERT INTO users (name, email, password, role, plan, is_active, email_verified)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        password = VALUES(password),
        role = 'admin',
        is_active = true,
        email_verified = true
    `, ['Administrador', 'admin@admin.com', adminPassword, 'admin', 'enterprise', true, true]);

    console.log('✅ Usuário administrador criado/atualizado');
    console.log('📧 Email: admin@admin.com');
    console.log('🔑 Senha: admin123');

    console.log('\n🎉 Setup do banco de dados concluído com sucesso!');
    console.log('🚀 Agora você pode iniciar o servidor com: npm run server:dev');

  } catch (error) {
    console.error('❌ Erro no setup:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupDatabase();