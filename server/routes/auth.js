import express from 'express';
import { validateLogin, validateRegister } from '../middleware/validation.js';
import authController from '../controllers/authController.js';
import { authMiddleware } from '../middleware/auth.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { auditLog } = require('../middleware/security.js');

const router = express.Router();

// Rotas de autenticação
router.post('/register', validateRegister, auditLog('register', 'user'), authController.register);
router.post('/login', validateLogin, auditLog('login', 'user_session'), authController.login);
router.post('/logout', auditLog('logout', 'user_session'), authController.logout);
router.post('/refresh', authController.refreshToken);
router.get('/me', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, auditLog('update_profile', 'user'), authController.updateProfile);

// Rotas de 2FA
router.post('/2fa/setup', authMiddleware, auditLog('setup_2fa', 'user_security'), authController.setup2FA);
router.post('/2fa/verify', authMiddleware, auditLog('verify_2fa', 'user_security'), authController.verify2FA);
router.post('/2fa/disable', authMiddleware, auditLog('disable_2fa', 'user_security'), authController.disable2FA);
router.post('/2fa/backup-codes', authMiddleware, auditLog('generate_backup_codes', 'user_security'), authController.generateBackupCodes);

export default router;