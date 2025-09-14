import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../../services/api';

interface Message {
  id: number;
  platform: string;
  user_id: string;
  chat_id: string;
  message: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
}

interface Analytics {
  platform: string;
  date: string;
  messages_received: number;
  messages_sent: number;
  unique_users: number;
}

const IntegrationAnalytics: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'messages' | 'analytics'>('messages');
  const [filters, setFilters] = useState({
    platform: '',
    startDate: '',
    endDate: '',
    userId: ''
  });
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0
  });

  const platformNames = {
    telegram: 'Telegram',
    instagram: 'Instagram',
    facebook_messenger: 'Facebook Messenger',
    email: 'Email',
    whatsapp: 'WhatsApp'
  };

  const platformColors = {
    telegram: 'bg-blue-100 text-blue-800',
    instagram: 'bg-pink-100 text-pink-800',
    facebook_messenger: 'bg-indigo-100 text-indigo-800',
    email: 'bg-green-100 text-green-800',
    whatsapp: 'bg-emerald-100 text-emerald-800'
  };

  useEffect(() => {
    if (activeTab === 'messages') {
      fetchMessages();
    } else {
      fetchAnalytics();
    }
  }, [activeTab, filters, pagination]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.userId) params.append('userId', filters.userId);
      params.append('limit', pagination.limit.toString());
      params.append('offset', pagination.offset.toString());

      const response = await apiService.get(`/integrations/messages?${params}`);
      if (response.success) {
        setMessages(response.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      if (filters.platform) params.append('platform', filters.platform);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);

      const response = await apiService.get(`/integrations/analytics?${params}`);
      if (response.success) {
        setAnalytics(response.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, offset: 0 })); // Reset pagination
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getTotalStats = () => {
    if (analytics.length === 0) return { sent: 0, received: 0, users: 0 };
    
    return analytics.reduce((acc, item) => ({
      sent: acc.sent + item.messages_sent,
      received: acc.received + item.messages_received,
      users: acc.users + item.unique_users
    }), { sent: 0, received: 0, users: 0 });
  };

  const renderMessages = () => (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center space-x-4">
          <FunnelIcon className="h-5 w-5 text-gray-500" />
          <select
            value={filters.platform}
            onChange={(e) => handleFilterChange('platform', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as plataformas</option>
            {Object.entries(platformNames).map(([key, name]) => (
              <option key={key} value={key}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="ID do usuário"
            value={filters.userId}
            onChange={(e) => handleFilterChange('userId', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Messages List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Mensagens Recentes</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Nenhuma mensagem encontrada
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        platformColors[message.platform as keyof typeof platformColors] || 'bg-gray-100 text-gray-800'
                      }`}>
                        {platformNames[message.platform as keyof typeof platformNames] || message.platform}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        message.direction === 'incoming' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {message.direction === 'incoming' ? 'Recebida' : 'Enviada'}
                      </span>
                      <span className="text-xs text-gray-500">
                        Usuário: {message.user_id}
                      </span>
                    </div>
                    <p className="text-gray-900 mb-2">{message.message}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(message.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Pagination */}
        {messages.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
            <button
              onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
              disabled={pagination.offset === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-700">
              Mostrando {pagination.offset + 1} - {pagination.offset + messages.length}
            </span>
            <button
              onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
              disabled={messages.length < pagination.limit}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderAnalytics = () => {
    const totalStats = getTotalStats();
    
    return (
      <div className="space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="h-5 w-5 text-gray-500" />
            <select
              value={filters.platform}
              onChange={(e) => handleFilterChange('platform', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todas as plataformas</option>
              {Object.entries(platformNames).map(([key, name]) => (
                <option key={key} value={key}>{name}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Mensagens Enviadas</p>
                <p className="text-2xl font-semibold text-gray-900">{totalStats.sent.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Mensagens Recebidas</p>
                <p className="text-2xl font-semibold text-gray-900">{totalStats.received.toLocaleString()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500">Usuários Únicos</p>
                <p className="text-2xl font-semibold text-gray-900">{totalStats.users.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Table */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Estatísticas por Plataforma</h3>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : analytics.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Nenhum dado encontrado para o período selecionado
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plataforma
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Enviadas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recebidas
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usuários
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          platformColors[item.platform as keyof typeof platformColors] || 'bg-gray-100 text-gray-800'
                        }`}>
                          {platformNames[item.platform as keyof typeof platformNames] || item.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(item.date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.messages_sent.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.messages_received.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.unique_users.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Analytics de Integrações</h2>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('messages')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'messages'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5 inline mr-2" />
            Mensagens
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'analytics'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <ChartBarIcon className="h-5 w-5 inline mr-2" />
            Analytics
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'messages' ? renderMessages() : renderAnalytics()}
    </div>
  );
};

export default IntegrationAnalytics;