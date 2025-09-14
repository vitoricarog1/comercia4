import { executeMainQuery } from './server/config/database.js';

async function checkAdmin() {
    try {
        const result = await executeMainQuery(
            'SELECT id, name, email, role, is_active FROM users WHERE email = ?',
            ['admin@sistema.com']
        );
        
        console.log('Resultado da busca:', result);
        
        if (result.length > 0) {
            console.log('Usuário admin encontrado:', result[0]);
        } else {
            console.log('Usuário admin NÃO encontrado!');
        }
        
    } catch (error) {
        console.error('Erro ao verificar admin:', error);
    }
    
    process.exit(0);
}

checkAdmin();