import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { logAuthAction, createAlert } from '../middleware/audit.js';
import twoFactorService from '../services/twoFactorService.js';
import encryptionService from '../services/encryptionService.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { logSecurityEvent, logAuditTrail } = require('../middleware/security.js');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const authController = {
  async register(req, res, next) {
    try {
      const { name, email, password, company, phone, role } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        const error = new Error('Email já está em uso');
        error.status = 400;
        return next(error);
      }

      // Create new user
      const user = await User.create({ name, email, password, company, phone, role });
      const token = generateToken(user.id);

      // Log registro de usuário
      await logAuthAction(
        user.id, 
        'create', 
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent'),
        { email, company, role }
      );

      // Criar alerta de novo usuário
      await createAlert({
        userId: 1, // Admin user
        type: 'user_registration',
        severity: 'info',
        title: 'Novo Usuário Registrado',
        message: `Novo usuário ${name} (${email}) se registrou no sistema`,
        metadata: { userId: user.id, email, company }
      });

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        user,
        token
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const { email, password, twoFactorToken } = req.body;
      const ip = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');

      // Find user by email
      const user = await User.findByEmail(email);
      
      if (!user) {
        await logSecurityEvent(null, 'login_failed', {
          email,
          reason: 'user_not_found',
          ip,
          userAgent
        });
        const error = new Error('Credenciais inválidas');
        error.status = 401;
        return next(error);
      }

      // Verificar se usuário está bloqueado
      if (user.locked_until && new Date() < new Date(user.locked_until)) {
        await logSecurityEvent(user.id, 'login_blocked', {
          reason: 'account_locked',
          locked_until: user.locked_until,
          ip,
          userAgent
        });
        const error = new Error('Conta temporariamente bloqueada');
        error.status = 423;
        return next(error);
      }

      // Validate password
      const isValidPassword = await User.validatePassword(password, user.password);
      
      if (!isValidPassword) {
        // Incrementar tentativas falhadas
        const failedAttempts = (user.failed_login_attempts || 0) + 1;
        let lockUntil = null;
        
        if (failedAttempts >= 5) {
          lockUntil = new Date(Date.now() + (30 * 60 * 1000)); // 30 minutos
        }
        
        await User.update(user.id, {
          failed_login_attempts: failedAttempts,
          locked_until: lockUntil
        });
        
        await logSecurityEvent(user.id, 'login_failed', {
          reason: 'invalid_password',
          failed_attempts: failedAttempts,
          ip,
          userAgent
        });
        
        const error = new Error('Credenciais inválidas');
        error.status = 401;
        return next(error);
      }

      // Verificar 2FA se habilitado
      if (user.two_factor_enabled) {
        if (!twoFactorToken) {
          return res.status(200).json({
            success: true,
            requiresTwoFactor: true,
            message: 'Token de autenticação de dois fatores necessário'
          });
        }
        
        const isValidToken = await twoFactorService.verifyToken(user.id, twoFactorToken);
        if (!isValidToken) {
          await logSecurityEvent(user.id, '2fa_failed', {
            ip,
            userAgent
          });
          const error = new Error('Token de autenticação inválido');
          error.status = 401;
          return next(error);
        }
      }

      // Reset tentativas falhadas
      await User.update(user.id, {
        failed_login_attempts: 0,
        locked_until: null
      });

      // Criar sessão
      const sessionId = encryptionService.generateSecureToken();
      
      // Generate token
      const token = generateToken(user.id);

      // Log login bem-sucedido
      await logAuthAction(
        user.id,
        'login',
        ip,
        userAgent,
        { email, loginTime: new Date().toISOString(), sessionId }
      );

      await logSecurityEvent(user.id, 'login_success', {
        ip,
        userAgent,
        session_id: sessionId
      });

      await logAuditTrail(
        user.id,
        'login',
        'user_session',
        sessionId,
        {},
        { session_created: true },
        ip,
        userAgent
      );

      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        user: {
          ...userWithoutPassword,
          two_factor_enabled: user.two_factor_enabled
        },
        token
      });
    } catch (error) {
      next(error);
    }
  },

  async getProfile(req, res, next) {
    try {
      const user = await User.findById(req.userId);
      if (!user) {
        const error = new Error('Usuário não encontrado');
        error.status = 404;
        return next(error);
      }

      res.json({ 
        success: true,
        user 
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req, res, next) {
    try {
      const { currentPassword, newPassword, confirmPassword, ...profileUpdates } = req.body;
      const userId = req.userId;

      // Se está tentando alterar a senha
      if (newPassword) {
        // Validar se a senha atual foi fornecida
        if (!currentPassword) {
          const error = new Error('Senha atual é obrigatória para alterar a senha');
          error.status = 400;
          return next(error);
        }

        // Validar se as senhas coincidem
        if (newPassword !== confirmPassword) {
          const error = new Error('Nova senha e confirmação não coincidem');
          error.status = 400;
          return next(error);
        }

        // Buscar usuário para validar senha atual
        const user = await User.findById(userId);
        if (!user) {
          const error = new Error('Usuário não encontrado');
          error.status = 404;
          return next(error);
        }

        // Validar senha atual
        const isValidPassword = await User.validatePassword(currentPassword, user.password);
        if (!isValidPassword) {
          const error = new Error('Senha atual incorreta');
          error.status = 400;
          return next(error);
        }

        // Incluir nova senha nas atualizações
        profileUpdates.password = newPassword;

        // Log da alteração de senha
        await logAuthAction(
          userId,
          'password_change',
          req.ip || req.connection.remoteAddress,
          req.get('User-Agent'),
          { changeTime: new Date().toISOString() }
        );
      }

      // Atualizar perfil
      const updatedUser = await User.update(userId, profileUpdates);
      
      if (!updatedUser) {
        const error = new Error('Usuário não encontrado');
        error.status = 404;
        return next(error);
      }

      // Log da atualização de perfil
      await logAuthAction(
        userId,
        'profile_update',
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent'),
        { updatedFields: Object.keys(profileUpdates), updateTime: new Date().toISOString() }
      );

      res.json({
        success: true,
        message: newPassword ? 'Perfil e senha atualizados com sucesso' : 'Perfil atualizado com sucesso',
        user: updatedUser
      });
    } catch (error) {
      next(error);
    }
  },

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.userId;

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        const error = new Error('Usuário não encontrado');
        error.status = 404;
        return next(error);
      }

      // Validate current password
      const isValidPassword = await User.validatePassword(currentPassword, user.password);
      if (!isValidPassword) {
        const error = new Error('Senha atual incorreta');
        error.status = 400;
        return next(error);
      }

      // Update password
      await User.update(userId, { password: newPassword });

      // Log password change
      await logAuthAction(
        userId,
        'password_change',
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent'),
        { changeTime: new Date().toISOString() }
      );

      res.json({
        success: true,
        message: 'Senha alterada com sucesso'
      });
    } catch (error) {
      next(error);
    }
  },

  // Configurar 2FA
  async setup2FA(req, res) {
    try {
      const userId = req.user.id;
      
      // Gerar secret e QR code
      const setup = await twoFactorService.generateSecret(userId);
      
      await logSecurityEvent(userId, '2fa_setup_initiated', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        secret: setup.secret,
        qrCode: setup.qrCode,
        backupCodes: setup.backupCodes
      });
    } catch (error) {
      console.error('Erro ao configurar 2FA:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  // Verificar e ativar 2FA
  async verify2FA(req, res) {
    try {
      const userId = req.user.id;
      const { token } = req.body;
      
      const isValid = await twoFactorService.verifyToken(userId, token);
      
      if (!isValid) {
        return res.status(400).json({
          success: false,
          error: 'Token inválido'
        });
      }
      
      // Ativar 2FA
      await twoFactorService.enable2FA(userId);
      
      await logSecurityEvent(userId, '2fa_enabled', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      await logAuditTrail(
        userId,
        'enable_2fa',
        'user_security',
        userId,
        { two_factor_enabled: false },
        { two_factor_enabled: true },
        req.ip,
        req.get('User-Agent')
      );
      
      res.json({
        success: true,
        message: '2FA ativado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao verificar 2FA:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  // Desativar 2FA
  async disable2FA(req, res) {
    try {
      const userId = req.user.id;
      const { password } = req.body;
      
      // Verificar senha atual
      const user = await User.findById(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }
      
      const isValidPassword = await User.validatePassword(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Senha incorreta'
        });
      }
      
      // Desativar 2FA
      await twoFactorService.disable2FA(userId);
      
      await logSecurityEvent(userId, '2fa_disabled', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      await logAuditTrail(
        userId,
        'disable_2fa',
        'user_security',
        userId,
        { two_factor_enabled: true },
        { two_factor_enabled: false },
        req.ip,
        req.get('User-Agent')
      );
      
      res.json({
        success: true,
        message: '2FA desativado com sucesso'
      });
    } catch (error) {
      console.error('Erro ao desativar 2FA:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  // Gerar novos códigos de backup
  async generateBackupCodes(req, res) {
    try {
      const userId = req.user.id;
      
      const backupCodes = await twoFactorService.generateBackupCodes(userId);
      
      await logSecurityEvent(userId, 'backup_codes_generated', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.json({
        success: true,
        backupCodes
      });
    } catch (error) {
      console.error('Erro ao gerar códigos de backup:', error);
      res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  },

  async logout(req, res, next) {
    try {
      // Log logout action
      await logAuthAction(
        req.userId,
        'logout',
        req.ip || req.connection.remoteAddress,
        req.get('User-Agent'),
        { logoutTime: new Date().toISOString() }
      );

      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error) {
      next(error);
    }
  },

  async refreshToken(req, res, next) {
    try {
      const { token } = req.body;
      
      if (!token) {
        const error = new Error('Token é obrigatório');
        error.status = 400;
        return next(error);
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      
      if (!user) {
        const error = new Error('Usuário não encontrado');
        error.status = 404;
        return next(error);
      }

      // Generate new token
      const newToken = generateToken(user.id);

      res.json({
        success: true,
        token: newToken,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        error.status = 401;
        error.message = 'Token inválido ou expirado';
      }
      next(error);
    }
  }
};

export default authController;