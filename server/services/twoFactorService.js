import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { executeMainQuery, executeUserQuery } from '../config/database.js';

class TwoFactorService {
  constructor() {
    this.appName = process.env.APP_NAME || 'IA Agents SaaS';
  }

  // Gerar secret para 2FA
  generateSecret(userEmail) {
    const secret = speakeasy.generateSecret({
      name: userEmail,
      issuer: this.appName,
      length: 32
    });

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
      qrCodeUrl: null // Será gerado separadamente
    };
  }

  // Gerar QR Code para configuração
  async generateQRCode(otpauthUrl) {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return qrCodeDataUrl;
    } catch (error) {
      throw new Error('Erro ao gerar QR Code: ' + error.message);
    }
  }

  // Verificar token 2FA
  verifyToken(secret, token) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Permite tokens de até 2 períodos antes/depois
    });
  }

  // Habilitar 2FA para usuário
  async enableTwoFactor(userId, secret, token) {
    try {
      // Verificar se o token está correto
      if (!this.verifyToken(secret, token)) {
        throw new Error('Token inválido');
      }

      // Criptografar o secret antes de salvar
      const encryptedSecret = this.encryptSecret(secret);

      // Salvar no banco de dados
      await executeMainQuery(
        'UPDATE users SET two_factor_secret = ?, two_factor_enabled = true, updated_at = NOW() WHERE id = ?',
        [encryptedSecret, userId]
      );

      // Gerar códigos de backup
      const backupCodes = this.generateBackupCodes();
      await this.saveBackupCodes(userId, backupCodes);

      return {
        success: true,
        backupCodes: backupCodes
      };
    } catch (error) {
      throw new Error('Erro ao habilitar 2FA: ' + error.message);
    }
  }

  // Desabilitar 2FA
  async disableTwoFactor(userId, password) {
    try {
      // Verificar senha do usuário
      const [user] = await executeMainQuery(
        'SELECT password FROM users WHERE id = ?',
        [userId]
      );

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      // Aqui você verificaria a senha (assumindo que tem um método para isso)
      // const isValidPassword = await bcrypt.compare(password, user.password);
      // if (!isValidPassword) {
      //   throw new Error('Senha incorreta');
      // }

      // Desabilitar 2FA
      await executeMainQuery(
        'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = false, updated_at = NOW() WHERE id = ?',
        [userId]
      );

      // Remover códigos de backup
      await executeMainQuery(
        'DELETE FROM user_backup_codes WHERE user_id = ?',
        [userId]
      );

      return { success: true };
    } catch (error) {
      throw new Error('Erro ao desabilitar 2FA: ' + error.message);
    }
  }

  // Verificar 2FA durante login
  async verifyTwoFactorLogin(userId, token) {
    try {
      const [user] = await executeMainQuery(
        'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ?',
        [userId]
      );

      if (!user || !user.two_factor_enabled) {
        return { success: false, message: '2FA não habilitado' };
      }

      // Descriptografar secret
      const secret = this.decryptSecret(user.two_factor_secret);

      // Verificar token
      const isValid = this.verifyToken(secret, token);

      if (isValid) {
        // Registrar login bem-sucedido
        await this.logSecurityEvent(userId, 'two_factor_success', {
          ip: null, // Será passado pelo controller
          userAgent: null
        });

        return { success: true };
      }

      // Verificar se é um código de backup
      const isBackupCode = await this.verifyBackupCode(userId, token);
      if (isBackupCode) {
        return { success: true, usedBackupCode: true };
      }

      // Registrar tentativa falhada
      await this.logSecurityEvent(userId, 'two_factor_failed', {
        ip: null,
        userAgent: null
      });

      return { success: false, message: 'Token inválido' };
    } catch (error) {
      throw new Error('Erro ao verificar 2FA: ' + error.message);
    }
  }

  // Gerar códigos de backup
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }
    return codes;
  }

  // Salvar códigos de backup
  async saveBackupCodes(userId, codes) {
    try {
      // Remover códigos antigos
      await executeMainQuery(
        'DELETE FROM user_backup_codes WHERE user_id = ?',
        [userId]
      );

      // Inserir novos códigos
      for (const code of codes) {
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
        await executeMainQuery(
          'INSERT INTO user_backup_codes (user_id, code_hash, created_at) VALUES (?, ?, NOW())',
          [userId, hashedCode]
        );
      }
    } catch (error) {
      throw new Error('Erro ao salvar códigos de backup: ' + error.message);
    }
  }

  // Verificar código de backup
  async verifyBackupCode(userId, code) {
    try {
      const hashedCode = crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
      
      const [backupCode] = await executeMainQuery(
        'SELECT id FROM user_backup_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL',
        [userId, hashedCode]
      );

      if (backupCode) {
        // Marcar código como usado
        await executeMainQuery(
          'UPDATE user_backup_codes SET used_at = NOW() WHERE id = ?',
          [backupCode.id]
        );

        // Registrar uso do código de backup
        await this.logSecurityEvent(userId, 'backup_code_used', {
          codeId: backupCode.id
        });

        return true;
      }

      return false;
    } catch (error) {
      throw new Error('Erro ao verificar código de backup: ' + error.message);
    }
  }

  // Criptografar secret
  encryptSecret(secret) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('2fa-secret'));
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Descriptografar secret
  decryptSecret(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    
    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('2fa-secret'));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Registrar evento de segurança
  async logSecurityEvent(userId, eventType, metadata = {}) {
    try {
      await executeMainQuery(
        'INSERT INTO security_logs (user_id, event_type, metadata, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [
          userId,
          eventType,
          JSON.stringify(metadata),
          metadata.ip || null,
          metadata.userAgent || null
        ]
      );
    } catch (error) {
      console.error('Erro ao registrar evento de segurança:', error);
    }
  }

  // Verificar tentativas de login suspeitas
  async checkSuspiciousActivity(userId, ip) {
    try {
      // Verificar tentativas falhadas nas últimas 24 horas
      const [failedAttempts] = await executeMainQuery(`
        SELECT COUNT(*) as count 
        FROM security_logs 
        WHERE user_id = ? 
        AND event_type IN ('login_failed', 'two_factor_failed') 
        AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `, [userId]);

      // Verificar tentativas de IPs diferentes
      const [ipAttempts] = await executeMainQuery(`
        SELECT COUNT(DISTINCT ip_address) as count 
        FROM security_logs 
        WHERE user_id = ? 
        AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
        AND ip_address IS NOT NULL
      `, [userId]);

      const isSuspicious = failedAttempts.count > 5 || ipAttempts.count > 3;

      if (isSuspicious) {
        await this.logSecurityEvent(userId, 'suspicious_activity_detected', {
          failedAttempts: failedAttempts.count,
          ipAttempts: ipAttempts.count,
          ip
        });
      }

      return {
        isSuspicious,
        failedAttempts: failedAttempts.count,
        ipAttempts: ipAttempts.count
      };
    } catch (error) {
      console.error('Erro ao verificar atividade suspeita:', error);
      return { isSuspicious: false };
    }
  }

  // Bloquear usuário temporariamente
  async temporaryLockUser(userId, reason, duration = 30) {
    try {
      const unlockAt = new Date(Date.now() + (duration * 60 * 1000));
      
      await executeMainQuery(
        'UPDATE users SET locked_until = ?, lock_reason = ?, updated_at = NOW() WHERE id = ?',
        [unlockAt, reason, userId]
      );

      await this.logSecurityEvent(userId, 'user_locked', {
        reason,
        duration,
        unlockAt: unlockAt.toISOString()
      });

      return { success: true, unlockAt };
    } catch (error) {
      throw new Error('Erro ao bloquear usuário: ' + error.message);
    }
  }

  // Verificar se usuário está bloqueado
  async isUserLocked(userId) {
    try {
      const [user] = await executeMainQuery(
        'SELECT locked_until, lock_reason FROM users WHERE id = ?',
        [userId]
      );

      if (!user || !user.locked_until) {
        return { isLocked: false };
      }

      const now = new Date();
      const unlockTime = new Date(user.locked_until);

      if (now < unlockTime) {
        return {
          isLocked: true,
          reason: user.lock_reason,
          unlockAt: unlockTime
        };
      }

      // Desbloquear automaticamente se o tempo passou
      await executeMainQuery(
        'UPDATE users SET locked_until = NULL, lock_reason = NULL WHERE id = ?',
        [userId]
      );

      return { isLocked: false };
    } catch (error) {
      console.error('Erro ao verificar bloqueio:', error);
      return { isLocked: false };
    }
  }
}

export default new TwoFactorService();