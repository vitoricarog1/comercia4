import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  UserIcon,
  CpuChipIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';
import { useNotification } from '../contexts/NotificationContext';
import { useApp } from '../contexts/AppContext';
import { useSocket } from '../hooks/useSocket';
import { useAnalytics } from '../hooks/useAnalytics';
import { apiService } from '../services/api';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
  response_time?: number;
}

interface Conversation {
  id: string;
  agent_id: string;
  customer_name: string;
  status: string;
  start_time: string;
}

interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: string;
}

export const Chat: React.FC = () => {
  const { state } = useApp();
  const { showSuccess, showError } = useNotification();
  const { socket, isConnected, sendMessage, joinConversation, leaveConversation } = useSocket();
  const { trackChatMessage, trackAgentInteraction, trackError, trackApiResponse } = useAnalytics();
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showKnowledge, setShowKnowledge] = useState(false);
  const [knowledgeQuery, setKnowledgeQuery] = useState('');
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeItem[]>([]);
  const [newKnowledge, setNewKnowledge] = useState({
    title: '',
    content: '',
    category: 'geral'
  });
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (currentConversation) {
      loadMessages();
      joinConversation(currentConversation.id);
    }
    return () => {
      if (currentConversation) {
        leaveConversation(currentConversation.id);
      }
    };
  }, [currentConversation]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: any) => {
      if (data.conversationId === currentConversation?.id) {
        setMessages(prev => [...prev, {
          id: data.id,
          content: data.content,
          sender: data.sender,
          timestamp: data.timestamp,
          response_time: data.response_time
        }]);
        
        // Rastrear mensagem recebida via Socket.IO
        if (data.sender === 'agent') {
          const agent = state.agents.find(a => a.id === selectedAgent);
          trackChatMessage(currentConversation.id, 'agent', {
            agentId: selectedAgent,
            responseLength: data.content.length,
            responseTime: data.response_time * 1000, // converter para ms
            agentName: agent?.name
          });
          
          trackAgentInteraction(selectedAgent, 'message_response', {
            conversationId: currentConversation.id,
            responseTime: data.response_time * 1000,
            messageLength: data.content.length
          });
        }
      }
    };

    const handleTypingStart = (data: any) => {
      if (data.conversationId === currentConversation?.id && data.sender === 'agent') {
        setIsTyping(true);
      }
    };

    const handleTypingStop = (data: any) => {
      if (data.conversationId === currentConversation?.id && data.sender === 'agent') {
        setIsTyping(false);
      }
    };

    socket.on('message:new', handleNewMessage);
    socket.on('typing:start', handleTypingStart);
    socket.on('typing:stop', handleTypingStop);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('typing:start', handleTypingStart);
      socket.off('typing:stop', handleTypingStop);
    };
  }, [socket, currentConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    if (!currentConversation) return;

    try {
      const response = await apiService.request(`/chat/conversations/${currentConversation.id}/messages`);
      if (response.success) {
        setMessages(response.data.messages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const startNewConversation = async () => {
    if (!selectedAgent) {
      showError('Erro', 'Selecione um agente primeiro');
      return;
    }

    const startTime = Date.now();
    const agent = state.agents.find(a => a.id === selectedAgent);

    try {
      setLoading(true);
      const response = await apiService.request('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({
          agentId: selectedAgent,
          title: 'Chat de Teste'
        })
      });

      const responseTime = Date.now() - startTime;
      trackApiResponse('/chat/conversations', responseTime, response.success ? 200 : 500);

      if (response.success) {
        setCurrentConversation(response.data.conversation);
        setMessages([]);
        showSuccess('Conversa iniciada!', 'Nova conversa criada com sucesso');
        
        // Rastrear início de conversa
        trackAgentInteraction(selectedAgent, 'conversation_start', {
          conversationId: response.data.conversation.id,
          agentName: agent?.name,
          agentProvider: agent?.ai_provider
        });
      } else {
        trackError('conversation_create_error', response.error || 'Unknown error', {
          agentId: selectedAgent
        });
      }
    } catch (error) {
      console.error('Erro ao criar conversa:', error);
      showError('Erro', 'Não foi possível criar a conversa');
      trackError('conversation_network_error', error instanceof Error ? error.message : 'Unknown error', {
        agentId: selectedAgent
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentConversation || sendingMessage) return;

    const startTime = Date.now();
    const messageText = newMessage.trim();
    const agent = state.agents.find(a => a.id === selectedAgent);
    
    // Rastrear mensagem do usuário
    trackChatMessage(currentConversation.id, 'user', {
      agentId: selectedAgent,
      messageLength: messageText.length,
      agentName: agent?.name
    });
    
    setNewMessage('');
    setSendingMessage(true);

    try {
      // Enviar mensagem via Socket.IO para tempo real
      if (socket && isConnected) {
        sendMessage({
          conversationId: currentConversation.id,
          content: messageText,
          agentId: selectedAgent,
          sender: 'user'
        });
      } else {
        // Fallback para API REST se Socket.IO não estiver disponível
        const response = await apiService.request('/chat/send', {
          method: 'POST',
          body: JSON.stringify({
            conversationId: currentConversation.id,
            message: messageText,
            agentId: selectedAgent
          })
        });

        const responseTime = Date.now() - startTime;
        trackApiResponse('/chat/send', responseTime, response.success ? 200 : 500);

        if (response.success) {
          setMessages(prev => [
            ...prev,
            response.data.userMessage,
            response.data.aiMessage
          ]);
          
          // Rastrear resposta do agente
          trackChatMessage(currentConversation.id, 'agent', {
            agentId: selectedAgent,
            responseLength: response.data.aiMessage.content.length,
            responseTime,
            agentName: agent?.name
          });
          
          // Rastrear interação com agente
          trackAgentInteraction(selectedAgent, 'message_response', {
            conversationId: currentConversation.id,
            responseTime,
            messageLength: response.data.aiMessage.content.length
          });
        } else {
          showError('Erro', response.error || 'Erro ao enviar mensagem');
          trackError('chat_send_error', response.error || 'Unknown error', {
            agentId: selectedAgent,
            conversationId: currentConversation.id
          });
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showError('Erro', 'Não foi possível enviar a mensagem');
      trackError('chat_network_error', error instanceof Error ? error.message : 'Unknown error', {
        agentId: selectedAgent,
        conversationId: currentConversation.id
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const searchKnowledge = async () => {
    if (!knowledgeQuery.trim()) return;

    try {
      const response = await apiService.request(`/chat/knowledge?query=${encodeURIComponent(knowledgeQuery)}`);
      if (response.success) {
        setKnowledgeResults(response.data.results);
      }
    } catch (error) {
      console.error('Erro ao buscar conhecimento:', error);
    }
  };

  const addKnowledge = async () => {
    if (!newKnowledge.title.trim() || !newKnowledge.content.trim()) {
      showError('Erro', 'Título e conteúdo são obrigatórios');
      return;
    }

    try {
      const response = await apiService.request('/chat/knowledge', {
        method: 'POST',
        body: JSON.stringify(newKnowledge)
      });

      if (response.success) {
        showSuccess('Conhecimento adicionado!', 'Item adicionado à base de conhecimento');
        setNewKnowledge({ title: '', content: '', category: 'geral' });
        searchKnowledge(); // Refresh results
      }
    } catch (error) {
      console.error('Erro ao adicionar conhecimento:', error);
      showError('Erro', 'Não foi possível adicionar o conhecimento');
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat com IA</h1>
          <p className="text-gray-600">Teste seus agentes de IA em tempo real</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Socket.IO Connection Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          
          <button
            onClick={() => setShowKnowledge(!showKnowledge)}
            className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <BookOpenIcon className="w-5 h-5 mr-2" />
            Base de Conhecimento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Agent Selection */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold mb-4">Selecionar Agente</h3>
          
          <div className="space-y-3">
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Escolha um agente...</option>
              {state.agents.filter(a => a.is_active).map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} ({agent.ai_provider})
                </option>
              ))}
            </select>

            <button
              onClick={startNewConversation}
              disabled={!selectedAgent || loading}
              className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Criando...
                </>
              ) : (
                <>
                  <PlusIcon className="w-5 h-5 mr-2" />
                  Nova Conversa
                </>
              )}
            </button>
          </div>

          {/* Agent Info */}
          {selectedAgent && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              {(() => {
                const agent = state.agents.find(a => a.id === selectedAgent);
                return agent ? (
                  <div>
                    <h4 className="font-medium text-gray-900">{agent.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{agent.description}</p>
                    <div className="mt-3 space-y-1 text-xs text-gray-500">
                      <p>Provedor: {agent.ai_provider}</p>
                      <p>Modelo: {agent.model}</p>
                      <p>Temperatura: {agent.temperature}</p>
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>

        {/* Chat Area */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border flex flex-col">
          {currentConversation ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Chat de Teste</h3>
                      <p className="text-sm text-gray-500">
                        Agente: {state.agents.find(a => a.id === selectedAgent)?.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span className="text-sm text-green-600">Ativo</span>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 p-4 overflow-y-auto max-h-96 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${
                      message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        message.sender === 'user' 
                          ? 'bg-blue-600' 
                          : 'bg-gray-600'
                      }`}>
                        {message.sender === 'user' ? (
                          <UserIcon className="w-4 h-4 text-white" />
                        ) : (
                          <CpuChipIcon className="w-4 h-4 text-white" />
                        )}
                      </div>
                      <div className={`px-4 py-2 rounded-lg ${
                        message.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.content}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className={`text-xs ${
                            message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTime(message.timestamp)}
                          </p>
                          {message.response_time && (
                            <div className="flex items-center ml-2">
                              <ClockIcon className="w-3 h-3 mr-1" />
                              <span className="text-xs">{message.response_time.toFixed(1)}s</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="flex items-start space-x-2 max-w-xs lg:max-w-md">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-600">
                        <CpuChipIcon className="w-4 h-4 text-white" />
                      </div>
                      <div className="px-4 py-2 rounded-lg bg-gray-100">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={sendingMessage}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage || !isConnected}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Iniciar Chat</h3>
                <p className="text-gray-500 mb-4">Selecione um agente e inicie uma nova conversa</p>
                {!selectedAgent && (
                  <p className="text-sm text-yellow-600">⚠️ Primeiro selecione um agente</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Knowledge Base Modal */}
      {showKnowledge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Base de Conhecimento (RAG)</h2>
                <button
                  onClick={() => setShowKnowledge(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Search Knowledge */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Buscar Conhecimento</h3>
                  <div className="space-y-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={knowledgeQuery}
                        onChange={(e) => setKnowledgeQuery(e.target.value)}
                        placeholder="Buscar na base de conhecimento..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={searchKnowledge}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <MagnifyingGlassIcon className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {knowledgeResults.map((item) => (
                        <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                          <h4 className="font-medium text-gray-900">{item.title}</h4>
                          <p className="text-sm text-gray-600 mt-1">{item.content.substring(0, 100)}...</p>
                          <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded mt-2">
                            {item.category}
                          </span>
                        </div>
                      ))}
                      {knowledgeResults.length === 0 && knowledgeQuery && (
                        <p className="text-gray-500 text-center py-4">Nenhum resultado encontrado</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Add Knowledge */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Adicionar Conhecimento</h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      value={newKnowledge.title}
                      onChange={(e) => setNewKnowledge(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Título do conhecimento"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    
                    <select
                      value={newKnowledge.category}
                      onChange={(e) => setNewKnowledge(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="geral">Geral</option>
                      <option value="tecnico">Técnico</option>
                      <option value="vendas">Vendas</option>
                      <option value="suporte">Suporte</option>
                      <option value="produto">Produto</option>
                    </select>

                    <textarea
                      value={newKnowledge.content}
                      onChange={(e) => setNewKnowledge(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="Conteúdo detalhado..."
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                      onClick={addKnowledge}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Adicionar à Base
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;