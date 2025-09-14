import nodemailer from 'nodemailer';
import schedule from 'node-schedule';
import admin from 'firebase-admin';
import twilio from 'twilio';
import { executeMainQuery } from '../config/database.js';
import { promisify } from 'util';

// Use executeMainQuery as db
const db = { query: executeMainQuery };

class NotificationService {
    constructor() {
        this.emailTransporter = null;
        this.twilioClient = null;
        this.firebaseApp = null;
        this.scheduledJobs = new Map();
        this.initializeServices();
    }

    async initializeServices() {
        try {
            // Inicializar transporter de email
            this.emailTransporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST || 'smtp.gmail.com',
                port: process.env.SMTP_PORT || 587,
                secure: false,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });

            // Inicializar Twilio para SMS
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                this.twilioClient = twilio(
                    process.env.TWILIO_ACCOUNT_SID,
                    process.env.TWILIO_AUTH_TOKEN
                );
            }

            // Inicializar Firebase para push notifications
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }

            console.log('Notification services initialized successfully');
        } catch (error) {
            console.error('Error initializing notification services:', error);
        }
    }

    // Criar nova notificação
    async createNotification(userId, typeId, title, message, data = null, priority = 'medium', scheduledAt = null) {
        try {
            const query = `
                INSERT INTO notifications (user_id, notification_type_id, title, message, data, priority, scheduled_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const result = await db.query(query, [
                userId, typeId, title, message, 
                data ? JSON.stringify(data) : null, 
                priority, scheduledAt
            ]);

            const notificationId = result.insertId;

            // Se não é agendada, processar imediatamente
            if (!scheduledAt) {
                await this.processNotification(notificationId);
            } else {
                // Agendar para processamento futuro
                this.scheduleNotification(notificationId, new Date(scheduledAt));
            }

            return notificationId;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error;
        }
    }

    // Processar notificação (determinar canais e enviar)
    async processNotification(notificationId) {
        try {
            // Buscar dados da notificação
            const notificationQuery = `
                SELECT n.*, nt.name as type_name, u.email, u.phone
                FROM notifications n
                JOIN notification_types nt ON n.notification_type_id = nt.id
                JOIN users u ON n.user_id = u.id
                WHERE n.id = ?
            `;
            
            const notifications = await db.query(notificationQuery, [notificationId]);
            if (notifications.length === 0) return;

            const notification = notifications[0];

            // Buscar configurações do usuário
            const settingsQuery = `
                SELECT * FROM notification_settings WHERE user_id = ?
            `;
            const settings = await db.query(settingsQuery, [notification.user_id]);
            const userSettings = settings[0] || {};

            // Buscar preferências específicas do tipo
            const preferencesQuery = `
                SELECT * FROM notification_preferences 
                WHERE user_id = ? AND notification_type_id = ?
            `;
            const preferences = await db.query(preferencesQuery, [
                notification.user_id, notification.notification_type_id
            ]);
            const typePreferences = preferences[0] || {};

            // Verificar se está no horário de silêncio
            if (this.isQuietHours(userSettings)) {
                // Reagendar para após o horário de silêncio
                const nextSendTime = this.getNextSendTime(userSettings);
                await this.rescheduleNotification(notificationId, nextSendTime);
                return;
            }

            // Determinar canais ativos
            const channels = [];
            
            if (this.shouldSendEmail(userSettings, typePreferences)) {
                channels.push('email');
            }
            
            if (this.shouldSendPush(userSettings, typePreferences)) {
                channels.push('push');
            }
            
            if (this.shouldSendSMS(userSettings, typePreferences)) {
                channels.push('sms');
            }

            // Sempre enviar notificação in-app
            channels.push('in_app');

            // Enviar por cada canal
            for (const channel of channels) {
                await this.sendNotification(notification, channel);
            }

            // Atualizar status da notificação
            await db.query(
                'UPDATE notifications SET status = "sent", sent_at = NOW() WHERE id = ?',
                [notificationId]
            );

        } catch (error) {
            console.error('Error processing notification:', error);
            await db.query(
                'UPDATE notifications SET status = "failed" WHERE id = ?',
                [notificationId]
            );
        }
    }

    // Enviar notificação por canal específico
    async sendNotification(notification, channel) {
        try {
            let recipient, status = 'pending';

            switch (channel) {
                case 'email':
                    recipient = notification.email;
                    status = await this.sendEmail(notification);
                    break;
                    
                case 'push':
                    recipient = 'push_devices';
                    status = await this.sendPushNotification(notification);
                    break;
                    
                case 'sms':
                    recipient = notification.phone;
                    status = await this.sendSMS(notification);
                    break;
                    
                case 'in_app':
                    recipient = notification.user_id.toString();
                    status = await this.sendInAppNotification(notification);
                    break;
            }

            // Registrar entrega
            await db.query(`
                INSERT INTO notification_deliveries 
                (notification_id, channel, recipient, status, attempts, last_attempt_at)
                VALUES (?, ?, ?, ?, 1, NOW())
            `, [notification.id, channel, recipient, status]);

        } catch (error) {
            console.error(`Error sending ${channel} notification:`, error);
            
            // Registrar falha
            await db.query(`
                INSERT INTO notification_deliveries 
                (notification_id, channel, recipient, status, attempts, last_attempt_at, error_message)
                VALUES (?, ?, ?, 'failed', 1, NOW(), ?)
            `, [notification.id, channel, recipient || 'unknown', error.message]);
        }
    }

    // Enviar email
    async sendEmail(notification) {
        if (!this.emailTransporter) return 'failed';

        try {
            // Buscar template
            const template = await this.getTemplate(notification.notification_type_id, 'email');
            
            const mailOptions = {
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to: notification.email,
                subject: template.subject || notification.title,
                text: template.body || notification.message,
                html: template.html_body || `<p>${notification.message}</p>`
            };

            // Substituir variáveis no template
            if (notification.data) {
                const data = JSON.parse(notification.data);
                mailOptions.subject = this.replaceVariables(mailOptions.subject, data);
                mailOptions.text = this.replaceVariables(mailOptions.text, data);
                mailOptions.html = this.replaceVariables(mailOptions.html, data);
            }

            await this.emailTransporter.sendMail(mailOptions);
            return 'sent';
        } catch (error) {
            console.error('Email sending error:', error);
            return 'failed';
        }
    }

    // Enviar push notification
    async sendPushNotification(notification) {
        if (!this.firebaseApp) return 'failed';

        try {
            // Buscar dispositivos do usuário
            const devices = await db.query(
                'SELECT device_token FROM push_devices WHERE user_id = ? AND is_active = TRUE',
                [notification.user_id]
            );

            if (devices.length === 0) return 'failed';

            const template = await this.getTemplate(notification.notification_type_id, 'push');
            
            const message = {
                notification: {
                    title: template.subject || notification.title,
                    body: template.body || notification.message
                },
                data: notification.data ? JSON.parse(notification.data) : {},
                tokens: devices.map(d => d.device_token)
            };

            const response = await admin.messaging().sendMulticast(message);
            
            // Processar respostas e desativar tokens inválidos
            for (let i = 0; i < response.responses.length; i++) {
                if (!response.responses[i].success) {
                    const error = response.responses[i].error;
                    if (error.code === 'messaging/registration-token-not-registered') {
                        await db.query(
                            'UPDATE push_devices SET is_active = FALSE WHERE device_token = ?',
                            [devices[i].device_token]
                        );
                    }
                }
            }

            return response.successCount > 0 ? 'sent' : 'failed';
        } catch (error) {
            console.error('Push notification error:', error);
            return 'failed';
        }
    }

    // Enviar SMS
    async sendSMS(notification) {
        if (!this.twilioClient || !notification.phone) return 'failed';

        try {
            const template = await this.getTemplate(notification.notification_type_id, 'sms');
            const message = template.body || notification.message;

            await this.twilioClient.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: notification.phone
            });

            return 'sent';
        } catch (error) {
            console.error('SMS sending error:', error);
            return 'failed';
        }
    }

    // Enviar notificação in-app (via Socket.IO)
    async sendInAppNotification(notification) {
        try {
            // Assumindo que temos acesso ao socket.io instance
            if (global.io) {
                global.io.to(`user_${notification.user_id}`).emit('notification', {
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
                    priority: notification.priority,
                    type: notification.type_name,
                    data: notification.data ? JSON.parse(notification.data) : null,
                    created_at: notification.created_at
                });
            }
            return 'sent';
        } catch (error) {
            console.error('In-app notification error:', error);
            return 'failed';
        }
    }

    // Buscar template
    async getTemplate(typeId, channel, language = 'pt-BR') {
        try {
            const templates = await db.query(`
                SELECT * FROM notification_templates 
                WHERE notification_type_id = ? AND channel = ? AND language = ? AND is_active = TRUE
            `, [typeId, channel, language]);

            return templates[0] || { subject: '', body: '', html_body: '' };
        } catch (error) {
            console.error('Error fetching template:', error);
            return { subject: '', body: '', html_body: '' };
        }
    }

    // Substituir variáveis no template
    replaceVariables(text, data) {
        if (!text || !data) return text;
        
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    // Verificar se deve enviar email
    shouldSendEmail(settings, preferences) {
        const globalEnabled = settings.email_enabled !== false;
        const typeEnabled = preferences.email_enabled !== false;
        return globalEnabled && typeEnabled;
    }

    // Verificar se deve enviar push
    shouldSendPush(settings, preferences) {
        const globalEnabled = settings.push_enabled !== false;
        const typeEnabled = preferences.push_enabled !== false;
        return globalEnabled && typeEnabled;
    }

    // Verificar se deve enviar SMS
    shouldSendSMS(settings, preferences) {
        const globalEnabled = settings.sms_enabled === true;
        const typeEnabled = preferences.sms_enabled === true;
        return globalEnabled && typeEnabled;
    }

    // Verificar horário de silêncio
    isQuietHours(settings) {
        if (!settings.quiet_hours_start || !settings.quiet_hours_end) return false;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const startTime = this.timeToMinutes(settings.quiet_hours_start);
        const endTime = this.timeToMinutes(settings.quiet_hours_end);
        
        if (startTime <= endTime) {
            return currentTime >= startTime && currentTime <= endTime;
        } else {
            return currentTime >= startTime || currentTime <= endTime;
        }
    }

    // Converter tempo para minutos
    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    // Obter próximo horário de envio
    getNextSendTime(settings) {
        const now = new Date();
        const endTime = settings.quiet_hours_end || '08:00:00';
        const [hours, minutes] = endTime.split(':').map(Number);
        
        const nextSend = new Date(now);
        nextSend.setHours(hours, minutes, 0, 0);
        
        if (nextSend <= now) {
            nextSend.setDate(nextSend.getDate() + 1);
        }
        
        return nextSend;
    }

    // Reagendar notificação
    async rescheduleNotification(notificationId, scheduledAt) {
        await db.query(
            'UPDATE notifications SET scheduled_at = ? WHERE id = ?',
            [scheduledAt, notificationId]
        );
        
        this.scheduleNotification(notificationId, scheduledAt);
    }

    // Agendar notificação
    scheduleNotification(notificationId, scheduledAt) {
        const job = schedule.scheduleJob(scheduledAt, async () => {
            await this.processNotification(notificationId);
            this.scheduledJobs.delete(notificationId);
        });
        
        this.scheduledJobs.set(notificationId, job);
    }

    // Inicializar agendamentos pendentes
    async initializeScheduledNotifications() {
        try {
            const notifications = await db.query(`
                SELECT id, scheduled_at FROM notifications 
                WHERE status = 'pending' AND scheduled_at > NOW()
            `) || [];

            for (const notification of notifications) {
                this.scheduleNotification(notification.id, new Date(notification.scheduled_at));
            }

            console.log(`Initialized ${notifications.length} scheduled notifications`);
        } catch (error) {
            console.error('Error initializing scheduled notifications:', error);
        }
    }

    // Marcar notificação como lida
    async markAsRead(notificationId, userId) {
        try {
            await db.query(`
                UPDATE notifications 
                SET status = 'read', read_at = NOW() 
                WHERE id = ? AND user_id = ?
            `, [notificationId, userId]);
            
            return true;
        } catch (error) {
            console.error('Error marking notification as read:', error);
            return false;
        }
    }

    // Buscar notificações do usuário
    async getUserNotifications(userId, limit = 50, offset = 0, unreadOnly = false) {
        try {
            let query = `
                SELECT n.*, nt.name as type_name, nt.category
                FROM notifications n
                JOIN notification_types nt ON n.notification_type_id = nt.id
                WHERE n.user_id = ?
            `;
            
            const params = [userId];
            
            if (unreadOnly) {
                query += ' AND n.status != "read"';
            }
            
            query += ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);
            
            const notifications = await db.query(query, params);
            return notifications;
        } catch (error) {
            console.error('Error fetching user notifications:', error);
            return [];
        }
    }

    // Registrar dispositivo para push notifications
    async registerPushDevice(userId, deviceToken, deviceType, deviceInfo = {}) {
        try {
            await db.query(`
                INSERT INTO push_devices 
                (user_id, device_token, device_type, device_name, app_version, os_version, last_used_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                device_name = VALUES(device_name),
                app_version = VALUES(app_version),
                os_version = VALUES(os_version),
                is_active = TRUE,
                last_used_at = NOW()
            `, [
                userId, deviceToken, deviceType,
                deviceInfo.deviceName || null,
                deviceInfo.appVersion || null,
                deviceInfo.osVersion || null
            ]);
            
            return true;
        } catch (error) {
            console.error('Error registering push device:', error);
            return false;
        }
    }

    // Atualizar configurações de notificação
    async updateNotificationSettings(userId, settings) {
        try {
            const fields = [];
            const values = [];
            
            const allowedFields = [
                'email_enabled', 'push_enabled', 'sms_enabled',
                'email_frequency', 'push_frequency',
                'quiet_hours_start', 'quiet_hours_end', 'timezone'
            ];
            
            for (const field of allowedFields) {
                if (settings.hasOwnProperty(field)) {
                    fields.push(`${field} = ?`);
                    values.push(settings[field]);
                }
            }
            
            if (fields.length === 0) return false;
            
            values.push(userId);
            
            await db.query(`
                INSERT INTO notification_settings (user_id, ${allowedFields.join(', ')})
                VALUES (?, ${allowedFields.map(() => '?').join(', ')})
                ON DUPLICATE KEY UPDATE ${fields.join(', ')}
            `, [userId, ...Object.values(settings)]);
            
            return true;
        } catch (error) {
            console.error('Error updating notification settings:', error);
            return false;
        }
    }
}

// Instância singleton
const notificationService = new NotificationService();

// Métodos de conveniência para tipos específicos
notificationService.sendWelcomeNotification = async (userId) => {
    const typeQuery = 'SELECT id FROM notification_types WHERE name = "welcome"';
    const types = await db.query(typeQuery);
    if (types.length === 0) return;
    
    return notificationService.createNotification(
        userId, types[0].id,
        'Bem-vindo ao IA Agents!',
        'Sua conta foi criada com sucesso. Explore todas as funcionalidades disponíveis.',
        { username: 'Usuário' }
    );
};

notificationService.sendLoginAlert = async (userId, loginData) => {
    const typeQuery = 'SELECT id FROM notification_types WHERE name = "login_alert"';
    const types = await db.query(typeQuery);
    if (types.length === 0) return;
    
    return notificationService.createNotification(
        userId, types[0].id,
        'Novo login detectado',
        `Um novo login foi detectado em sua conta a partir de ${loginData.ip || 'IP desconhecido'}.`,
        loginData,
        'high'
    );
};

notificationService.sendBackupNotification = async (userId, success, details) => {
    const typeName = success ? 'backup_completed' : 'backup_failed';
    const typeQuery = 'SELECT id FROM notification_types WHERE name = ?';
    const types = await db.query(typeQuery, [typeName]);
    if (types.length === 0) return;
    
    const title = success ? 'Backup concluído' : 'Falha no backup';
    const message = success 
        ? 'Seu backup foi concluído com sucesso.'
        : 'Ocorreu um erro durante o backup. Verifique as configurações.';
    
    return notificationService.createNotification(
        userId, types[0].id, title, message, details,
        success ? 'low' : 'high'
    );
};

export default notificationService;