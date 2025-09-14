// Admin Panel JavaScript
console.log('Admin.js carregado com sucesso');
const API_BASE_URL = 'http://localhost:3001/api';
let authToken = null;
let socket = null;
console.log('Variáveis inicializadas:', { API_BASE_URL, authToken, socket });

// Initialize Socket.IO connection
function initializeSocket() {
    if (socket) {
        socket.disconnect();
    }
    
    socket = io('http://localhost:3001', {
        auth: {
            token: authToken
        },
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('🔌 Connected to server via Socket.IO');
    });
    
    socket.on('disconnect', () => {
        console.log('🔌 Disconnected from server');
    });
    
    // Listen for real-time events
    socket.on('agent-status-changed', (data) => {
        console.log('Agent status changed:', data);
        refreshCurrentTab();
    });
    
    socket.on('whatsapp-message-received', (data) => {
        console.log('New WhatsApp message:', data);
        refreshCurrentTab();
    });
    
    socket.on('conversation-transferred', (data) => {
        console.log('Conversation transferred:', data);
        refreshCurrentTab();
    });
    
    socket.on('agent-created', (data) => {
        console.log('New agent created:', data);
        refreshCurrentTab();
    });
    
    socket.on('conversation-created', (data) => {
        console.log('New conversation created:', data);
        refreshCurrentTab();
    });
    
    socket.on('conversation-updated', (data) => {
        console.log('Conversation updated:', data);
        refreshCurrentTab();
    });
    
    socket.on('message-received', (data) => {
        console.log('New message received:', data);
        refreshCurrentTab();
    });
}

// Refresh current active tab
function refreshCurrentTab() {
    const activeTab = document.querySelector('.tab-button.active');
    if (activeTab) {
        const tabName = activeTab.id.replace('tab-', '');
        showTab(tabName);
    }
}

// Check if admin is already logged in
function checkAdminAuth() {
    console.log('Verificando autenticação admin...');
    const token = localStorage.getItem('admin_token');
    console.log('Token encontrado:', token);
    
    // Clear any invalid tokens
    if (token && (token === 'null' || token === 'undefined' || token.length < 10)) {
        console.log('Token inválido encontrado, removendo...');
        localStorage.removeItem('admin_token');
        showLoginForm();
        return;
    }
    
    if (token) {
        console.log('Token válido, mostrando dashboard...');
        authToken = token;
        // Validate token with server before showing dashboard
        validateTokenAndShowDashboard();
    } else {
        console.log('Nenhum token encontrado, mostrando formulário de login...');
        showLoginForm();
    }
}

// Validate token with server
async function validateTokenAndShowDashboard() {
    if (!authToken) {
        console.log('Nenhum token encontrado, mostrando formulário de login...');
        showLoginForm();
        return;
    }
    
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/validate`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            console.log('Token válido, inicializando dashboard...');
            initializeSocket();
            showDashboard();
            loadDashboardData();
        } else {
            console.log('Token inválido, removendo e mostrando login...');
            localStorage.removeItem('admin_token');
            authToken = null;
            showLoginForm();
        }
    } catch (error) {
        console.error('Erro ao validar token:', error);
        console.log('Erro na validação, removendo token e mostrando login...');
        localStorage.removeItem('admin_token');
        authToken = null;
        showLoginForm();
    }
}

// Show login form
function showLoginForm() {
    console.log('Mostrando formulário de login...');
    const loginForm = document.getElementById('login-form');
    const dashboard = document.getElementById('dashboard');
    const header = document.querySelector('header');
    
    if (loginForm) {
        loginForm.style.display = 'flex';
        console.log('Formulário de login exibido');
    } else {
        console.error('Elemento login-form não encontrado!');
    }
    
    if (dashboard) {
        dashboard.style.display = 'none';
        console.log('Dashboard ocultado');
    } else {
        console.error('Elemento dashboard não encontrado!');
    }
    
    if (header) {
        header.style.display = 'none';
        console.log('Header ocultado');
    } else {
        console.error('Elemento header não encontrado!');
    }
}

// Show dashboard
function showDashboard() {
    console.log('Mostrando dashboard...');
    const loginForm = document.getElementById('login-form');
    const dashboard = document.getElementById('dashboard');
    const header = document.querySelector('header');
    
    if (loginForm) {
        loginForm.style.display = 'none';
        console.log('Formulário de login ocultado');
    } else {
        console.error('Elemento login-form não encontrado!');
    }
    
    if (dashboard) {
        dashboard.style.display = 'block';
        dashboard.classList.remove('hidden');
        console.log('Dashboard exibido');
    } else {
        console.error('Elemento dashboard não encontrado!');
    }
    
    if (header) {
        header.style.display = 'block';
        console.log('Header exibido');
    } else {
        console.error('Elemento header não encontrado!');
    }
}

// Admin login
async function adminLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    console.log('Tentando login com:', { email, password });
    
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/login`, {
            email,
            password
        });
        
        console.log('Resposta da API:', response.data);
        
        if (response.data.success && response.data.user.role === 'admin') {
            console.log('Login bem-sucedido, configurando dashboard...');
            authToken = response.data.token;
            localStorage.setItem('admin_token', authToken);
            
            const adminNameElement = document.getElementById('admin-name');
            if (adminNameElement) {
                adminNameElement.textContent = response.data.user.name;
            } else {
                console.error('Elemento admin-name não encontrado!');
            }
            
            initializeSocket(); // Initialize real-time connection
            showDashboard();
            loadDashboardData();
            console.log('Dashboard configurado com sucesso');
        } else {
            console.log('Falha na validação:', { success: response.data.success, role: response.data.user?.role });
            alert('Acesso negado. Apenas administradores podem acessar este painel.');
        }
    } catch (error) {
        console.error('Erro no login:', error);
        alert('Erro no login. Verifique suas credenciais.');
    }
}

// Logout function
function logout() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    localStorage.removeItem('admin_token');
    authToken = null;
    showLoginForm();
}

// Load dashboard data
async function loadDashboardData() {
    if (!authToken) return;
    
    try {
        // Load dashboard stats
        const statsResponse = await axios.get(`${API_BASE_URL}/admin/dashboard`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (statsResponse.data.success) {
            const stats = statsResponse.data.data;
            document.getElementById('total-users').textContent = stats.overview?.totalUsers || 0;
            document.getElementById('active-agents').textContent = stats.overview?.activeAgents || 0;
            document.getElementById('conversations-today').textContent = stats.overview?.totalConversations || 0;
            document.getElementById('alerts-count').textContent = stats.overview?.unresolvedAlerts || 0;
        }
        
        // Load users
        const usersResponse = await axios.get(`${API_BASE_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (usersResponse.data.success) {
            displayUsers(usersResponse.data.data.users);
        }
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
            logout();
        }
    }
}

// Display users in table
function displayUsers(users) {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <button onclick="openUserDetailsModal(${user.id})" class="text-blue-600 hover:text-blue-900 hover:underline font-medium">${user.name}</button>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }">
                    ${user.role === 'admin' ? 'Administrador' : 'Cliente'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(user.created_at).toLocaleDateString('pt-BR')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editUser(${user.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                ${user.role !== 'admin' ? `<button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-900">Excluir</button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Edit user (placeholder)
function editUser(userId) {
    alert(`Funcionalidade de edição do usuário ${userId} será implementada em breve.`);
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    
    try {
        const response = await axios.delete(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Usuário excluído com sucesso!');
            loadDashboardData(); // Reload data
        }
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao excluir usuário.');
    }
}

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado, inicializando painel admin...');
    console.log('Elementos encontrados:', {
        loginForm: document.getElementById('login-form'),
        dashboard: document.getElementById('dashboard'),
        header: document.querySelector('header')
    });
    checkAdminAuth();
});

// Fallback initialization if DOMContentLoaded already fired
if (document.readyState === 'loading') {
    console.log('Documento ainda carregando, aguardando DOMContentLoaded...');
} else {
    console.log('Documento já carregado, inicializando imediatamente...');
    checkAdminAuth();
}

// Tab Management
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active', 'border-indigo-500', 'text-indigo-600');
        button.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Show selected tab content
    const selectedContent = document.getElementById(`content-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
    }
    
    // Add active class to selected tab button
    const selectedButton = document.getElementById(`tab-${tabName}`);
    if (selectedButton) {
        selectedButton.classList.add('active', 'border-indigo-500', 'text-indigo-600');
        selectedButton.classList.remove('border-transparent', 'text-gray-500');
    }
    
    // Load data for specific tabs
    switch(tabName) {
        case 'overview':
            loadDashboardData();
            break;
        case 'users':
            loadUsersData();
            break;
        case 'payments':
            loadPaymentsData();
            break;
        case 'logs':
            loadLogsData();
            break;
        case 'support':
            loadSupportData();
            break;
        case 'settings':
            loadSettingsData();
            break;
        case 'reports':
            loadReportsData();
            break;
    }
}

// Load Settings Data
async function loadSettingsData() {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/settings`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            displaySettingsData(response.data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        // Load default settings
        displaySettingsData({
            general: {
                site_name: 'SaaS Agente IA',
                site_description: 'Plataforma de Agentes de IA para WhatsApp',
                timezone: 'America/Sao_Paulo',
                language: 'pt-BR',
                maintenance_mode: false
            },
            integrations: {
                whatsapp_api_url: '',
                whatsapp_token: '',
                stripe_public_key: '',
                stripe_secret_key: '',
                openai_api_key: '',
                smtp_host: '',
                smtp_port: 587,
                smtp_user: '',
                smtp_password: ''
            },
            email_templates: {
                welcome_email: {
                    subject: 'Bem-vindo ao SaaS Agente IA',
                    body: 'Olá {{name}}, bem-vindo à nossa plataforma!'
                },
                password_reset: {
                    subject: 'Redefinição de Senha',
                    body: 'Clique no link para redefinir sua senha: {{reset_link}}'
                },
                invoice_email: {
                    subject: 'Nova Fatura - {{invoice_number}}',
                    body: 'Sua fatura no valor de {{amount}} está disponível.'
                }
            }
        });
    }
}

function displaySettingsData(data) {
    // General Settings
    if (data.general) {
        const siteNameEl = document.getElementById('site_name');
        const siteDescEl = document.getElementById('site_description');
        const timezoneEl = document.getElementById('timezone');
        const languageEl = document.getElementById('language');
        const maintenanceEl = document.getElementById('maintenance_mode');
        
        if (siteNameEl) siteNameEl.value = data.general.site_name || '';
        if (siteDescEl) siteDescEl.value = data.general.site_description || '';
        if (timezoneEl) timezoneEl.value = data.general.timezone || 'America/Sao_Paulo';
        if (languageEl) languageEl.value = data.general.language || 'pt-BR';
        if (maintenanceEl) maintenanceEl.checked = data.general.maintenance_mode || false;
    }
    
    // Integration Settings
    if (data.integrations) {
        const whatsappUrlEl = document.getElementById('whatsapp_api_url');
        const whatsappTokenEl = document.getElementById('whatsapp_token');
        const stripePublicEl = document.getElementById('stripe_public_key');
        const stripeSecretEl = document.getElementById('stripe_secret_key');
        const openaiKeyEl = document.getElementById('openai_api_key');
        const smtpHostEl = document.getElementById('smtp_host');
        const smtpPortEl = document.getElementById('smtp_port');
        const smtpUserEl = document.getElementById('smtp_user');
        const smtpPasswordEl = document.getElementById('smtp_password');
        
        if (whatsappUrlEl) whatsappUrlEl.value = data.integrations.whatsapp_api_url || '';
        if (whatsappTokenEl) whatsappTokenEl.value = data.integrations.whatsapp_token || '';
        if (stripePublicEl) stripePublicEl.value = data.integrations.stripe_public_key || '';
        if (stripeSecretEl) stripeSecretEl.value = data.integrations.stripe_secret_key || '';
        if (openaiKeyEl) openaiKeyEl.value = data.integrations.openai_api_key || '';
        if (smtpHostEl) smtpHostEl.value = data.integrations.smtp_host || '';
        if (smtpPortEl) smtpPortEl.value = data.integrations.smtp_port || 587;
        if (smtpUserEl) smtpUserEl.value = data.integrations.smtp_user || '';
        if (smtpPasswordEl) smtpPasswordEl.value = data.integrations.smtp_password || '';
    }
    
    // Email Templates
    if (data.email_templates) {
        // Welcome Email
        if (data.email_templates.welcome_email) {
            const welcomeSubjectEl = document.getElementById('welcome_subject');
            const welcomeBodyEl = document.getElementById('welcome_body');
            if (welcomeSubjectEl) welcomeSubjectEl.value = data.email_templates.welcome_email.subject || '';
            if (welcomeBodyEl) welcomeBodyEl.value = data.email_templates.welcome_email.body || '';
        }
        
        // Password Reset
        if (data.email_templates.password_reset) {
            const resetSubjectEl = document.getElementById('reset_subject');
            const resetBodyEl = document.getElementById('reset_body');
            if (resetSubjectEl) resetSubjectEl.value = data.email_templates.password_reset.subject || '';
            if (resetBodyEl) resetBodyEl.value = data.email_templates.password_reset.body || '';
        }
        
        // Invoice Email
        if (data.email_templates.invoice_email) {
            const invoiceSubjectEl = document.getElementById('invoice_subject');
            const invoiceBodyEl = document.getElementById('invoice_body');
            if (invoiceSubjectEl) invoiceSubjectEl.value = data.email_templates.invoice_email.subject || '';
            if (invoiceBodyEl) invoiceBodyEl.value = data.email_templates.invoice_email.body || '';
        }
    }
}

// Save settings functions
async function saveGeneralSettings() {
    const formData = {
        site_name: document.getElementById('site_name')?.value || '',
        site_description: document.getElementById('site_description')?.value || '',
        timezone: document.getElementById('timezone')?.value || 'America/Sao_Paulo',
        language: document.getElementById('language')?.value || 'pt-BR',
        maintenance_mode: document.getElementById('maintenance_mode')?.checked || false
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/general`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Configurações gerais salvas com sucesso!');
        } else {
            alert('Erro ao salvar configurações: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações gerais:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.message || error.message));
    }
}

async function saveIntegrationSettings() {
    const formData = {
        whatsapp_api_url: document.getElementById('whatsapp_api_url')?.value || '',
        whatsapp_token: document.getElementById('whatsapp_token')?.value || '',
        stripe_public_key: document.getElementById('stripe_public_key')?.value || '',
        stripe_secret_key: document.getElementById('stripe_secret_key')?.value || '',
        openai_api_key: document.getElementById('openai_api_key')?.value || '',
        smtp_host: document.getElementById('smtp_host')?.value || '',
        smtp_port: parseInt(document.getElementById('smtp_port')?.value) || 587,
        smtp_user: document.getElementById('smtp_user')?.value || '',
        smtp_password: document.getElementById('smtp_password')?.value || ''
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/integrations`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Configurações de integração salvas com sucesso!');
        } else {
            alert('Erro ao salvar configurações: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações de integração:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.message || error.message));
    }
}

async function saveEmailTemplates() {
    const formData = {
        welcome_email: {
            subject: document.getElementById('welcome_subject')?.value || '',
            body: document.getElementById('welcome_body')?.value || ''
        },
        password_reset: {
            subject: document.getElementById('reset_subject')?.value || '',
            body: document.getElementById('reset_body')?.value || ''
        },
        invoice_email: {
            subject: document.getElementById('invoice_subject')?.value || '',
            body: document.getElementById('invoice_body')?.value || ''
        }
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/email-templates`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Templates de email salvos com sucesso!');
        } else {
            alert('Erro ao salvar templates: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar templates de email:', error);
        alert('Erro ao salvar templates: ' + (error.response?.data?.message || error.message));
    }
}

// Test integration functions
async function testWhatsAppConnection() {
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/settings/test/whatsapp`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Conexão com WhatsApp testada com sucesso!');
        } else {
            alert('Erro na conexão: ' + (response.data.message || 'Teste falhou'));
        }
    } catch (error) {
        console.error('Erro ao testar WhatsApp:', error);
        alert('Erro no teste: ' + (error.response?.data?.message || error.message));
    }
}

async function testEmailConnection() {
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/settings/test/email`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Conexão de email testada com sucesso!');
        } else {
            alert('Erro na conexão: ' + (response.data.message || 'Teste falhou'));
        }
    } catch (error) {
        console.error('Erro ao testar email:', error);
        alert('Erro no teste: ' + (error.response?.data?.message || error.message));
    }
}

// Sistema de Configurações Avançadas
function showSettingsTab(tabName) {
    // Esconder todas as abas de conteúdo
    const allContents = document.querySelectorAll('.settings-content');
    allContents.forEach(content => {
        content.classList.add('hidden');
    });
    
    // Remover classe ativa de todos os botões
    const allButtons = document.querySelectorAll('.settings-tab-button');
    allButtons.forEach(button => {
        button.classList.remove('active', 'bg-blue-100', 'text-blue-700');
        button.classList.add('text-gray-500', 'hover:text-gray-700');
    });
    
    // Mostrar aba selecionada
    const selectedContent = document.getElementById(`settings-content-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.remove('hidden');
    }
    
    // Ativar botão selecionado
    const selectedButton = document.getElementById(`settings-tab-${tabName}`);
    if (selectedButton) {
        selectedButton.classList.add('active', 'bg-blue-100', 'text-blue-700');
        selectedButton.classList.remove('text-gray-500', 'hover:text-gray-700');
    }
}

// Função para salvar configurações de segurança
async function saveSecuritySettings() {
    const formData = {
        jwt_expiration: parseInt(document.getElementById('jwt_expiration')?.value) || 24,
        max_login_attempts: parseInt(document.getElementById('max_login_attempts')?.value) || 5,
        lockout_duration: parseInt(document.getElementById('lockout_duration')?.value) || 30,
        require_2fa: document.getElementById('require_2fa')?.checked || false,
        password_min_length: parseInt(document.getElementById('password_min_length')?.value) || 8,
        password_require_uppercase: document.getElementById('password_require_uppercase')?.checked || false,
        password_require_numbers: document.getElementById('password_require_numbers')?.checked || false,
        password_require_symbols: document.getElementById('password_require_symbols')?.checked || false,
        password_expiry_days: parseInt(document.getElementById('password_expiry_days')?.value) || 90
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/security`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Configurações de segurança salvas com sucesso!');
        } else {
            alert('Erro ao salvar configurações: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações de segurança:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.message || error.message));
    }
}

// Função para salvar configurações de limites
async function saveLimitsSettings() {
    const formData = {
        free_agents_limit: parseInt(document.getElementById('free_agents_limit')?.value) || 2,
        free_messages_limit: parseInt(document.getElementById('free_messages_limit')?.value) || 1000,
        basic_agents_limit: parseInt(document.getElementById('basic_agents_limit')?.value) || 5,
        basic_messages_limit: parseInt(document.getElementById('basic_messages_limit')?.value) || 5000,
        premium_agents_limit: parseInt(document.getElementById('premium_agents_limit')?.value) || 15,
        premium_messages_limit: parseInt(document.getElementById('premium_messages_limit')?.value) || 20000,
        enterprise_agents_limit: parseInt(document.getElementById('enterprise_agents_limit')?.value) || -1,
        enterprise_messages_limit: parseInt(document.getElementById('enterprise_messages_limit')?.value) || -1,
        max_upload_size: parseInt(document.getElementById('max_upload_size')?.value) || 10,
        request_timeout: parseInt(document.getElementById('request_timeout')?.value) || 30,
        rate_limit_per_user: parseInt(document.getElementById('rate_limit_per_user')?.value) || 60,
        max_concurrent_connections: parseInt(document.getElementById('max_concurrent_connections')?.value) || 1000,
        log_retention_days: parseInt(document.getElementById('log_retention_days')?.value) || 30
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/limits`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Configurações de limites salvas com sucesso!');
        } else {
            alert('Erro ao salvar configurações: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações de limites:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.message || error.message));
    }
}

// Função para salvar configurações de notificação
async function saveNotificationSettings() {
    const formData = {
        notify_new_users: document.getElementById('notify_new_users')?.checked || false,
        notify_payments: document.getElementById('notify_payments')?.checked || false,
        notify_system_errors: document.getElementById('notify_system_errors')?.checked || false,
        notify_resource_usage: document.getElementById('notify_resource_usage')?.checked || false,
        admin_notification_email: document.getElementById('admin_notification_email')?.value || '',
        notification_webhook_url: document.getElementById('notification_webhook_url')?.value || '',
        telegram_bot_token: document.getElementById('telegram_bot_token')?.value || '',
        telegram_chat_id: document.getElementById('telegram_chat_id')?.value || ''
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/notifications`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Configurações de notificação salvas com sucesso!');
        } else {
            alert('Erro ao salvar configurações: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações de notificação:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.message || error.message));
    }
}

// Função para salvar configurações de manutenção
async function saveMaintenanceSettings() {
    const formData = {
        auto_backup_enabled: document.getElementById('auto_backup_enabled')?.checked || false,
        backup_time: document.getElementById('backup_time')?.value || '02:00',
        backup_retention_days: parseInt(document.getElementById('backup_retention_days')?.value) || 7,
        auto_log_cleanup: document.getElementById('auto_log_cleanup')?.checked || false,
        auto_db_optimization: document.getElementById('auto_db_optimization')?.checked || false
    };
    
    try {
        const response = await axios.put(`${API_BASE_URL}/admin/settings/maintenance`, formData, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Configurações de manutenção salvas com sucesso!');
        } else {
            alert('Erro ao salvar configurações: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar configurações de manutenção:', error);
        alert('Erro ao salvar configurações: ' + (error.response?.data?.message || error.message));
    }
}

// Funções de manutenção
async function createManualBackup() {
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/maintenance/backup`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Backup manual criado com sucesso!');
        } else {
            alert('Erro ao criar backup: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao criar backup manual:', error);
        alert('Erro ao criar backup: ' + (error.response?.data?.message || error.message));
    }
}

async function downloadBackup() {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/maintenance/backup/download`, {
            headers: { Authorization: `Bearer ${authToken}` },
            responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `backup_${new Date().toISOString().split('T')[0]}.sql`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        
        alert('Backup baixado com sucesso!');
    } catch (error) {
        console.error('Erro ao baixar backup:', error);
        alert('Erro ao baixar backup: ' + (error.response?.data?.message || error.message));
    }
}

async function cleanupLogs() {
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/maintenance/cleanup-logs`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Logs antigos limpos com sucesso!');
        } else {
            alert('Erro ao limpar logs: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao limpar logs:', error);
        alert('Erro ao limpar logs: ' + (error.response?.data?.message || error.message));
    }
}

async function optimizeDatabase() {
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/maintenance/optimize-db`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Banco de dados otimizado com sucesso!');
        } else {
            alert('Erro ao otimizar banco de dados: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao otimizar banco de dados:', error);
        alert('Erro ao otimizar banco de dados: ' + (error.response?.data?.message || error.message));
    }
}

async function clearCache() {
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/maintenance/clear-cache`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Cache limpo com sucesso!');
        } else {
            alert('Erro ao limpar cache: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao limpar cache:', error);
        alert('Erro ao limpar cache: ' + (error.response?.data?.message || error.message));
    }
}

// Make functions globally available
window.saveGeneralSettings = saveGeneralSettings;
window.saveIntegrationSettings = saveIntegrationSettings;
window.saveEmailTemplates = saveEmailTemplates;
window.testWhatsAppConnection = testWhatsAppConnection;
window.testEmailConnection = testEmailConnection;
window.showSettingsTab = showSettingsTab;
window.saveSecuritySettings = saveSecuritySettings;
window.saveLimitsSettings = saveLimitsSettings;
window.saveNotificationSettings = saveNotificationSettings;
window.saveMaintenanceSettings = saveMaintenanceSettings;
window.createManualBackup = createManualBackup;
window.downloadBackup = downloadBackup;
window.cleanupLogs = cleanupLogs;
window.optimizeDatabase = optimizeDatabase;
window.clearCache = clearCache

// Load Users Data
async function loadUsersData() {
    if (!authToken) return;
    
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/users`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            displayUsersTable(response.data.data.users);
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

// Display Users in Enhanced Table
function displayUsersTable(users) {
    const tbody = document.getElementById('users-table');
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                }">
                    ${user.role === 'admin' ? 'Administrador' : 'Cliente'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    Ativo
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(user.created_at).toLocaleDateString('pt-BR')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editUser(${user.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                <button onclick="resetPassword(${user.id})" class="text-yellow-600 hover:text-yellow-900 mr-3">Reset Senha</button>
                ${user.role !== 'admin' ? `<button onclick="deleteUser(${user.id})" class="text-red-600 hover:text-red-900">Excluir</button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

// Load Payments Data
async function loadPaymentsData() {
    if (!authToken) return;
    
    try {
        const [plansResponse, subscriptionsResponse, paymentsResponse, invoicesResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/admin/plans`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/subscriptions`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/payments`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/invoices`, {
                headers: { Authorization: `Bearer ${authToken}` }
            })
        ]);
        
        if (plansResponse.data.success && subscriptionsResponse.data.success && paymentsResponse.data.success && invoicesResponse.data.success) {
            displayPaymentsData({
                plans: plansResponse.data.data.plans,
                subscriptions: subscriptionsResponse.data.data.subscriptions,
                payments: paymentsResponse.data.data.payments,
                invoices: invoicesResponse.data.data.invoices
            });
        }
        
    } catch (error) {
        console.error('Erro ao carregar pagamentos:', error);
        alert('Erro ao carregar dados de pagamentos: ' + (error.response?.data?.message || error.message));
    }
}

// Display Payments Data
function displayPaymentsData(data) {
    // Update plans table
    const plansTableBody = document.querySelector('#plans-table');
    if (plansTableBody && data.plans) {
        plansTableBody.innerHTML = '';
        data.plans.forEach(plan => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${plan.name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ ${parseFloat(plan.price_per_month).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${plan.active_subscriptions || 0}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ ${parseFloat(plan.monthly_revenue || 0).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="editPlan(${plan.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Editar</button>
                    <button onclick="deletePlan(${plan.id})" class="text-red-600 hover:text-red-900">Excluir</button>
                </td>
            `;
            plansTableBody.appendChild(row);
        });
    }
    
    // Update payments history table
    const paymentsTableBody = document.querySelector('#payments-table');
    if (paymentsTableBody && data.payments) {
        paymentsTableBody.innerHTML = '';
        data.payments.forEach(payment => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${payment.user_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.plan_name || 'N/A'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ ${parseFloat(payment.amount).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusClass(payment.status)}">
                        ${payment.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(payment.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="viewPaymentDetails(${payment.id})" class="text-indigo-600 hover:text-indigo-900">Ver</button>
                </td>
            `;
            paymentsTableBody.appendChild(row);
        });
    }
    
    // Update invoices table
    const invoicesTableBody = document.querySelector('#invoices-table');
    if (invoicesTableBody && data.invoices) {
        invoicesTableBody.innerHTML = '';
        data.invoices.forEach(invoice => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${invoice.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${invoice.user_name}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ ${parseFloat(invoice.amount).toFixed(2)}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getInvoiceStatusClass(invoice.status)}">
                        ${invoice.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(invoice.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="sendInvoice(${invoice.id})" class="text-green-600 hover:text-green-900 mr-3" ${invoice.status === 'sent' ? 'disabled' : ''}>Enviar</button>
                    <button onclick="viewInvoice(${invoice.id})" class="text-indigo-600 hover:text-indigo-900">Ver</button>
                </td>
            `;
            invoicesTableBody.appendChild(row);
        });
    }
}

// Display Payments Table (fallback for mock data)
function displayPaymentsTable(payments) {
    const tbody = document.getElementById('payments-table');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    payments.forEach(payment => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${payment.user}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.plan}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${payment.amount}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    payment.status === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }">
                    ${payment.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${payment.date.toLocaleDateString('pt-BR')}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getPaymentStatusClass(status) {
    switch (status) {
        case 'completed': return 'bg-green-100 text-green-800';
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'failed': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getInvoiceStatusClass(status) {
    switch (status) {
        case 'paid': return 'bg-green-100 text-green-800';
        case 'sent': return 'bg-blue-100 text-blue-800';
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'overdue': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

// Plan management functions
function editPlan(planId) {
    alert(`Funcionalidade de edição do plano ${planId} será implementada em breve.`);
}

async function deletePlan(planId) {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;
    
    try {
        const response = await axios.delete(`${API_BASE_URL}/admin/plans/${planId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Plano excluído com sucesso!');
            loadPaymentsData();
        } else {
            alert('Erro ao excluir plano: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao excluir plano:', error);
        alert('Erro ao excluir plano: ' + (error.response?.data?.message || error.message));
    }
}

function viewPaymentDetails(paymentId) {
    alert(`Visualizar detalhes do pagamento ${paymentId}`);
}

async function sendInvoice(invoiceId) {
    if (!confirm('Enviar fatura por email?')) return;
    
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/invoices/${invoiceId}/send`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Fatura enviada com sucesso!');
            loadPaymentsData();
        } else {
            alert('Erro ao enviar fatura: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao enviar fatura:', error);
        alert('Erro ao enviar fatura: ' + (error.response?.data?.message || error.message));
    }
}

function viewInvoice(invoiceId) {
    alert(`Visualizar fatura ${invoiceId}`);
}

// Load Logs Data
async function loadLogsData() {
    if (!authToken) return;
    
    try {
        const [auditLogsResponse, systemLogsResponse, securityLogsResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/admin/logs/audit`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/logs/system`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/logs/security`, {
                headers: { Authorization: `Bearer ${authToken}` }
            })
        ]);
        
        if (auditLogsResponse.data.success && systemLogsResponse.data.success && securityLogsResponse.data.success) {
            displayLogsData({
                audit: auditLogsResponse.data.data.logs,
                system: systemLogsResponse.data.data.logs,
                security: securityLogsResponse.data.data.logs
            });
        }
    } catch (error) {
        console.error('Erro ao carregar logs:', error);
        alert('Erro ao carregar logs: ' + (error.response?.data?.message || error.message));
    }
}

function displayLogsData(data) {
    // Display Audit Logs
    const auditTableBody = document.querySelector('#audit-logs-table');
    if (auditTableBody && data.audit) {
        auditTableBody.innerHTML = '';
        data.audit.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${new Date(log.created_at).toLocaleString('pt-BR')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${log.user_name || 'Sistema'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionClass(log.action)}">
                        ${getActionLabel(log.action)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.resource || 'N/A'}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${log.details || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.ip_address || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="viewLogDetails(${log.id}, 'audit')" class="text-indigo-600 hover:text-indigo-900">
                        Ver
                    </button>
                </td>
            `;
            auditTableBody.appendChild(row);
        });
    }
    
    // Display System Logs
    const systemTableBody = document.querySelector('#system-logs-table');
    if (systemTableBody && data.system) {
        systemTableBody.innerHTML = '';
        data.system.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${new Date(log.created_at).toLocaleString('pt-BR')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getLogLevelClass(log.level)}">
                        ${log.level.toUpperCase()}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.module || 'N/A'}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${log.message}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="viewLogDetails(${log.id}, 'system')" class="text-indigo-600 hover:text-indigo-900">
                        Ver
                    </button>
                </td>
            `;
            systemTableBody.appendChild(row);
        });
    }
    
    // Display Security Logs
    const securityTableBody = document.querySelector('#security-logs-table');
    if (securityTableBody && data.security) {
        securityTableBody.innerHTML = '';
        data.security.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${new Date(log.created_at).toLocaleString('pt-BR')}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getSecurityEventClass(log.event_type)}">
                        ${getSecurityEventLabel(log.event_type)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${log.user_name || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.ip_address || 'N/A'}
                </td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    ${log.details || 'N/A'}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="viewLogDetails(${log.id}, 'security')" class="text-indigo-600 hover:text-indigo-900">
                        Ver
                    </button>
                </td>
            `;
            securityTableBody.appendChild(row);
        });
    }
}

// Helper functions for log display
function getActionClass(action) {
    switch (action) {
        case 'user_created':
        case 'agent_created':
            return 'bg-green-100 text-green-800';
        case 'user_updated':
        case 'agent_updated':
            return 'bg-blue-100 text-blue-800';
        case 'user_deleted':
        case 'agent_deleted':
            return 'bg-red-100 text-red-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function getActionLabel(action) {
    const labels = {
        'user_created': 'Usuário Criado',
        'user_updated': 'Usuário Atualizado',
        'user_deleted': 'Usuário Excluído',
        'agent_created': 'Agente Criado',
        'agent_updated': 'Agente Atualizado',
        'agent_deleted': 'Agente Excluído',
        'login': 'Login',
        'logout': 'Logout'
    };
    return labels[action] || action;
}

function getLogLevelClass(level) {
    switch (level) {
        case 'error':
            return 'bg-red-100 text-red-800';
        case 'warning':
            return 'bg-yellow-100 text-yellow-800';
        case 'info':
            return 'bg-blue-100 text-blue-800';
        case 'debug':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function getSecurityEventClass(eventType) {
    switch (eventType) {
        case 'login_success':
            return 'bg-green-100 text-green-800';
        case 'login_failed':
        case 'unauthorized_access':
            return 'bg-red-100 text-red-800';
        case 'password_reset':
            return 'bg-yellow-100 text-yellow-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function getSecurityEventLabel(eventType) {
    const labels = {
        'login_success': 'Login Sucesso',
        'login_failed': 'Login Falhou',
        'logout': 'Logout',
        'password_reset': 'Reset Senha',
        'unauthorized_access': 'Acesso Negado'
    };
    return labels[eventType] || eventType;
}

// Log management functions
function viewLogDetails(logId, logType) {
    alert(`Visualizar detalhes do log ${logId} (${logType})`);
}

async function exportLogs(logType, format = 'csv') {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/logs/export/${logType}?format=${format}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            responseType: 'blob'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${logType}_logs_${new Date().toISOString().split('T')[0]}.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        alert('Logs exportados com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar logs:', error);
        alert('Erro ao exportar logs: ' + (error.response?.data?.message || error.message));
    }
}

async function clearLogs(logType) {
    if (!confirm(`Tem certeza que deseja limpar todos os logs de ${logType}? Esta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        const response = await axios.delete(`${API_BASE_URL}/admin/logs/${logType}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Logs limpos com sucesso!');
            loadLogsData();
        } else {
            alert('Erro ao limpar logs: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao limpar logs:', error);
        alert('Erro ao limpar logs: ' + (error.response?.data?.message || error.message));
    }
}

// Make functions globally available
window.viewLogDetails = viewLogDetails;
window.exportLogs = exportLogs;
window.clearLogs = clearLogs;

// Display Logs Table (legacy function for backward compatibility)
function displayLogsTable(logs) {
    const tbody = document.getElementById('logs-table');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${new Date(log.timestamp).toLocaleString('pt-BR')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${log.user}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.action}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.resource}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.ip}</td>
        `;
        tbody.appendChild(row);
    });
}

// Load Support Data
async function loadSupportData() {
    try {
        const [ticketsResponse, statsResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/admin/support/tickets`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/support/stats`, {
                headers: { Authorization: `Bearer ${authToken}` }
            })
        ]);
        
        if (ticketsResponse.data.success) {
            displaySupportTable(ticketsResponse.data.tickets);
        }
        
        if (statsResponse.data.success) {
            updateSupportStats(statsResponse.data.stats);
        }
    } catch (error) {
        console.error('Erro ao carregar dados de suporte:', error);
        alert('Erro ao carregar dados de suporte: ' + (error.response?.data?.message || error.message));
    }
}

// Display Support Table
function displaySupportTable(tickets) {
    const tbody = document.getElementById('support-table');
    tbody.innerHTML = '';
    
    tickets.forEach(ticket => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${ticket.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${ticket.user}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${ticket.subject}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    ticket.status === 'Aberto' ? 'bg-red-100 text-red-800' : 
                    ticket.status === 'Em Andamento' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }">
                    ${ticket.status}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    ticket.priority === 'Alta' ? 'bg-red-100 text-red-800' : 
                    ticket.priority === 'Média' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }">
                    ${ticket.priority}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${ticket.date.toLocaleDateString('pt-BR')}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="viewTicket(${ticket.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">Ver</button>
                <button onclick="respondTicket(${ticket.id})" class="text-green-600 hover:text-green-900">Responder</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// User Management Functions
function openUserModal(userId = null) {
    const modal = document.getElementById('userModal');
    const modalTitle = document.getElementById('modalTitle');
    const form = document.getElementById('userForm');
    
    // Reset form
    form.reset();
    document.getElementById('userId').value = '';
    
    if (userId) {
        // Edit mode
        modalTitle.textContent = 'Editar Usuário';
        loadUserData(userId);
    } else {
        // Create mode
        modalTitle.textContent = 'Criar Novo Usuário';
        document.getElementById('userPassword').required = true;
    }
    
    modal.classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('userModal').classList.add('hidden');
}

async function loadUserData(userId) {
    if (!authToken) return;
    
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            const user = response.data.data;
            document.getElementById('userId').value = user.id;
            document.getElementById('userName').value = user.name;
            document.getElementById('userEmail').value = user.email;
            document.getElementById('userRole').value = user.role;
            document.getElementById('userPlan').value = user.plan || 'free';
            document.getElementById('userPassword').required = false;
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        alert('Erro ao carregar dados do usuário');
    }
}

async function submitUserForm(event) {
    event.preventDefault();
    
    if (!authToken) return;
    
    const formData = new FormData(event.target);
    const userData = {
        name: formData.get('name'),
        email: formData.get('email'),
        role: formData.get('role'),
        plan: formData.get('plan')
    };
    
    // Only include password if provided
    const password = formData.get('password');
    if (password) {
        userData.password = password;
    }
    
    const userId = formData.get('userId');
    const isEdit = userId && userId !== '';
    
    try {
        let response;
        if (isEdit) {
            response = await axios.put(`${API_BASE_URL}/admin/users/${userId}`, userData, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
        } else {
            response = await axios.post(`${API_BASE_URL}/admin/users`, userData, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
        }
        
        if (response.data.success) {
            alert(isEdit ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
            closeUserModal();
            loadUsersData(); // Refresh users list
        } else {
            alert('Erro: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        alert('Erro ao salvar usuário: ' + (error.response?.data?.message || error.message));
    }
}

function editUser(userId) {
    openUserModal(userId);
}

function resetPassword(userId) {
    showConfirmModal(
        'Reset de Senha',
        'Tem certeza que deseja resetar a senha deste usuário? Uma nova senha será enviada por email.',
        () => performResetPassword(userId)
    );
}

async function performResetPassword(userId) {
    if (!authToken) return;
    
    try {
        const response = await axios.post(`${API_BASE_URL}/admin/users/${userId}/reset-password`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Senha resetada com sucesso! Nova senha enviada por email.');
        } else {
            alert('Erro ao resetar senha: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao resetar senha:', error);
        alert('Erro ao resetar senha: ' + (error.response?.data?.message || error.message));
    }
    
    closeConfirmModal();
}

function deleteUser(userId) {
    showConfirmModal(
        'Excluir Usuário',
        'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
        () => performDeleteUser(userId)
    );
}

async function performDeleteUser(userId) {
    if (!authToken) return;
    
    try {
        const response = await axios.delete(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Usuário excluído com sucesso!');
            loadUsersData(); // Refresh users list
        } else {
            alert('Erro ao excluir usuário: ' + (response.data.message || 'Operação falhou'));
        }
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao excluir usuário: ' + (error.response?.data?.message || error.message));
    }
    
    closeConfirmModal();
}

// Confirmation Modal Functions
function showConfirmModal(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmButton').onclick = onConfirm;
    document.getElementById('confirmModal').classList.remove('hidden');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.add('hidden');
}

// Support Functions
function viewTicket(ticketId) {
    alert(`Visualizar ticket #${ticketId}`);
}

function respondTicket(ticketId) {
    alert(`Responder ticket #${ticketId}`);
}

// Load Reports Data
async function loadReportsData() {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/reports`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            displayReportsData(response.data.data);
        } else {
            console.error('Erro ao carregar relatórios:', response.data.error);
            alert('Erro ao carregar relatórios');
        }
    } catch (error) {
        console.error('Erro ao carregar relatórios:', error);
        alert('Erro ao carregar relatórios: ' + (error.response?.data?.message || error.message));
    }
}

function displayReportsData(data) {
    // Display Users Report
    if (data.users) {
        updateReportCard('total-users-card', data.users.total_users, 'Usuários Totais');
        updateReportCard('new-users-card', data.users.new_users_this_month, 'Novos Usuários (Mês)');
        updateReportCard('active-users-card', data.users.active_users, 'Usuários Ativos');
        updateReportCard('user-growth-card', `${data.users.user_growth}%`, 'Crescimento');
        
        // Age Demographics Chart
        if (data.users.demographics && data.users.demographics.age_groups) {
            createDoughnutChart('age-demographics-chart', {
                labels: data.users.demographics.age_groups.map(group => group.range),
                data: data.users.demographics.age_groups.map(group => group.count),
                title: 'Distribuição por Idade'
            });
        }
        
        // Location Demographics Chart
        if (data.users.demographics && data.users.demographics.locations) {
            createBarChart('location-demographics-chart', {
                labels: data.users.demographics.locations.map(loc => loc.country),
                data: data.users.demographics.locations.map(loc => loc.count),
                title: 'Usuários por Localização'
            });
        }
    }
    
    // Display Revenue Report
    if (data.revenue) {
        updateReportCard('total-revenue-card', `R$ ${data.revenue.total_revenue.toLocaleString()}`, 'Receita Total');
        updateReportCard('monthly-revenue-card', `R$ ${data.revenue.monthly_revenue.toLocaleString()}`, 'Receita Mensal');
        updateReportCard('revenue-growth-card', `${data.revenue.revenue_growth}%`, 'Crescimento');
        updateReportCard('arpu-card', `R$ ${data.revenue.average_revenue_per_user}`, 'ARPU');
        
        // Revenue Trends Chart
        if (data.revenue.monthly_trends) {
            createLineChart('revenue-trends-chart', {
                labels: data.revenue.monthly_trends.map(trend => trend.month),
                data: data.revenue.monthly_trends.map(trend => trend.revenue),
                title: 'Tendência de Receita'
            });
        }
        
        // Subscription Breakdown Chart
        if (data.revenue.subscription_breakdown) {
            createDoughnutChart('subscription-breakdown-chart', {
                labels: data.revenue.subscription_breakdown.map(sub => sub.plan),
                data: data.revenue.subscription_breakdown.map(sub => sub.revenue),
                title: 'Receita por Plano'
            });
        }
    }
    
    // Display Agents Report
    if (data.agents) {
        updateReportCard('total-agents-card', data.agents.total_agents, 'Agentes Totais');
        updateReportCard('active-agents-card', data.agents.active_agents, 'Agentes Ativos');
        updateReportCard('avg-response-time-card', `${data.agents.agent_performance.average_response_time}s`, 'Tempo Resposta');
        updateReportCard('satisfaction-score-card', data.agents.agent_performance.satisfaction_score, 'Satisfação');
        
        // Top Performers Table
        if (data.agents.agent_performance && data.agents.agent_performance.top_performers) {
            displayTopPerformersTable(data.agents.agent_performance.top_performers);
        }
        
        // Usage Stats Chart
        if (data.agents.usage_stats) {
            createBarChart('agent-usage-chart', {
                labels: ['Diário', 'Semanal', 'Mensal'],
                data: [
                    data.agents.usage_stats.daily_conversations,
                    data.agents.usage_stats.weekly_conversations,
                    data.agents.usage_stats.monthly_conversations
                ],
                title: 'Conversas por Período'
            });
        }
    }
    
    // Display Performance Report
    if (data.performance) {
        updateReportCard('system-uptime-card', `${data.performance.system_uptime}%`, 'Uptime');
        updateReportCard('response-time-card', `${data.performance.average_response_time}ms`, 'Tempo Resposta');
        updateReportCard('error-rate-card', `${data.performance.error_rate}%`, 'Taxa de Erro');
        updateReportCard('cache-hit-rate-card', `${data.performance.database_performance.cache_hit_rate}%`, 'Cache Hit Rate');
        
        // Server Metrics Chart
        if (data.performance.server_metrics) {
            createRadarChart('server-metrics-chart', {
                labels: ['CPU', 'Memória', 'Disco', 'Rede'],
                data: [
                    data.performance.server_metrics.cpu_usage,
                    data.performance.server_metrics.memory_usage,
                    data.performance.server_metrics.disk_usage,
                    data.performance.server_metrics.network_io
                ],
                title: 'Métricas do Servidor'
            });
        }
    }
}

// Helper functions for reports
function updateReportCard(cardId, value, label) {
    const card = document.getElementById(cardId);
    if (card) {
        const valueElement = card.querySelector('.report-value');
        const labelElement = card.querySelector('.report-label');
        
        if (valueElement) valueElement.textContent = value;
        if (labelElement) labelElement.textContent = label;
    }
}

function displayTopPerformersTable(performers) {
    const tableBody = document.querySelector('#top-performers-table');
    if (tableBody) {
        tableBody.innerHTML = '';
        performers.forEach((performer, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${index + 1}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${performer.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${performer.conversations.toLocaleString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        ${performer.conversion_rate}%
                    </span>
                </td>
            `;
            tableBody.appendChild(row);
        });
    }
}

// Chart creation functions
function createLineChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: config.labels,
            datasets: [{
                label: config.title,
                data: config.data,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: config.title
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createBarChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: config.labels,
            datasets: [{
                label: config.title,
                data: config.data,
                backgroundColor: 'rgba(59, 130, 246, 0.8)',
                borderColor: 'rgb(59, 130, 246)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: config.title
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function createDoughnutChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: config.labels,
            datasets: [{
                data: config.data,
                backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(139, 92, 246, 0.8)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: config.title
                },
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function createRadarChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: config.labels,
            datasets: [{
                label: config.title,
                data: config.data,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                borderColor: 'rgb(59, 130, 246)',
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgb(59, 130, 246)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: config.title
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

// Export functions
async function exportReport(reportType, format = 'pdf') {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/reports/export/${reportType}?format=${format}`, {
            headers: { Authorization: `Bearer ${authToken}` },
            responseType: 'blob'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.${format}`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        alert('Relatório exportado com sucesso!');
    } catch (error) {
        console.error('Erro ao exportar relatório:', error);
        alert('Erro ao exportar relatório: ' + (error.response?.data?.message || error.message));
    }
}

// Make functions globally available
window.loadReportsData = loadReportsData;
window.exportReport = exportReport;

// Load Support Data
async function loadSupportData() {
    try {
        const [ticketsResponse, supportStatsResponse] = await Promise.all([
            axios.get(`${API_BASE_URL}/admin/support/tickets`, {
                headers: { Authorization: `Bearer ${authToken}` }
            }),
            axios.get(`${API_BASE_URL}/admin/support/stats`, {
                headers: { Authorization: `Bearer ${authToken}` }
            })
        ]);
        
        if (ticketsResponse.data.success && supportStatsResponse.data.success) {
            displaySupportData({
                tickets: ticketsResponse.data.data,
                stats: supportStatsResponse.data.data
            });
        }
    } catch (error) {
        console.error('Erro ao carregar dados de suporte:', error);
        // Fallback to mock data
        displaySupportData({
            tickets: [
                {
                    id: 1,
                    subject: 'Problema com integração WhatsApp',
                    user_name: 'João Silva',
                    user_email: 'joao@empresa.com',
                    status: 'open',
                    priority: 'high',
                    category: 'technical',
                    created_at: '2024-01-15T10:30:00Z',
                    updated_at: '2024-01-15T14:20:00Z',
                    messages_count: 3
                },
                {
                    id: 2,
                    subject: 'Dúvida sobre planos de assinatura',
                    user_name: 'Maria Santos',
                    user_email: 'maria@loja.com',
                    status: 'in_progress',
                    priority: 'medium',
                    category: 'billing',
                    created_at: '2024-01-14T16:45:00Z',
                    updated_at: '2024-01-15T09:15:00Z',
                    messages_count: 5
                },
                {
                    id: 3,
                    subject: 'Solicitação de novo recurso',
                    user_name: 'Pedro Costa',
                    user_email: 'pedro@startup.com',
                    status: 'resolved',
                    priority: 'low',
                    category: 'feature_request',
                    created_at: '2024-01-13T11:20:00Z',
                    updated_at: '2024-01-14T15:30:00Z',
                    messages_count: 8
                },
                {
                    id: 4,
                    subject: 'Erro ao criar novo agente',
                    user_name: 'Ana Oliveira',
                    user_email: 'ana@consultoria.com',
                    status: 'open',
                    priority: 'high',
                    category: 'technical',
                    created_at: '2024-01-15T08:15:00Z',
                    updated_at: '2024-01-15T08:15:00Z',
                    messages_count: 1
                },
                {
                    id: 5,
                    subject: 'Como configurar webhook',
                    user_name: 'Carlos Ferreira',
                    user_email: 'carlos@tech.com',
                    status: 'in_progress',
                    priority: 'medium',
                    category: 'support',
                    created_at: '2024-01-12T14:30:00Z',
                    updated_at: '2024-01-15T11:45:00Z',
                    messages_count: 12
                }
            ],
            stats: {
                total_tickets: 156,
                open_tickets: 23,
                in_progress_tickets: 18,
                resolved_tickets: 115,
                average_response_time: 2.4,
                customer_satisfaction: 4.7,
                tickets_by_category: {
                    technical: 45,
                    billing: 32,
                    support: 28,
                    feature_request: 51
                },
                tickets_by_priority: {
                    high: 12,
                    medium: 29,
                    low: 115
                }
            }
        });
    }
}

function displaySupportData(data) {
    // Display support stats
    if (data.stats) {
        updateSupportCard('total-tickets-card', data.stats.total_tickets, 'Total de Tickets');
        updateSupportCard('open-tickets-card', data.stats.open_tickets, 'Tickets Abertos');
        updateSupportCard('avg-response-time-card', `${data.stats.average_response_time}h`, 'Tempo Médio Resposta');
        updateSupportCard('satisfaction-card', data.stats.customer_satisfaction, 'Satisfação');
    }
    
    // Display tickets table
    if (data.tickets) {
        displayTicketsTable(data.tickets);
    }
}

function updateSupportCard(cardId, value, label) {
    const card = document.getElementById(cardId);
    if (card) {
        const valueElement = card.querySelector('.support-value');
        const labelElement = card.querySelector('.support-label');
        
        if (valueElement) valueElement.textContent = value;
        if (labelElement) labelElement.textContent = label;
    }
}

function displayTicketsTable(tickets) {
    const tableBody = document.querySelector('#tickets-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    tickets.forEach(ticket => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        const createdDate = new Date(ticket.created_at).toLocaleDateString('pt-BR');
        const updatedDate = new Date(ticket.updated_at).toLocaleDateString('pt-BR');
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                #${ticket.id}
            </td>
            <td class="px-6 py-4 text-sm text-gray-900">
                <div class="font-medium">${ticket.subject}</div>
                <div class="text-gray-500">${ticket.user_name} (${ticket.user_email})</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(ticket.status)}">
                    ${getStatusLabel(ticket.status)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityClass(ticket.priority)}">
                    ${getPriorityLabel(ticket.priority)}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${getCategoryLabel(ticket.category)}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${ticket.messages_count}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                <div>${createdDate}</div>
                <div class="text-xs text-gray-400">Atualizado: ${updatedDate}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button onclick="viewTicketDetails(${ticket.id})" class="text-indigo-600 hover:text-indigo-900 mr-3">
                    Ver
                </button>
                <button onclick="respondToTicket(${ticket.id})" class="text-green-600 hover:text-green-900 mr-3">
                    Responder
                </button>
                <button onclick="closeTicket(${ticket.id})" class="text-red-600 hover:text-red-900">
                    Fechar
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Helper functions for support
function getStatusClass(status) {
    switch (status) {
        case 'open': return 'bg-red-100 text-red-800';
        case 'in_progress': return 'bg-yellow-100 text-yellow-800';
        case 'resolved': return 'bg-green-100 text-green-800';
        case 'closed': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getStatusLabel(status) {
    switch (status) {
        case 'open': return 'Aberto';
        case 'in_progress': return 'Em Andamento';
        case 'resolved': return 'Resolvido';
        case 'closed': return 'Fechado';
        default: return 'Desconhecido';
    }
}

function getPriorityClass(priority) {
    switch (priority) {
        case 'high': return 'bg-red-100 text-red-800';
        case 'medium': return 'bg-yellow-100 text-yellow-800';
        case 'low': return 'bg-green-100 text-green-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

function getPriorityLabel(priority) {
    switch (priority) {
        case 'high': return 'Alta';
        case 'medium': return 'Média';
        case 'low': return 'Baixa';
        default: return 'Normal';
    }
}

function getCategoryLabel(category) {
    switch (category) {
        case 'technical': return 'Técnico';
        case 'billing': return 'Faturamento';
        case 'support': return 'Suporte';
        case 'feature_request': return 'Novo Recurso';
        default: return 'Geral';
    }
}

// Support management functions
async function viewTicketDetails(ticketId) {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/support/tickets/${ticketId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            // Show ticket details modal
            showTicketDetailsModal(response.data.data);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes do ticket:', error);
        alert('Erro ao carregar detalhes do ticket: ' + (error.response?.data?.message || error.message));
    }
}

async function respondToTicket(ticketId) {
    const response = prompt('Digite sua resposta:');
    if (!response) return;
    
    try {
        const result = await axios.post(`${API_BASE_URL}/admin/support/tickets/${ticketId}/respond`, {
            message: response
        }, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (result.data.success) {
            alert('Resposta enviada com sucesso!');
            loadSupportData(); // Reload data
        }
    } catch (error) {
        console.error('Erro ao responder ticket:', error);
        alert('Erro ao responder ticket: ' + (error.response?.data?.message || error.message));
    }
}

async function closeTicket(ticketId) {
    if (!confirm('Tem certeza que deseja fechar este ticket?')) return;
    
    try {
        const response = await axios.patch(`${API_BASE_URL}/admin/support/tickets/${ticketId}/close`, {}, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            alert('Ticket fechado com sucesso!');
            loadSupportData(); // Reload data
        }
    } catch (error) {
        console.error('Erro ao fechar ticket:', error);
        alert('Erro ao fechar ticket: ' + (error.response?.data?.message || error.message));
    }
}

async function showTicketDetailsModal(ticketId) {
    try {
        const response = await axios.get(`${API_BASE_URL}/admin/support/tickets/${ticketId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        if (response.data.success) {
            const ticket = response.data.ticket;
            // Create and show a proper modal with ticket details
            const modalContent = `
                <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="ticket-modal">
                    <div class="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
                        <div class="mt-3">
                            <h3 class="text-lg font-medium text-gray-900 mb-4">Detalhes do Ticket #${ticket.id}</h3>
                            <div class="space-y-3">
                                <p><strong>Assunto:</strong> ${ticket.subject}</p>
                                <p><strong>Usuário:</strong> ${ticket.user_name}</p>
                                <p><strong>Status:</strong> ${getStatusLabel(ticket.status)}</p>
                                <p><strong>Prioridade:</strong> ${getPriorityLabel(ticket.priority)}</p>
                                <p><strong>Categoria:</strong> ${getCategoryLabel(ticket.category)}</p>
                                <p><strong>Descrição:</strong> ${ticket.description || 'N/A'}</p>
                                <p><strong>Criado em:</strong> ${new Date(ticket.created_at).toLocaleString('pt-BR')}</p>
                            </div>
                            <div class="flex justify-end mt-6">
                                <button onclick="closeTicketModal()" class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">Fechar</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalContent);
        }
    } catch (error) {
        console.error('Erro ao carregar detalhes do ticket:', error);
        alert('Erro ao carregar detalhes do ticket: ' + (error.response?.data?.message || error.message));
    }
}

function closeTicketModal() {
    const modal = document.getElementById('ticket-modal');
    if (modal) {
        modal.remove();
    }
}

// Make support functions globally available
window.loadSupportData = loadSupportData;
window.viewTicketDetails = viewTicketDetails;
window.respondToTicket = respondToTicket;
window.closeTicket = closeTicket;

// Auto-refresh data every 2 minutes (reduced frequency due to real-time updates)
setInterval(() => {
    if (authToken && document.getElementById('dashboard').style.display !== 'none') {
        const activeTab = document.querySelector('.tab-button.active');
        if (activeTab) {
            const tabName = activeTab.id.replace('tab-', '');
            showTab(tabName);
        }
    }
}, 120000); // 2 minutes instead of 30 seconds

// Auto-refresh dashboard data every 2 minutes
// (Initialization is handled earlier in the file)

// ===== MODAL DE DETALHES DO USUÁRIO =====

// Variável global para armazenar o ID do usuário atual no modal
let currentUserModalId = null;

// Função para abrir o modal de detalhes do usuário
function openUserDetailsModal(userId) {
    currentUserModalId = userId;
    document.getElementById('userDetailsModal').classList.remove('hidden');
    showUserTab('general');
    loadUserDetailsData(userId);
}

// Função para fechar o modal de detalhes do usuário
function closeUserDetailsModal() {
    document.getElementById('userDetailsModal').classList.add('hidden');
    currentUserModalId = null;
}

// Função para alternar entre as abas do modal
function showUserTab(tabName) {
    // Esconder todas as abas
    const tabContents = document.querySelectorAll('.user-tab-content');
    tabContents.forEach(tab => tab.classList.add('hidden'));
    
    // Remover classe ativa de todos os botões
    const tabButtons = document.querySelectorAll('.user-tab-btn');
    tabButtons.forEach(btn => {
        btn.classList.remove('border-blue-500', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-gray-500');
    });
    
    // Mostrar aba selecionada
    document.getElementById(`user-tab-${tabName}`).classList.remove('hidden');
    
    // Ativar botão da aba selecionada
    const activeBtn = document.getElementById(`tab-${tabName}`);
    activeBtn.classList.remove('border-transparent', 'text-gray-500');
    activeBtn.classList.add('border-blue-500', 'text-blue-600');
    
    // Carregar dados específicos da aba se necessário
    if (currentUserModalId) {
        switch(tabName) {
            case 'agents':
                loadUserAgents(currentUserModalId);
                break;
            case 'conversations':
                loadUserConversations(currentUserModalId);
                break;
            case 'settings':
                loadUserSettings(currentUserModalId);
                break;
            case 'activity':
                loadUserActivity(currentUserModalId);
                break;
        }
    }
}

// Função para carregar dados completos do usuário
function loadUserDetailsData(userId) {
    axios.get(`${API_BASE_URL}/admin/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
        .then(response => {
            if (response.data.success) {
                const userData = response.data.data;
                populateUserGeneralInfo(userData);
            } else {
                alert('Erro ao carregar dados do usuário: ' + response.data.message);
            }
        })
        .catch(error => {
            console.error('Erro ao carregar dados do usuário:', error);
            alert('Erro ao carregar dados do usuário');
        });
}

// Função para popular informações gerais do usuário
function populateUserGeneralInfo(userData) {
    const user = userData.user;
    
    document.getElementById('user-name').textContent = user.name || '-';
    document.getElementById('user-email').textContent = user.email || '-';
    document.getElementById('user-phone').textContent = user.phone || '-';
    document.getElementById('user-plan').textContent = user.plan || '-';
    document.getElementById('user-created').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : '-';
    
    // Status do usuário
    const statusElement = document.getElementById('user-status');
    statusElement.textContent = user.status || 'Ativo';
    statusElement.className = `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
        user.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`;
    
    // Informações de assinatura
    document.getElementById('subscription-status').textContent = user.subscription_status || 'Ativa';
    document.getElementById('subscription-expires').textContent = user.subscription_expires ? 
        new Date(user.subscription_expires).toLocaleDateString('pt-BR') : '-';
    document.getElementById('subscription-price').textContent = user.subscription_price ? 
        `R$ ${user.subscription_price}` : '-';
}

// Função para carregar agentes do usuário
function loadUserAgents(userId) {
    const tableBody = document.getElementById('user-agents-table');
    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Carregando agentes...</td></tr>';
    
    // Usar dados reais dos agentes se disponível
    if (currentUserModalId) {
        axios.get(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
            .then(response => {
                if (response.data.success && response.data.data.agents) {
                    const agents = response.data.data.agents;
                    
                    if (agents.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Nenhum agente encontrado</td></tr>';
                        return;
                    }
                    
                    tableBody.innerHTML = agents.map(agent => `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${agent.name || 'Agente'}</td>
                            <td class="px-6 py-4 whitespace-nowrap">
                                <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                    agent.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }">${agent.status === 'connected' ? 'Conectado' : 'Desconectado'}</span>
                            </td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${agent.last_activity || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button onclick="editAgent(${agent.id})" class="text-blue-600 hover:text-blue-900 mr-2">Editar</button>
                                <button onclick="deleteAgent(${agent.id})" class="text-red-600 hover:text-red-900">Excluir</button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4">Nenhum agente encontrado</td></tr>';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar agentes:', error);
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-red-600">Erro ao carregar agentes</td></tr>';
            });
    }
}

// Função para carregar conversas do usuário
function loadUserConversations(userId) {
    const tableBody = document.getElementById('user-conversations-table');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Carregando conversas...</td></tr>';
    
    // Usar dados reais das conversas se disponível
    if (currentUserModalId) {
        axios.get(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
            .then(response => {
                if (response.data.success && response.data.data.conversations) {
                    const conversations = response.data.data.conversations;
                    
                    if (conversations.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhuma conversa encontrada</td></tr>';
                        return;
                    }
                    
                    tableBody.innerHTML = conversations.map(conv => `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${conv.contact || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${conv.agent_name || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${conv.last_message || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${conv.updated_at ? new Date(conv.updated_at).toLocaleString('pt-BR') : '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <button onclick="viewConversation(${conv.id})" class="text-blue-600 hover:text-blue-900">Ver</button>
                            </td>
                        </tr>
                    `).join('');
                } else {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhuma conversa encontrada</td></tr>';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar conversas:', error);
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-600">Erro ao carregar conversas</td></tr>';
            });
    }
}

// Função para carregar configurações do usuário
function loadUserSettings(userId) {
    // Usar dados reais das configurações se disponível
    if (currentUserModalId) {
        axios.get(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
            .then(response => {
                if (response.data.success && response.data.data.settings) {
                    const settings = response.data.data.settings;
                    
                    document.getElementById('setting-agent-limit').value = settings.agent_limit || '5';
                    document.getElementById('setting-message-limit').value = settings.message_limit || '10000';
                    document.getElementById('setting-webhook-url').value = settings.webhook_url || '';
                    document.getElementById('setting-api-key').value = settings.api_key || '';
                    document.getElementById('setting-auto-reply').checked = settings.auto_reply || false;
                    document.getElementById('setting-notifications').checked = settings.notifications || false;
                    document.getElementById('setting-analytics').checked = settings.analytics || false;
                } else {
                    // Valores padrão
                    document.getElementById('setting-agent-limit').value = '5';
                    document.getElementById('setting-message-limit').value = '10000';
                    document.getElementById('setting-webhook-url').value = '';
                    document.getElementById('setting-api-key').value = '';
                    document.getElementById('setting-auto-reply').checked = false;
                    document.getElementById('setting-notifications').checked = false;
                    document.getElementById('setting-analytics').checked = false;
                }
            })
            .catch(error => {
                console.error('Erro ao carregar configurações:', error);
                // Valores padrão em caso de erro
                document.getElementById('setting-agent-limit').value = '5';
                document.getElementById('setting-message-limit').value = '10000';
                document.getElementById('setting-webhook-url').value = '';
                document.getElementById('setting-api-key').value = '';
                document.getElementById('setting-auto-reply').checked = false;
                document.getElementById('setting-notifications').checked = false;
                document.getElementById('setting-analytics').checked = false;
            });
    }
}

// Função para carregar atividade do usuário
function loadUserActivity(userId) {
    const tableBody = document.getElementById('user-activity-table');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Carregando atividade...</td></tr>';
    
    // Usar dados reais da atividade se disponível
    if (currentUserModalId) {
        axios.get(`${API_BASE_URL}/admin/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
            .then(response => {
                if (response.data.success && response.data.data.activity) {
                    const activities = response.data.data.activity;
                    
                    if (activities.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhuma atividade encontrada</td></tr>';
                        return;
                    }
                    
                    tableBody.innerHTML = activities.map(activity => `
                        <tr>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${activity.created_at ? new Date(activity.created_at).toLocaleString('pt-BR') : '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${activity.action || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${activity.resource || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${activity.details || '-'}</td>
                            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${activity.ip_address || '-'}</td>
                        </tr>
                    `).join('');
                } else {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Nenhuma atividade encontrada</td></tr>';
                }
            })
            .catch(error => {
                console.error('Erro ao carregar atividade:', error);
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-red-600">Erro ao carregar atividade</td></tr>';
            });
    }
}

// Funções auxiliares para ações do modal
function editUserInfo() {
    if (!currentUserModalId) {
        alert('Erro: ID do usuário não encontrado');
        return;
    }
    
    // Criar modal de edição
    const editModal = document.createElement('div');
    editModal.className = 'modal fade';
    editModal.id = 'editUserModal';
    editModal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Editar Usuário</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="editUserForm">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Nome</label>
                                    <input type="text" class="form-control" id="edit-user-name" required>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Email</label>
                                    <input type="email" class="form-control" id="edit-user-email" required>
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Empresa</label>
                                    <input type="text" class="form-control" id="edit-user-company">
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Telefone</label>
                                    <input type="text" class="form-control" id="edit-user-phone">
                                </div>
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Plano</label>
                                    <select class="form-select" id="edit-user-plan">
                                        <option value="free">Gratuito</option>
                                        <option value="basic">Básico</option>
                                        <option value="pro">Pro</option>
                                        <option value="enterprise">Enterprise</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Status</label>
                                    <select class="form-select" id="edit-user-status">
                                        <option value="1">Ativo</option>
                                        <option value="0">Inativo</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="saveUserChanges()">Salvar Alterações</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(editModal);
    
    // Carregar dados atuais do usuário
    loadCurrentUserData();
    
    // Mostrar modal
    const modal = new bootstrap.Modal(editModal);
    modal.show();
    
    // Remover modal quando fechado
    editModal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(editModal);
    });
}

// Função para carregar dados atuais do usuário no formulário de edição
function loadCurrentUserData() {
    axios.get(`${API_BASE_URL}/admin/users/${currentUserModalId}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(response => {
        if (response.data.success) {
            const user = response.data.data.user;
            document.getElementById('edit-user-name').value = user.name || '';
            document.getElementById('edit-user-email').value = user.email || '';
            document.getElementById('edit-user-company').value = user.company || '';
            document.getElementById('edit-user-phone').value = user.phone || '';
            document.getElementById('edit-user-plan').value = user.plan || 'free';
            document.getElementById('edit-user-status').value = user.is_active ? '1' : '0';
        }
    })
    .catch(error => {
        console.error('Erro ao carregar dados do usuário:', error);
        alert('Erro ao carregar dados do usuário');
    });
}

// Função para salvar alterações do usuário
function saveUserChanges() {
    const formData = {
        name: document.getElementById('edit-user-name').value,
        email: document.getElementById('edit-user-email').value,
        company: document.getElementById('edit-user-company').value,
        phone: document.getElementById('edit-user-phone').value,
        plan: document.getElementById('edit-user-plan').value,
        is_active: document.getElementById('edit-user-status').value === '1'
    };
    
    axios.put(`${API_BASE_URL}/admin/users/${currentUserModalId}`, formData, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(response => {
        if (response.data.success) {
            alert('Usuário atualizado com sucesso!');
            // Fechar modal de edição
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editUserModal'));
            editModal.hide();
            // Recarregar dados do modal principal
            loadUserDetailsData(currentUserModalId);
            // Recarregar lista de usuários
            loadUsersData();
        } else {
            alert('Erro ao atualizar usuário: ' + response.data.error);
        }
    })
    .catch(error => {
        console.error('Erro ao atualizar usuário:', error);
        alert('Erro ao atualizar usuário');
    });
}

function resetUserPassword() {
    if (currentUserModalId && confirm('Tem certeza que deseja resetar a senha deste usuário?')) {
        performResetPassword(currentUserModalId);
    }
}

function addNewAgent() {
    alert('Funcionalidade de adicionar agente será implementada em breve');
}

function editAgent(agentId) {
    if (!currentUserModalId || !agentId) {
        alert('Erro: Dados do agente não encontrados');
        return;
    }
    
    // Criar modal de edição de agente
    const editAgentModal = document.createElement('div');
    editAgentModal.className = 'modal fade';
    editAgentModal.id = 'editAgentModal';
    editAgentModal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Editar Agente</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="editAgentForm">
                        <div class="mb-3">
                            <label class="form-label">Nome do Agente</label>
                            <input type="text" class="form-control" id="edit-agent-name" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Descrição</label>
                            <textarea class="form-control" id="edit-agent-description" rows="3"></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Personalidade</label>
                            <textarea class="form-control" id="edit-agent-personality" rows="4" placeholder="Descreva a personalidade do agente..."></textarea>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Instruções</label>
                            <textarea class="form-control" id="edit-agent-instructions" rows="4" placeholder="Instruções específicas para o agente..."></textarea>
                        </div>
                        <div class="row">
                            <div class="col-md-4">
                                <div class="mb-3">
                                    <label class="form-label">Modelo</label>
                                    <select class="form-select" id="edit-agent-model">
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                        <option value="gpt-4">GPT-4</option>
                                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="mb-3">
                                    <label class="form-label">Temperatura</label>
                                    <input type="number" class="form-control" id="edit-agent-temperature" min="0" max="2" step="0.1" value="0.7">
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="mb-3">
                                    <label class="form-label">Max Tokens</label>
                                    <input type="number" class="form-control" id="edit-agent-max-tokens" min="1" max="4000" value="1000">
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="edit-agent-active" checked>
                                <label class="form-check-label" for="edit-agent-active">
                                    Agente Ativo
                                </label>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="saveAgentChanges('${agentId}')">Salvar Alterações</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(editAgentModal);
    
    // Carregar dados atuais do agente
    loadCurrentAgentData(agentId);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(editAgentModal);
    modal.show();
    
    // Remover modal quando fechado
    editAgentModal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(editAgentModal);
    });
}

// Função para carregar dados atuais do agente
function loadCurrentAgentData(agentId) {
    // Buscar o agente na lista atual
    const agentRow = document.querySelector(`[data-agent-id="${agentId}"]`);
    if (agentRow) {
        const cells = agentRow.querySelectorAll('td');
        if (cells.length >= 4) {
            document.getElementById('edit-agent-name').value = cells[0].textContent.trim();
            document.getElementById('edit-agent-description').value = cells[1].textContent.trim();
            // Valores padrão para campos não visíveis na tabela
            document.getElementById('edit-agent-personality').value = '';
            document.getElementById('edit-agent-instructions').value = '';
            document.getElementById('edit-agent-model').value = 'gpt-3.5-turbo';
            document.getElementById('edit-agent-temperature').value = '0.7';
            document.getElementById('edit-agent-max-tokens').value = '1000';
            document.getElementById('edit-agent-active').checked = cells[2].textContent.trim() === 'Ativo';
        }
    }
}

// Função para salvar alterações do agente
function saveAgentChanges(agentId) {
    const formData = {
        name: document.getElementById('edit-agent-name').value,
        description: document.getElementById('edit-agent-description').value,
        personality: document.getElementById('edit-agent-personality').value,
        instructions: document.getElementById('edit-agent-instructions').value,
        model: document.getElementById('edit-agent-model').value,
        temperature: parseFloat(document.getElementById('edit-agent-temperature').value),
        max_tokens: parseInt(document.getElementById('edit-agent-max-tokens').value),
        is_active: document.getElementById('edit-agent-active').checked
    };
    
    axios.put(`${API_BASE_URL}/admin/users/${currentUserModalId}/agents/${agentId}`, formData, {
        headers: { 'Authorization': `Bearer ${authToken}` }
    })
    .then(response => {
        if (response.data.success) {
            alert('Agente atualizado com sucesso!');
            // Fechar modal de edição
            const editModal = bootstrap.Modal.getInstance(document.getElementById('editAgentModal'));
            editModal.hide();
            // Recarregar dados dos agentes
            loadUserAgents(currentUserModalId);
        } else {
            alert('Erro ao atualizar agente: ' + response.data.error);
        }
    })
    .catch(error => {
        console.error('Erro ao atualizar agente:', error);
        alert('Erro ao atualizar agente');
    });
}

function deleteAgent(agentId) {
    if (!currentUserModalId || !agentId) {
        alert('Erro: Dados do agente não encontrados');
        return;
    }
    
    if (confirm('Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.')) {
        axios.delete(`${API_BASE_URL}/admin/users/${currentUserModalId}/agents/${agentId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        })
        .then(response => {
            if (response.data.success) {
                alert('Agente excluído com sucesso!');
                // Recarregar dados dos agentes
                loadUserAgents(currentUserModalId);
            } else {
                alert('Erro ao excluir agente: ' + response.data.error);
            }
        })
        .catch(error => {
            console.error('Erro ao excluir agente:', error);
            alert('Erro ao excluir agente');
        });
    }
}

function viewConversation(conversationId) {
    alert(`Ver conversa ${conversationId} - funcionalidade será implementada em breve`);
}

function resetUserSettings() {
    if (confirm('Tem certeza que deseja restaurar as configurações padrão?')) {
        loadUserSettings(currentUserModalId);
    }
}

// Event listener para o formulário de configurações do usuário
document.addEventListener('DOMContentLoaded', function() {
    const settingsForm = document.getElementById('user-settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!currentUserModalId) {
                alert('Erro: ID do usuário não encontrado');
                return;
            }
            
            const formData = {
                agent_limit: parseInt(document.getElementById('setting-agent-limit').value),
                message_limit: parseInt(document.getElementById('setting-message-limit').value),
                webhook_url: document.getElementById('setting-webhook-url').value,
                api_key: document.getElementById('setting-api-key').value,
                auto_reply: document.getElementById('setting-auto-reply').checked,
                notifications: document.getElementById('setting-notifications').checked,
                analytics: document.getElementById('setting-analytics').checked
            };
            
            // Salvar configurações via API
            axios.put(`${API_BASE_URL}/admin/users/${currentUserModalId}/settings`, formData, {
                headers: { 'Authorization': `Bearer ${authToken}` }
            })
                .then(response => {
                    if (response.data.success) {
                        alert('Configurações salvas com sucesso!');
                    } else {
                        alert('Erro ao salvar configurações: ' + response.data.message);
                    }
                })
                .catch(error => {
                    console.error('Erro ao salvar configurações:', error);
                    alert('Erro ao salvar configurações');
                });
        });
    }
});

// Tornar funções globais
window.openUserDetailsModal = openUserDetailsModal;
window.closeUserDetailsModal = closeUserDetailsModal;
window.showUserTab = showUserTab;
window.editUserInfo = editUserInfo;
window.resetUserPassword = resetUserPassword;
window.addNewAgent = addNewAgent;
window.editAgent = editAgent;
window.deleteAgent = deleteAgent;
window.viewConversation = viewConversation;
window.resetUserSettings = resetUserSettings;