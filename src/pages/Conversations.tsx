import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  UserIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Conversations: React.FC = () => {
  const { state, dispatch } = useApp();
  const { showError } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved' | 'pending'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiService.getConversations({
          limit: 50,
          offset: 0,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: searchTerm || undefined
        });
        
        if (response.success) {
          dispatch({ type: 'SET_CONVERSATIONS', payload: response.data.conversations || [] });
        } else {
          throw new Error(response.error || 'Erro ao carregar conversas');
        }
      } catch (error) {
        console.error('Erro ao carregar conversas:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar conversas';
        setError(errorMessage);
        showError('Erro ao carregar conversas', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, [dispatch, showError, statusFilter, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'resolved': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp': return '📱';
      case 'telegram': return '✈️';
      case 'web': return '🌐';
      case 'api': return '🔗';
      default: return '💬';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'HH:mm', { locale: ptBR });
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch {
      return '--/--/----';
    }
  };

  const handleConversationClick = async (conversation: any) => {
    setSelectedConversation(conversation);
    setShowConversationModal(true);
    setMessagesLoading(true);
    setConversationMessages([]);

    try {
      const response = await apiService.getConversationMessages(conversation.id);
      if (response.success) {
        setConversationMessages(response.data.messages || []);
      } else {
        showError('Erro ao carregar mensagens', response.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      showError('Erro ao carregar mensagens', 'Não foi possível carregar as mensagens da conversa');
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    // Check if user is authenticated
    if (!apiService.isAuthenticated()) {
      showError('Sessão Expirada', 'Faça login novamente para continuar.');
      return;
    }

    setSendingMessage(true);
    try {
      const response = await apiService.sendMessage(
        selectedConversation.id,
        newMessage.trim(),
        selectedConversation.agent_id
      );
      if (response.success) {
        // Adicionar as mensagens retornadas pela API (usuário e agente)
        const { userMessage, aiMessage } = response.data;
        const newMessages = [
          {
            id: userMessage.id,
            content: userMessage.content,
            sender: userMessage.sender,
            created_at: userMessage.timestamp
          },
          {
            id: aiMessage.id,
            content: aiMessage.content,
            sender: aiMessage.sender,
            response_time: aiMessage.response_time,
            created_at: aiMessage.timestamp
          }
        ];
        
        setConversationMessages(prev => [...prev, ...newMessages]);
        setNewMessage('');
      } else {
        showError('Erro ao enviar mensagem', response.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showError('Erro ao enviar mensagem', error.message || 'Não foi possível enviar a mensagem');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conversas</h1>
          <p className="text-gray-600">Gerencie todas as interações com clientes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Buscar conversas..."
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="resolved">Resolvido</option>
          <option value="pending">Pendente</option>
          <option value="closed">Fechado</option>
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando conversas...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => window.location.reload()}
              className="ml-auto px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Conversas</p>
              <p className="text-2xl font-bold text-gray-900">{state.conversations.length}</p>
            </div>
            <ChatBubbleLeftRightIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conversas Ativas</p>
              <p className="text-2xl font-bold text-green-600">
                {state.conversations.filter(c => c.status === 'active').length}
              </p>
            </div>
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tempo Médio</p>
              <p className="text-2xl font-bold text-yellow-600">
                {state.conversations.length > 0 
                  ? (state.conversations.reduce((sum, c) => sum + (c.avg_response_time || 0), 0) / state.conversations.length).toFixed(1)
                  : '0.0'
                }s
              </p>
            </div>
            <ClockIcon className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Satisfação</p>
              <p className="text-2xl font-bold text-purple-600">
                {state.conversations.filter(c => c.satisfaction_rating).length > 0
                  ? (state.conversations.reduce((sum, c) => sum + (c.satisfaction_rating || 0), 0) / 
                     state.conversations.filter(c => c.satisfaction_rating).length).toFixed(1)
                  : '0.0'
                }
              </p>
            </div>
            <div className="text-yellow-400 text-2xl">⭐</div>
          </div>
        </div>
      </div>

      {/* Conversations List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Conversas</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {state.conversations.map((conversation, index) => {
            const agent = state.agents.find(a => a.id === conversation.agent_id);
            
            return (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="p-6 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleConversationClick(conversation)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-gray-600" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900">
                          {conversation.customer_name || conversation.customer_phone || 'Cliente'}
                        </p>
                        <span className="text-lg">{getChannelIcon(conversation.channel_type)}</span>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(conversation.status)}`}>
                          {conversation.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {conversation.customer_email || conversation.customer_phone || 'Sem informações de contato'}
                      </p>
                      <div className="flex items-center space-x-4 mt-1">
                        <span className="text-xs text-gray-500">
                          Agente: {agent?.name || 'Não atribuído'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {conversation.message_count || 0} mensagens
                        </span>
                        {conversation.satisfaction_rating && (
                          <span className="text-xs text-yellow-600">
                            ⭐ {conversation.satisfaction_rating}/5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-1">
                    <span className="text-xs text-gray-500">
                      {formatDate(conversation.start_time)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(conversation.last_message_time || conversation.start_time)}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Empty State */}
      {!loading && state.conversations.length === 0 && (
        <div className="text-center py-12">
          <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma conversa encontrada</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchTerm ? 'Tente ajustar os filtros de busca.' : 'As conversas aparecerão aqui quando os clientes interagirem com seus agentes.'}
          </p>
        </div>
      )}

      {/* Modal de Conversa */}
      {showConversationModal && selectedConversation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {selectedConversation.customer_name || selectedConversation.customer_phone || 'Cliente'}
                  </h3>
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <span>{getChannelIcon(selectedConversation.channel_type)}</span>
                    <span>{selectedConversation.customer_email || selectedConversation.customer_phone}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(selectedConversation.status)}`}>
                      {selectedConversation.status}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowConversationModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Corpo do Modal - Mensagens */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Carregando mensagens...</p>
                  </div>
                </div>
              ) : conversationMessages.length > 0 ? (
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {conversationMessages.map((message, index) => {
                    const isOutbound = message.sender === 'agent' || message.direction === 'outbound';
                    return (
                      <div
                        key={message.id || index}
                        className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            isOutbound
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-200 text-gray-900'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${
                            isOutbound ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp || message.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhuma mensagem encontrada</h3>
                    <p className="mt-1 text-sm text-gray-500">Esta conversa ainda não possui mensagens.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer do Modal */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
                <div className="flex items-center space-x-4">
                  <span>Agente: {state.agents.find(a => a.id === selectedConversation.agent_id)?.name || 'Não atribuído'}</span>
                  <span>{conversationMessages.length} mensagens</span>
                  {selectedConversation.satisfaction_rating && (
                    <span className="text-yellow-600">
                      ⭐ {selectedConversation.satisfaction_rating}/5
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <span>Iniciada em: {formatDate(selectedConversation.start_time)}</span>
                </div>
              </div>
              
              {/* Campo de entrada de mensagem */}
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Digite sua mensagem..."
                  disabled={sendingMessage}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {sendingMessage ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  )}
                  <span>{sendingMessage ? 'Enviando...' : 'Enviar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};