import { body, validationResult } from 'express-validator';
import { executeMainQuery } from '../config/database.js';
import twoFactorService from '../services/twoFactorService.js';

// Rate limiting removido - sem limitação de requisições

// Middleware de detecção de intrusão
const intrusionDetection = async (req, res, next) => {
  try {
    const ip = req.ip;
    const userAgent = req.get('User-Agent') || '';
    const path = req.path;
    const method = req.method;
    
    // Verificar se IP está bloqueado
    const isBlocked = await checkBlockedIP(ip);
    if (isBlocked.blocked) {
      await logIntrusionAttempt(ip, 'blocked_ip_access', 'high', {
        path,
        method,
        userAgent,
        reason: isBlocked.reason
      });
      
      return res.status(403).json({
        success: false,
        error: 'Acesso negado'
      });
    }
    
    // Detectar padrões suspeitos
    const suspiciousPatterns = [
      // SQL Injection
      /('|(\-\-)|(;)|(\||\|)|(\*|\*))/i,
      // XSS
      /(<script[^>]*>.*?<\/script>)|(<iframe)|(<object)|(<embed)/i,
      // Path traversal
      /(\.\.[\/\\])|(\.\.\.)/,
      // Command injection
      /(;\s*(rm|del|format|shutdown|reboot))/i
    ];
    
    const requestData = JSON.stringify({
      query: req.query,
      body: req.body,
      params: req.params
    });
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData) || pattern.test(path)) {
        await logIntrusionAttempt(ip, 'malicious_payload', 'high', {
          path,
          method,
          userAgent,
          payload: requestData.substring(0, 500)
        });
        
        // Bloquear IP temporariamente após múltiplas tentativas
        await handleSuspiciousActivity(ip, 'malicious_payload');
        
        return res.status(400).json({
          success: false,
          error: 'Requisição inválida'
        });
      }
    }
    
    // Detectar user agents suspeitos
    const suspiciousUserAgents = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scanner/i,
      /nikto/i,
      /sqlmap/i,
      /nmap/i
    ];
    
    const isSuspiciousUA = suspiciousUserAgents.some(pattern => pattern.test(userAgent));
    if (isSuspiciousUA && !path.includes('/api/')) {
      await logIntrusionAttempt(ip, 'suspicious_user_agent', 'medium', {
        path,
        method,
        userAgent
      });
    }
    
    // Detectar tentativas de acesso a endpoints sensíveis
    const sensitiveEndpoints = [
      '/admin',
      '/api/admin',
      '/config',
      '/backup',
      '/database'
    ];
    
    const isSensitiveAccess = sensitiveEndpoints.some(endpoint => path.startsWith(endpoint));
    if (isSensitiveAccess && !req.user) {
      await logIntrusionAttempt(ip, 'unauthorized_sensitive_access', 'high', {
        path,
        method,
        userAgent
      });
    }
    
    next();
  } catch (error) {
    console.error('Erro na detecção de intrusão:', error);
    next();
  }
};

// Middleware de validação de entrada
const sanitizeInput = (req, res, next) => {
  // Sanitizar strings recursivamente
  const sanitizeObject = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .trim();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const key in obj) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
      return sanitized;
    }
    
    return obj;
  };
  
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }
  
  next();
};

// Validadores de entrada
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }
    next();
  }
];

const validateRegistration = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Nome deve ter entre 2 e 100 caracteres'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Dados inválidos',
        details: errors.array()
      });
    }
    next();
  }
];

// Middleware de auditoria
const auditLog = (action, resourceType) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Registrar ação após resposta
      setImmediate(async () => {
        try {
          await logAuditTrail(
            req.user?.id || null,
            action,
            resourceType,
            req.params.id || null,
            req.body,
            JSON.parse(data || '{}'),
            req.ip,
            req.get('User-Agent')
          );
        } catch (error) {
          console.error('Erro ao registrar audit log:', error);
        }
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Funções auxiliares
const checkBlockedIP = async (ip) => {
  try {
    const [blocked] = await executeMainQuery(
      'SELECT reason, blocked_until, permanent FROM blocked_ips WHERE ip_address = ? AND (permanent = true OR blocked_until > NOW())',
      [ip]
    );
    
    return {
      blocked: !!blocked,
      reason: blocked?.reason || null,
      until: blocked?.blocked_until || null,
      permanent: blocked?.permanent || false
    };
  } catch (error) {
    console.error('Erro ao verificar IP bloqueado:', error);
    return { blocked: false };
  }
};

const logIntrusionAttempt = async (ip, attackType, severity, details) => {
  try {
    await executeMainQuery(
      'INSERT INTO intrusion_attempts (ip_address, attack_type, severity, details, created_at) VALUES (?, ?, ?, ?, NOW())',
      [ip, attackType, severity, JSON.stringify(details)]
    );
  } catch (error) {
    console.error('Erro ao registrar tentativa de intrusão:', error);
  }
};

const logSecurityEvent = async (userId, eventType, metadata) => {
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
};

const logAuditTrail = async (userId, action, resourceType, resourceId, oldValues, newValues, ip, userAgent) => {
  try {
    await executeMainQuery(
      'INSERT INTO audit_trails (user_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      [
        userId,
        action,
        resourceType,
        resourceId,
        JSON.stringify(oldValues),
        JSON.stringify(newValues),
        ip,
        userAgent
      ]
    );
  } catch (error) {
    console.error('Erro ao registrar audit trail:', error);
  }
};

const handleSuspiciousActivity = async (ip, activityType) => {
  try {
    // Contar tentativas nas últimas 24 horas
    const [attempts] = await executeMainQuery(
      'SELECT COUNT(*) as count FROM intrusion_attempts WHERE ip_address = ? AND attack_type = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
      [ip, activityType]
    );
    
    // Bloquear após 3 tentativas
    if (attempts.count >= 3) {
      const blockUntil = new Date(Date.now() + (24 * 60 * 60 * 1000)); // 24 horas
      
      await executeMainQuery(
        'INSERT INTO blocked_ips (ip_address, reason, blocked_until, created_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE blocked_until = VALUES(blocked_until), reason = VALUES(reason)',
        [ip, `Múltiplas tentativas de ${activityType}`, blockUntil]
      );
      
      await logSecurityEvent(null, 'ip_blocked', {
        ip,
        reason: `Múltiplas tentativas de ${activityType}`,
        blockUntil: blockUntil.toISOString()
      });
    }
  } catch (error) {
    console.error('Erro ao lidar com atividade suspeita:', error);
  }
};

// Middleware de verificação de sessão
const sessionSecurity = async (req, res, next) => {
  try {
    if (req.user && req.sessionID) {
      // Verificar se a sessão ainda é válida
      const [session] = await executeMainQuery(
        'SELECT expires_at, ip_address FROM user_sessions WHERE id = ? AND user_id = ? AND is_active = true',
        [req.sessionID, req.user.id]
      );
      
      if (!session) {
        return res.status(401).json({
          success: false,
          error: 'Sessão inválida'
        });
      }
      
      // Verificar se a sessão expirou
      if (session.expires_at && new Date() > new Date(session.expires_at)) {
        await executeMainQuery(
          'UPDATE user_sessions SET is_active = false WHERE id = ?',
          [req.sessionID]
        );
        
        return res.status(401).json({
          success: false,
          error: 'Sessão expirada'
        });
      }
      
      // Verificar mudança de IP (opcional)
      if (session.ip_address && session.ip_address !== req.ip) {
        await logSecurityEvent(req.user.id, 'ip_change_detected', {
          oldIp: session.ip_address,
          newIp: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      // Atualizar última atividade
      await executeMainQuery(
        'UPDATE user_sessions SET last_activity = NOW() WHERE id = ?',
        [req.sessionID]
      );
    }
    
    next();
  } catch (error) {
    console.error('Erro na verificação de sessão:', error);
    next();
  }
};

export {
  intrusionDetection,
  sanitizeInput,
  validateLogin,
  validateRegistration,
  auditLog,
  sessionSecurity,
  logSecurityEvent,
  logAuditTrail
};