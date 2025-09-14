// Configuração dinâmica da URL da API baseada no ambiente
const getApiBaseUrl = () => {
  // Verificar se está em produção
  if (process.env.NODE_ENV === 'production') {
    return process.env.REACT_APP_API_URL || window.location.origin + '/api';
  }
  
  // Desenvolvimento - verificar variável de ambiente ou usar padrão
  return process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
};

const API_BASE_URL = getApiBaseUrl();

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Sempre sincronizar token com localStorage antes da requisição
    this.token = localStorage.getItem('token');
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          window.location.href = '/login';
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Generic HTTP methods
  async get<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // Auth methods
  async login(email: string, password: string): Promise<ApiResponse> {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (data.success && data.token) {
      this.setToken(data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return {
      success: data.success,
      message: data.message,
      data: {
        user: data.user,
        token: data.token
      },
      error: data.error
    };
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  refreshToken() {
    this.token = localStorage.getItem('token');
  }

  async register(userData: any): Promise<ApiResponse> {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (data.success && data.token) {
      this.token = data.token;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  }

  async getProfile(): Promise<ApiResponse> {
    return this.request('/auth/profile');
  }

  async updateProfile(userData: any): Promise<ApiResponse> {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  // Agent methods
  async getAgents(): Promise<ApiResponse> {
    return this.request('/agents');
  }

  async createAgent(agentData: any): Promise<ApiResponse> {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(agentData),
    });
  }

  async updateAgent(id: string, agentData: any): Promise<ApiResponse> {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(agentData),
    });
  }

  async deleteAgent(id: string): Promise<ApiResponse> {
    return this.request(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  async getAgentStats(): Promise<ApiResponse> {
    return this.request('/agents/stats');
  }

  // Conversation methods
  async getConversations(filters: any = {}): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) queryParams.append(key, filters[key]);
    });
    
    return this.request(`/conversations?${queryParams}`);
  }

  async getConversation(id: string): Promise<ApiResponse> {
    return this.request(`/conversations/${id}`);
  }

  async createConversation(conversationData: any): Promise<ApiResponse> {
    return this.request('/conversations', {
      method: 'POST',
      body: JSON.stringify(conversationData),
    });
  }

  async getConversationStats(): Promise<ApiResponse> {
    return this.request('/conversations/stats');
  }

  async getConversationMessages(conversationId: string, limit: number = 50, offset: number = 0): Promise<ApiResponse> {
    return this.request(`/chat/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
  }

  async sendMessage(conversationId: string, message: string, agentId?: string): Promise<ApiResponse> {
    // Forçar sincronização do token
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          conversationId, 
          message,
          agentId 
        })
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
          window.location.href = '/login';
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Admin methods
  async getDashboardStats(): Promise<ApiResponse> {
    return this.request('/admin/dashboard');
  }

  async getAllUsers(filters: any = {}): Promise<ApiResponse> {
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined) queryParams.append(key, filters[key]);
    });
    
    return this.request(`/admin/users?${queryParams}`);
  }

  async createUser(userData: any): Promise<ApiResponse> {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: any): Promise<ApiResponse> {
    return this.request(`/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse> {
    return this.request(`/admin/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Utility methods
  isAuthenticated(): boolean {
    // Sempre sincronizar com localStorage
    this.token = localStorage.getItem('token');
    return !!this.token;
  }

  getCurrentUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
}

export const apiService = new ApiService();
export const api = apiService;
export default apiService;