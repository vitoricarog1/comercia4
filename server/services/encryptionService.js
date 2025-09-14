import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { executeMainQuery } from '../config/database.js';

// Configurações de criptografia
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_ROUNDS = 12;

// Chave mestra (em produção, deve vir de variável de ambiente)
const MASTER_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(KEY_LENGTH).toString('hex');

class EncryptionService {
  constructor() {
    this.masterKey = Buffer.from(MASTER_KEY, 'hex');
  }

  // Gerar chave derivada para tenant específico
  generateTenantKey(tenantId) {
    const salt = crypto.createHash('sha256').update(tenantId.toString()).digest();
    return crypto.pbkdf2Sync(this.masterKey, salt, 100000, KEY_LENGTH, 'sha256');
  }

  // Criptografar dados
  encrypt(data, tenantId = null) {
    try {
      const key = tenantId ? this.generateTenantKey(tenantId) : this.masterKey;
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipher(ALGORITHM, key);
      cipher.setAAD(Buffer.from('additional-data'));
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      console.error('Erro na criptografia:', error);
      throw new Error('Falha na criptografia dos dados');
    }
  }

  // Descriptografar dados
  decrypt(encryptedData, tenantId = null) {
    try {
      const key = tenantId ? this.generateTenantKey(tenantId) : this.masterKey;
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');
      
      const decipher = crypto.createDecipher(ALGORITHM, key);
      decipher.setAAD(Buffer.from('additional-data'));
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Erro na descriptografia:', error);
      throw new Error('Falha na descriptografia dos dados');
    }
  }

  // Hash de senha com salt
  async hashPassword(password) {
    try {
      return await bcrypt.hash(password, SALT_ROUNDS);
    } catch (error) {
      console.error('Erro no hash da senha:', error);
      throw new Error('Falha no processamento da senha');
    }
  }

  // Verificar senha
  async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      console.error('Erro na verificação da senha:', error);
      return false;
    }
  }

  // Gerar token seguro
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Gerar hash SHA-256
  generateHash(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Criptografar campo específico no banco
  async encryptField(tableName, fieldName, value, whereClause, whereParams, tenantId = null) {
    try {
      const encrypted = this.encrypt(value, tenantId);
      const encryptedValue = JSON.stringify(encrypted);
      
      await executeMainQuery(
        `UPDATE ${tableName} SET ${fieldName} = ? WHERE ${whereClause}`,
        [encryptedValue, ...whereParams]
      );
      
      return true;
    } catch (error) {
      console.error('Erro ao criptografar campo:', error);
      return false;
    }
  }

  // Descriptografar campo específico do banco
  async decryptField(encryptedValue, tenantId = null) {
    try {
      if (!encryptedValue) return null;
      
      const encryptedData = JSON.parse(encryptedValue);
      return this.decrypt(encryptedData, tenantId);
    } catch (error) {
      console.error('Erro ao descriptografar campo:', error);
      return null;
    }
  }

  // Criptografar dados sensíveis do usuário
  async encryptUserSensitiveData(userId, data) {
    try {
      const user = await executeMainQuery(
        'SELECT tenant_id FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user.length) {
        throw new Error('Usuário não encontrado');
      }
      
      const tenantId = user[0].tenant_id;
      return this.encrypt(data, tenantId);
    } catch (error) {
      console.error('Erro ao criptografar dados do usuário:', error);
      throw error;
    }
  }

  // Descriptografar dados sensíveis do usuário
  async decryptUserSensitiveData(userId, encryptedData) {
    try {
      const user = await executeMainQuery(
        'SELECT tenant_id FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user.length) {
        throw new Error('Usuário não encontrado');
      }
      
      const tenantId = user[0].tenant_id;
      return this.decrypt(encryptedData, tenantId);
    } catch (error) {
      console.error('Erro ao descriptografar dados do usuário:', error);
      throw error;
    }
  }

  // Criptografar mensagens de conversas
  async encryptConversationMessage(conversationId, message) {
    try {
      // Buscar tenant_id da conversa
      const conversation = await executeMainQuery(
        'SELECT tenant_id FROM conversations WHERE id = ?',
        [conversationId]
      );
      
      if (!conversation.length) {
        throw new Error('Conversa não encontrada');
      }
      
      const tenantId = conversation[0].tenant_id;
      return this.encrypt(message, tenantId);
    } catch (error) {
      console.error('Erro ao criptografar mensagem:', error);
      throw error;
    }
  }

  // Descriptografar mensagens de conversas
  async decryptConversationMessage(conversationId, encryptedMessage) {
    try {
      // Buscar tenant_id da conversa
      const conversation = await executeMainQuery(
        'SELECT tenant_id FROM conversations WHERE id = ?',
        [conversationId]
      );
      
      if (!conversation.length) {
        throw new Error('Conversa não encontrada');
      }
      
      const tenantId = conversation[0].tenant_id;
      return this.decrypt(encryptedMessage, tenantId);
    } catch (error) {
      console.error('Erro ao descriptografar mensagem:', error);
      throw error;
    }
  }

  // Gerar chave de API criptografada
  async generateEncryptedApiKey(userId) {
    try {
      const apiKey = this.generateSecureToken(64);
      const hashedKey = this.generateHash(apiKey);
      
      // Criptografar a chave para armazenamento
      const encryptedKey = await this.encryptUserSensitiveData(userId, apiKey);
      
      return {
        apiKey, // Para retornar ao usuário (apenas uma vez)
        hashedKey, // Para armazenar no banco
        encryptedKey // Para backup seguro
      };
    } catch (error) {
      console.error('Erro ao gerar chave de API:', error);
      throw error;
    }
  }

  // Verificar chave de API
  verifyApiKey(providedKey, storedHash) {
    try {
      const providedHash = this.generateHash(providedKey);
      return crypto.timingSafeEqual(
        Buffer.from(providedHash, 'hex'),
        Buffer.from(storedHash, 'hex')
      );
    } catch (error) {
      console.error('Erro ao verificar chave de API:', error);
      return false;
    }
  }

  // Criptografar configurações sensíveis
  async encryptSettings(tenantId, settings) {
    try {
      const sensitiveFields = [
        'smtp_password',
        'api_keys',
        'webhook_secrets',
        'database_credentials',
        'third_party_tokens'
      ];
      
      const encryptedSettings = { ...settings };
      
      for (const field of sensitiveFields) {
        if (settings[field]) {
          encryptedSettings[field] = this.encrypt(settings[field], tenantId);
        }
      }
      
      return encryptedSettings;
    } catch (error) {
      console.error('Erro ao criptografar configurações:', error);
      throw error;
    }
  }

  // Descriptografar configurações sensíveis
  async decryptSettings(tenantId, encryptedSettings) {
    try {
      const sensitiveFields = [
        'smtp_password',
        'api_keys',
        'webhook_secrets',
        'database_credentials',
        'third_party_tokens'
      ];
      
      const decryptedSettings = { ...encryptedSettings };
      
      for (const field of sensitiveFields) {
        if (encryptedSettings[field] && typeof encryptedSettings[field] === 'object') {
          decryptedSettings[field] = this.decrypt(encryptedSettings[field], tenantId);
        }
      }
      
      return decryptedSettings;
    } catch (error) {
      console.error('Erro ao descriptografar configurações:', error);
      throw error;
    }
  }

  // Rotacionar chaves de criptografia
  async rotateEncryptionKeys(tenantId) {
    try {
      // Esta função deve ser implementada com cuidado em produção
      // Requer descriptografar todos os dados com a chave antiga
      // e re-criptografar com a nova chave
      
      console.log(`Iniciando rotação de chaves para tenant ${tenantId}`);
      
      // 1. Gerar nova chave
      const newKey = crypto.randomBytes(KEY_LENGTH);
      
      // 2. Buscar todos os dados criptografados do tenant
      const tables = [
        { table: 'users', fields: ['encrypted_data'] },
        { table: 'conversations', fields: ['encrypted_messages'] },
        { table: 'settings', fields: ['encrypted_config'] }
      ];
      
      for (const tableInfo of tables) {
        for (const field of tableInfo.fields) {
          // Buscar registros criptografados
          const records = await executeMainQuery(
            `SELECT id, ${field} FROM ${tableInfo.table} WHERE tenant_id = ? AND ${field} IS NOT NULL`,
            [tenantId]
          );
          
          for (const record of records) {
            try {
              // Descriptografar com chave antiga
              const decrypted = this.decrypt(JSON.parse(record[field]), tenantId);
              
              // Re-criptografar com nova chave (simulado)
              const reencrypted = this.encrypt(decrypted, tenantId);
              
              // Atualizar no banco
              await executeMainQuery(
                `UPDATE ${tableInfo.table} SET ${field} = ? WHERE id = ?`,
                [JSON.stringify(reencrypted), record.id]
              );
            } catch (error) {
              console.error(`Erro ao rotacionar chave para registro ${record.id}:`, error);
            }
          }
        }
      }
      
      console.log(`Rotação de chaves concluída para tenant ${tenantId}`);
      return true;
    } catch (error) {
      console.error('Erro na rotação de chaves:', error);
      throw error;
    }
  }

  // Validar integridade dos dados criptografados
  async validateDataIntegrity(tenantId) {
    try {
      let totalRecords = 0;
      let validRecords = 0;
      let invalidRecords = [];
      
      const tables = [
        { table: 'users', fields: ['encrypted_data'] },
        { table: 'conversations', fields: ['encrypted_messages'] },
        { table: 'settings', fields: ['encrypted_config'] }
      ];
      
      for (const tableInfo of tables) {
        for (const field of tableInfo.fields) {
          const records = await executeMainQuery(
            `SELECT id, ${field} FROM ${tableInfo.table} WHERE tenant_id = ? AND ${field} IS NOT NULL`,
            [tenantId]
          );
          
          for (const record of records) {
            totalRecords++;
            
            try {
              const encryptedData = JSON.parse(record[field]);
              this.decrypt(encryptedData, tenantId);
              validRecords++;
            } catch (error) {
              invalidRecords.push({
                table: tableInfo.table,
                field,
                id: record.id,
                error: error.message
              });
            }
          }
        }
      }
      
      return {
        totalRecords,
        validRecords,
        invalidRecords,
        integrityPercentage: totalRecords > 0 ? (validRecords / totalRecords) * 100 : 100
      };
    } catch (error) {
      console.error('Erro na validação de integridade:', error);
      throw error;
    }
  }
}

// Instância singleton
const encryptionService = new EncryptionService();

export default encryptionService;