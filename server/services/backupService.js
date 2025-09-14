import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import cron from 'node-cron';
import archiver from 'archiver';
import extract from 'extract-zip';
import mysql from 'mysql2/promise';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

class BackupService {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.maxBackups = 30; // Manter 30 backups
    this.scheduledJobs = new Map();
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Configurar backup automático para um usuário
  async setupAutomaticBackup(userId, schedule = '0 2 * * *') { // Default: 2:00 AM diário
    try {
      // Cancelar job existente se houver
      if (this.scheduledJobs.has(userId)) {
        this.scheduledJobs.get(userId).stop();
      }

      // Criar novo job
      const job = cron.schedule(schedule, async () => {
        try {
          await this.createFullBackup(userId);
          console.log(`Backup automático criado para usuário ${userId}`);
        } catch (error) {
          console.error(`Erro no backup automático do usuário ${userId}:`, error);
        }
      }, {
        scheduled: false
      });

      this.scheduledJobs.set(userId, job);
      job.start();

      // Salvar configuração no banco
      await this.saveBackupConfig(userId, schedule);

      return { success: true, message: 'Backup automático configurado' };
    } catch (error) {
      console.error('Erro ao configurar backup automático:', error);
      throw error;
    }
  }

  // Criar backup completo (banco + arquivos)
  async createFullBackup(userId) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup_${userId}_${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      // Criar diretório do backup
      fs.mkdirSync(backupPath, { recursive: true });

      // 1. Backup do banco de dados
      await this.createDatabaseBackup(userId, backupPath);

      // 2. Backup dos arquivos
      await this.createFilesBackup(userId, backupPath);

      // 3. Criar arquivo de metadados
      await this.createMetadataFile(userId, backupPath);

      // 4. Comprimir backup
      const zipPath = await this.compressBackup(backupPath, `${backupName}.zip`);

      // 5. Limpar diretório temporário
      fs.rmSync(backupPath, { recursive: true, force: true });

      // 6. Limpar backups antigos
      await this.cleanOldBackups(userId);

      // 7. Registrar backup no banco
      await this.registerBackup(userId, `${backupName}.zip`, zipPath);

      return {
        success: true,
        backupFile: `${backupName}.zip`,
        path: zipPath,
        size: fs.statSync(zipPath).size
      };
    } catch (error) {
      console.error('Erro ao criar backup:', error);
      throw error;
    }
  }

  // Backup do banco de dados
  async createDatabaseBackup(userId, backupPath) {
    try {
      // Obter o nome do banco específico do usuário
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const [userDb] = await connection.execute(
        'SELECT database_name FROM user_databases WHERE user_id = ? AND status = "active"',
        [userId]
      );

      await connection.end();

      if (!userDb.length) {
        console.log('Usuário não possui banco de dados próprio, fazendo backup dos dados do usuário no banco principal');
        return await this.createUserDataBackup(userId, backupPath);
      }

      const userDatabase = userDb[0].database_name;
      const dumpFile = path.join(backupPath, 'database.sql');
      const mysqldumpPath = 'C:\\xampp\\mysql\\bin\\mysqldump.exe';

      const command = `"${mysqldumpPath}" -h localhost -u root --single-transaction --routines --triggers ${userDatabase} > "${dumpFile}"`;

      await execAsync(command);

      return dumpFile;
    } catch (error) {
      console.error('Erro no backup do banco:', error);
      throw error;
    }
  }

  // Backup dos dados do usuário no banco principal
  async createUserDataBackup(userId, backupPath) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const dumpFile = path.join(backupPath, 'user_data.sql');
      
      // Tabelas que contêm dados do usuário
      const userTables = [
        'users', 'user_sessions', 'user_backup_codes', 'user_limits',
        'ai_requests', 'alerts', 'audit_logs', 'audit_trails',
        'login_attempts', 'security_logs', 'transactions'
      ];

      let sqlContent = '';
      
      for (const table of userTables) {
        try {
          const [rows] = await connection.execute(`SELECT * FROM ${table} WHERE user_id = ?`, [userId]);
          
          if (rows.length > 0) {
            sqlContent += `-- Dados da tabela ${table}\n`;
            sqlContent += `DELETE FROM ${table} WHERE user_id = ${userId};\n`;
            
            for (const row of rows) {
              const columns = Object.keys(row).join(', ');
              const values = Object.values(row).map(v => 
                v === null ? 'NULL' : 
                typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : 
                v
              ).join(', ');
              
              sqlContent += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
            }
            sqlContent += '\n';
          }
        } catch (tableError) {
          console.log(`Tabela ${table} não existe ou erro ao acessar:`, tableError.message);
        }
      }

      await connection.end();
      
      fs.writeFileSync(dumpFile, sqlContent);
      return dumpFile;
    } catch (error) {
      console.error('Erro no backup dos dados do usuário:', error);
      throw error;
    }
  }

  // Backup dos arquivos
  async createFilesBackup(userId, backupPath) {
    try {
      const uploadsDir = path.join(__dirname, '../uploads', userId);
      const filesBackupDir = path.join(backupPath, 'files');

      if (fs.existsSync(uploadsDir)) {
        fs.mkdirSync(filesBackupDir, { recursive: true });
        await this.copyDirectory(uploadsDir, filesBackupDir);
      }

      return filesBackupDir;
    } catch (error) {
      console.error('Erro no backup dos arquivos:', error);
      throw error;
    }
  }

  // Criar arquivo de metadados
  async createMetadataFile(userId, backupPath) {
    const metadata = {
      userId,
      timestamp: new Date().toISOString(),
      version: '1.0',
      type: 'full',
      components: ['database', 'files'],
      created_by: 'system'
    };

    const metadataFile = path.join(backupPath, 'metadata.json');
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

    return metadataFile;
  }

  // Comprimir backup
  async compressBackup(sourcePath, zipName) {
    return new Promise((resolve, reject) => {
      const zipPath = path.join(this.backupDir, zipName);
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve(zipPath));
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  // Restaurar backup
  async restoreBackup(userId, backupFile) {
    try {
      const backupPath = path.join(this.backupDir, backupFile);
      
      if (!fs.existsSync(backupPath)) {
        throw new Error('Arquivo de backup não encontrado');
      }

      const tempDir = path.join(this.backupDir, `temp_restore_${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      // 1. Extrair backup
      await extract(backupPath, { dir: tempDir });

      // 2. Verificar metadados
      const metadataPath = path.join(tempDir, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error('Arquivo de metadados não encontrado');
      }

      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      if (metadata.userId !== userId) {
        throw new Error('Backup não pertence ao usuário especificado');
      }

      // 3. Restaurar banco de dados
      await this.restoreDatabase(userId, path.join(tempDir, 'database.sql'));

      // 4. Restaurar arquivos
      await this.restoreFiles(userId, path.join(tempDir, 'files'));

      // 5. Limpar diretório temporário
      fs.rmSync(tempDir, { recursive: true, force: true });

      // 6. Registrar restauração
      await this.registerRestore(userId, backupFile);

      return { success: true, message: 'Backup restaurado com sucesso' };
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      throw error;
    }
  }

  // Restaurar banco de dados
  async restoreDatabase(userId, sqlFile) {
    try {
      if (!fs.existsSync(sqlFile)) {
        console.log('Arquivo SQL não encontrado, pulando restauração do banco');
        return;
      }

      // Verificar se o usuário tem banco próprio
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const [userDb] = await connection.execute(
        'SELECT database_name FROM user_databases WHERE user_id = ? AND status = "active"',
        [userId]
      );

      if (userDb.length) {
        // Restaurar banco próprio do usuário
        const userDatabase = userDb[0].database_name;
        const mysqlPath = 'C:\\xampp\\mysql\\bin\\mysql.exe';
        const command = `"${mysqlPath}" -h localhost -u root ${userDatabase} < "${sqlFile}"`;
        await execAsync(command);
      } else {
        // Restaurar dados do usuário no banco principal
        const sqlContent = fs.readFileSync(sqlFile, 'utf8');
        const statements = sqlContent.split(';').filter(stmt => stmt.trim());
        
        for (const statement of statements) {
          if (statement.trim()) {
            await connection.execute(statement);
          }
        }
      }

      await connection.end();
    } catch (error) {
      console.error('Erro ao restaurar banco:', error);
      throw error;
    }
  }

  // Restaurar arquivos
  async restoreFiles(userId, filesDir) {
    try {
      if (!fs.existsSync(filesDir)) {
        console.log('Diretório de arquivos não encontrado, pulando restauração de arquivos');
        return;
      }

      const uploadsDir = path.join(__dirname, '../uploads', userId);
      
      // Backup dos arquivos atuais antes de restaurar
      if (fs.existsSync(uploadsDir)) {
        const backupCurrentDir = path.join(uploadsDir, `../${userId}_backup_${Date.now()}`);
        await this.copyDirectory(uploadsDir, backupCurrentDir);
      }

      // Restaurar arquivos
      fs.mkdirSync(uploadsDir, { recursive: true });
      await this.copyDirectory(filesDir, uploadsDir);
    } catch (error) {
      console.error('Erro ao restaurar arquivos:', error);
      throw error;
    }
  }

  // Listar backups disponíveis
  async listBackups(userId) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const [rows] = await connection.execute(
        'SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC',
        [userId]
      );

      await connection.end();

      return rows.map(backup => ({
        id: backup.id,
        filename: backup.filename,
        size: backup.size,
        created_at: backup.created_at,
        type: backup.type,
        status: fs.existsSync(backup.file_path) ? 'available' : 'missing'
      }));
    } catch (error) {
      console.error('Erro ao listar backups:', error);
      throw error;
    }
  }

  // Utilitários
  async copyDirectory(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    fs.mkdirSync(dest, { recursive: true });
    
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      
      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  async cleanOldBackups(userId) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const [rows] = await connection.execute(
        'SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT ?, 1000',
        [userId, this.maxBackups]
      );

      for (const backup of rows) {
        // Deletar arquivo físico
        if (fs.existsSync(backup.file_path)) {
          fs.unlinkSync(backup.file_path);
        }
        
        // Deletar registro do banco
        await connection.execute('DELETE FROM backups WHERE id = ?', [backup.id]);
      }

      await connection.end();
    } catch (error) {
      console.error('Erro ao limpar backups antigos:', error);
    }
  }

  async saveBackupConfig(userId, schedule) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      await connection.execute(
        'INSERT INTO backup_configs (user_id, schedule, enabled) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE schedule = ?, enabled = ?',
        [userId, schedule, true, schedule, true]
      );

      await connection.end();
    } catch (error) {
      console.error('Erro ao salvar configuração de backup:', error);
    }
  }

  async registerBackup(userId, filename, filePath) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const size = fs.statSync(filePath).size;

      await connection.execute(
        'INSERT INTO backups (user_id, filename, file_path, size, type, status) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, filename, filePath, size, 'full', 'completed']
      );

      await connection.end();
    } catch (error) {
      console.error('Erro ao registrar backup:', error);
    }
  }

  async registerRestore(userId, backupFile) {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      await connection.execute(
        'INSERT INTO backup_restores (user_id, backup_filename, restored_at) VALUES (?, ?, NOW())',
        [userId, backupFile]
      );

      await connection.end();
    } catch (error) {
      console.error('Erro ao registrar restauração:', error);
    }
  }

  // Inicializar jobs automáticos
  async initializeScheduledJobs() {
    try {
      const connection = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ai_agents_saas_main'
      });

      const [configs] = await connection.execute(
        'SELECT user_id, schedule FROM backup_configs WHERE enabled = true'
      );

      for (const config of configs) {
        await this.setupAutomaticBackup(config.user_id, config.schedule);
      }

      await connection.end();
      console.log(`${configs.length} jobs de backup automático inicializados`);
    } catch (error) {
      console.error('Erro ao inicializar jobs de backup:', error);
    }
  }
}

export default new BackupService();