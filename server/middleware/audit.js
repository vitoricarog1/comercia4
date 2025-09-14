import { mainPool as pool } from '../config/database.js';

// Middleware para auditoria automática
const auditMiddleware = (action, resourceType) => {
  return async (req, res, next) => {
    // Armazenar dados originais para comparação
    const originalSend = res.send;
    const originalJson = res.json;
    
    let responseData = null;
    let oldValues = null;
    
    // Capturar dados antigos para operações de update/delete
    if ((action === 'update' || action === 'delete') && req.params.id) {
      try {
        let query;
        switch (resourceType) {
          case 'user':
            query = 'SELECT * FROM users WHERE id = ?';
            break;
          case 'agent':
            query = 'SELECT * FROM agents WHERE id = ?';
            break;
          case 'conversation':
            query = 'SELECT * FROM conversations WHERE id = ?';
            break;
          default:
            query = null;
        }
        
        if (query) {
          const result = await pool.query(query, [req.params.id]);
          oldValues = result.rows[0] || null;
        }
      } catch (error) {
        console.error('Error fetching old values for audit:', error);
      }
    }
    
    // Interceptar resposta para capturar dados
    res.json = function(data) {
      responseData = data;
      return originalJson.call(this, data);
    };
    
    res.send = function(data) {
      if (typeof data === 'string') {
        try {
          responseData = JSON.parse(data);
        } catch (e) {
          responseData = { message: data };
        }
      } else {
        responseData = data;
      }
      return originalSend.call(this, data);
    };
    
    // Continuar com a execução
    const originalEnd = res.end;
    res.end = async function(chunk, encoding) {
      // Registrar auditoria após resposta bem-sucedida
      if (res.statusCode >= 200 && res.statusCode < 300 && req.userId) {
        try {
          const resourceId = req.params.id || 
                           (responseData && responseData.user && responseData.user.id) ||
                           (responseData && responseData.agent && responseData.agent.id) ||
                           (responseData && responseData.conversation && responseData.conversation.id) ||
                           null;
          
          const newValues = responseData && (responseData.user || responseData.agent || responseData.conversation) || null;
          
          await logAudit({
            userId: req.userId,
            action,
            resourceType,
            resourceId,
            oldValues,
            newValues,
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('User-Agent'),
            metadata: {
              method: req.method,
              url: req.originalUrl,
              body: req.body,
              query: req.query
            }
          });
        } catch (error) {
          console.error('Audit logging error:', error);
        }
      }
      
      return originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

// Função para registrar logs de auditoria
const logAudit = async (auditData) => {
  try {
    const {
      userId,
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      ipAddress,
      userAgent,
      metadata
    } = auditData;
    
    const query = `
      INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, 
        old_values, new_values, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      userId,
      action,
      resourceType,
      resourceId,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent
    ];
    
    await pool.query(query, values);
  } catch (error) {
    console.error('Error inserting audit log:', error);
  }
};

// Função para registrar login/logout
const logAuthAction = async (userId, action, ipAddress, userAgent, metadata = {}) => {
  try {
    await logAudit({
      userId,
      action,
      resourceType: 'session',
      resourceId: userId,
      oldValues: null,
      newValues: { timestamp: new Date().toISOString(), ...metadata },
      ipAddress,
      userAgent,
      metadata
    });
  } catch (error) {
    console.error('Error logging auth action:', error);
  }
};

// Função para criar alertas automáticos
const createAlert = async (alertData) => {
  try {
    const {
      userId,
      agentId,
      type,
      severity = 'info',
      title,
      message,
      metadata = {}
    } = alertData;
    
    const query = `
      INSERT INTO alerts (
        user_id, agent_id, type, severity, title, message, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const values = [
      userId,
      agentId,
      type,
      severity,
      title,
      message,
      JSON.stringify(metadata)
    ];
    
    await pool.query(query, values);
  } catch (error) {
    console.error('Error creating alert:', error);
  }
};

// Middleware para monitoramento de performance
const performanceMonitor = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    // Criar alerta se resposta demorar muito (> 5 segundos)
    if (duration > 5000 && req.userId) {
      await createAlert({
        userId: req.userId,
        type: 'performance',
        severity: 'warning',
        title: 'Resposta Lenta Detectada',
        message: `Endpoint ${req.originalUrl} demorou ${duration}ms para responder`,
        metadata: {
          endpoint: req.originalUrl,
          method: req.method,
          duration,
          statusCode: res.statusCode
        }
      });
    }
  });
  
  next();
};

export {
  auditMiddleware,
  logAudit,
  logAuthAction,
  createAlert,
  performanceMonitor
};