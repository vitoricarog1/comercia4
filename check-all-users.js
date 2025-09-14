import { executeMainQuery } from './server/config/database.js';

async function checkAllUsers() {
    try {
        // Verificar todos os usuários
        const allUsers = await executeMainQuery(
            'SELECT id, name, email, role, is_active FROM users ORDER BY id'
        );
        
        console.log('Todos os usuários no banco:');
        console.log(allUsers);
        
        // Verificar especificamente usuários admin
        const adminUsers = await executeMainQuery(
            'SELECT id, name, email, role, is_active FROM users WHERE role = "admin"'
        );
        
        console.log('\nUsuários com role admin:');
        console.log(adminUsers);
        
    } catch (error) {
        console.error('Erro ao verificar usuários:', error);
    }
    
    process.exit(0);
}

checkAllUsers();