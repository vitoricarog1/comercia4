import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  DevicePhoneMobileIcon,
  PaperAirplaneIcon,
  UserIcon,
  CpuChipIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

interface WhatsAppSession {
  id: string;
  phone_number: string;
  contact_name?: string;
  agent_id?: string;
  agent_name?: string;
  status: 'active' | 'inactive' | 'ended';
  last_activity: string;
  message_count: number;
}

interface WhatsAppMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
  status: string;
}

export const WhatsApp: React.FC = () => {
  const { state } = useApp();
  const { showSuccess, showError, showInfo } = useNotification();
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<WhatsAppSession | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [whatsappConfig, setWhatsappConfig] = useState({
    accessToken: '',
    phoneNumberId: '',
    webhookToken: ''
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Configuration should be checked via API
  const hasToken = false;
  const hasPhoneId = false;

  useEffect(() => {
    loadSessions();
    checkWhatsAppConfig();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      loadMessages();
    }
  }, [selectedSession]);

  const checkWhatsAppConfig = () => {
    // Verificar se WhatsApp está configurado
    if (!hasToken || !hasPhoneId) {
      showInfo(
        'WhatsApp não configurado',
        'Configure as credenciais do WhatsApp Business API para usar esta funcionalidade'
      );
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const response = await apiService.request('/whatsapp/sessions');
      
      if (response.success) {
        setSessions(response.data.sessions);
      }
    } catch (error) {
      console.error('Erro ao carregar sessões:', error);
      showError('Erro', 'Não foi possível carregar as sessões do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedSession) return;

    try {
      const response = await apiService.request(`/chat/conversations/${selectedSession.id}/messages`);
      if (response.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedSession || sendingMessage) return;

    setSendingMessage(true);
    const messageText = newMessage;
    setNewMessage('');

    try {
      const response = await apiService.request('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber: selectedSession.phone_number,
          message: messageText,
          conversationId: selectedSession.id
        })
      });

      if (response.success) {
        // Adicionar mensagem localmente
        const newMsg: WhatsAppMessage = {
          id: Date.now().toString(),
          content: messageText,
          sender: 'agent',
          timestamp: new Date().toISOString(),
          status: 'sent'
        };
        setMessages(prev => [...prev, newMsg]);
        showSuccess('Mensagem enviada!', 'Mensagem enviada via WhatsApp');
      } else {
        showError('Erro', response.error || 'Erro ao enviar mensagem');
        setNewMessage(messageText); // Restaurar mensagem
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showError('Erro', 'Não foi possível enviar a mensagem');
      setNewMessage(messageText); // Restaurar mensagem
    } finally {
      setSendingMessage(false);
    }
  };

  const assignAgent = async (sessionId: string, agentId: string) => {
    try {
      const response = await apiService.request(`/whatsapp/sessions/${sessionId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ agentId })
      });

      if (response.success) {
        loadSessions(); // Recarregar sessões
        showSuccess('Agente atribuído!', 'Agente atribuído à conversa com sucesso');
      }
    } catch (error) {
      console.error('Erro ao atribuir agente:', error);
      showError('Erro', 'Não foi possível atribuir o agente');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
          <p className="text-gray-600">Gerencie conversas do WhatsApp em tempo real</p>
        </div>
        <button
          onClick={() => setShowConfig(true)}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          <CogIcon className="w-5 h-5 mr-2" />
          Configurar
        </button>
      </div>

      {/* Configuration Warning */}
      {(!hasToken || !hasPhoneId) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 mr-2 mt-0.5" />
            <div>
              <h3 className="font-medium text-yellow-800">WhatsApp não configurado</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Configure as credenciais do WhatsApp Business API para usar esta funcionalidade.
                Clique em "Configurar" para adicionar suas credenciais.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Sessões Ativas</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter(s => s.status === 'active').length}
              </p>
            </div>
            <DevicePhoneMobileIcon className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Sessões</p>
              <p className="text-2xl font-bold text-gray-900">{sessions.length}</p>
            </div>
            <UserIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Com Agente</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.filter(s => s.agent_id).length}
              </p>
            </div>
            <CpuChipIcon className="w-8 h-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Mensagens</p>
              <p className="text-2xl font-bold text-gray-900">
                {sessions.reduce((sum, s) => sum + (s.message_count || 0), 0)}
              </p>
            </div>
            <ClockIcon className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Main Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sessions List */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Sessões WhatsApp</h3>
            <p className="text-sm text-gray-600">{sessions.length} sessões</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${
                    selectedSession?.id === session.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                  onClick={() => setSelectedSession(session)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        <DevicePhoneMobileIcon className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.contact_name || session.phone_number}
                        </p>
                        <p className="text-sm text-gray-600">{session.phone_number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`w-2 h-2 rounded-full ${
                        session.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                      }`}></div>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTime(session.last_activity)}
                      </p>
                    </div>
                  </div>
                  
                  {session.agent_name ? (
                    <p className="text-xs text-blue-600 mt-2">Agente: {session.agent_name}</p>
                  ) : (
                    <div className="mt-2">
                      <select
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          if (e.target.value) {
                            assignAgent(session.id, e.target.value);
                          }
                        }}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        <option value="">Atribuir agente...</option>
                        {state.agents.filter(a => a.is_active).map(agent => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <DevicePhoneMobileIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma sessão WhatsApp</p>
                <p className="text-sm mt-1">Configure o webhook para receber mensagens</p>
              </div>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border flex flex-col">
          {selectedSession ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <DevicePhoneMobileIcon className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {selectedSession.contact_name || selectedSession.phone_number}
                    </p>
                    <p className="text-sm text-gray-600">{selectedSession.phone_number}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    selectedSession.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                  }`}></div>
                  <span className="text-sm text-gray-600 capitalize">{selectedSession.status}</span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-96 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${
                      message.sender === 'user' ? '' : 'flex-row-reverse space-x-reverse'
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.sender === 'user' ? 'bg-gray-600' : 'bg-green-600'
                      }`}>
                        {message.sender === 'user' ? (
                          <UserIcon className="w-4 h-4 text-white" />
                        ) : (
                          <CpuChipIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className={`px-4 py-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-gray-100 text-gray-900'
                          : 'bg-green-600 text-white'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <p className={`text-xs mt-1 ${
                          message.sender === 'user' ? 'text-gray-500' : 'text-green-100'
                        }`}>
                          {formatTime(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    disabled={sendingMessage}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {sendingMessage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <PaperAirplaneIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <DevicePhoneMobileIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione uma Sessão</h3>
                <p className="text-gray-500">Escolha uma sessão da lista para visualizar a conversa</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Configurar WhatsApp</h2>
                <button
                  onClick={() => setShowConfig(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={whatsappConfig.accessToken}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, accessToken: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Seu WhatsApp Access Token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number ID
                  </label>
                  <input
                    type="text"
                    value={whatsappConfig.phoneNumberId}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, phoneNumberId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="ID do número de telefone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Webhook Verify Token
                  </label>
                  <input
                    type="text"
                    value={whatsappConfig.webhookToken}
                    onChange={(e) => setWhatsappConfig(prev => ({ ...prev, webhookToken: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Token de verificação do webhook"
                  />
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Como configurar:</h4>
                  <ol className="text-sm text-blue-800 space-y-1">
                    <li>1. Acesse Facebook Developers</li>
                    <li>2. Crie um app WhatsApp Business</li>
                    <li>3. Configure o webhook: {window.location.origin}/api/whatsapp/webhook</li>
                    <li>4. Copie o Access Token e Phone Number ID</li>
                  </ol>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      // Salvar configurações no .env (em produção, usar interface admin)
                      showInfo('Configuração', 'Adicione essas credenciais no arquivo .env do servidor');
                      setShowConfig(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setShowConfig(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsApp;