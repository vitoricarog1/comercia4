import { executeMainQuery } from './server/config/database.js';
import bcrypt from 'bcryptjs';

async function createAdmin() {
    try {
        // Verificar se já existe um admin
        const existingAdmin = await executeMainQuery(
            'SELECT id FROM users WHERE role = "admin" LIMIT 1'
        );
        
        if (existingAdmin.length > 0) {
            console.log('Usuário admin já existe!');
            return;
        }
        
        // Criar hash da senha
        const hashedPassword = await bcrypt.hash('admin123', 12);
        
        // Inserir usuário admin
        const result = await executeMainQuery(`
            INSERT INTO users (name, email, password, role, plan, company, phone, is_active, email_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            'Administrador',
            'admin@sistema.com',
            hashedPassword,
            'admin',
            'unlimited',
            'Sistema',
            '(00) 00000-0000',
            1,
            1
        ]);
        
        console.log('Usuário admin criado com sucesso!');
        console.log('Email: admin@sistema.com');
        console.log('Senha: admin123');
        console.log('ID:', result.insertId);
        
    } catch (error) {
        console.error('Erro ao criar admin:', error);
    }
    
    process.exit(0);
}

createAdmin();