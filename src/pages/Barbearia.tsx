import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CalendarDaysIcon,
  ClockIcon,
  UserIcon,
  CogIcon,
  PhoneIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

interface Agendamento {
  id: string;
  cliente: string;
  telefone: string;
  email?: string;
  servico: 'cabelo' | 'barba' | 'cabelo_barba';
  data: string;
  horario: string;
  valor: number;
  pago: boolean;
  metodo_pagamento: 'dinheiro' | 'pix' | 'cartao' | 'pendente';
  observacoes?: string;
  status: 'confirmado' | 'pendente' | 'cancelado' | 'concluido';
  created_at: string;
  updated_at: string;
}

interface ConfiguracaoBarbearia {
  whatsappApiKey: string;
  geminiApiKey: string;
  numeroWhatsapp: string;
  horarioFuncionamento: {
    inicio: string;
    fim: string;
  };
  diasFolga: string[];
}

interface BarbeariaStats {
  total: number;
  confirmados: number;
  hoje: number;
  receita: number;
  dailyBookings: Array<{ date: string; count: number }>;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  timestamp: string;
}

export const Barbearia: React.FC = () => {
  const { state } = useApp();
  const { showSuccess, showError } = useNotification();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [stats, setStats] = useState<BarbeariaStats | null>(null);
  const [configuracao, setConfiguracao] = useState<ConfiguracaoBarbearia>({
    whatsappApiKey: '',
    geminiApiKey: '',
    numeroWhatsapp: '',
    horarioFuncionamento: {
      inicio: '08:00',
      fim: '18:00'
    },
    diasFolga: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'agendamentos' | 'chat' | 'configuracao' | 'folgas'>('dashboard');
  const [novaFolga, setNovaFolga] = useState('');
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  
  // Estados do Chat IA
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [carregandoChat, setCarregandoChat] = useState(false);
  const [telefoneChat, setTelefoneChat] = useState('11999999999');
  
  // Estados para novo agendamento
  const [modalNovoAgendamento, setModalNovoAgendamento] = useState(false);
  const [novoAgendamento, setNovoAgendamento] = useState({
    cliente: '',
    telefone: '',
    email: '',
    data: '',
    horario: '',
    servico: 'cabelo',
    observacoes: ''
  });

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar agendamentos de hoje
      const agendamentosRes = await apiService.get('/barbearia/agendamentos');
      if (agendamentosRes.success) {
        setAgendamentos(agendamentosRes.data);
      }
      
      // Carregar estatísticas
      const statsRes = await apiService.get('/barbearia/stats');
      if (statsRes.success) {
        setStats(statsRes.data);
      }
      
      // Carregar configurações
      const configRes = await apiService.get('/barbearia/configuracao');
      if (configRes.success) {
        setConfiguracao(configRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      showError('Erro', 'Não foi possível carregar os dados da barbearia');
    } finally {
      setLoading(false);
    }
  };

  const salvarConfiguracao = async () => {
    try {
      const response = await apiService.post('/barbearia/configuracao', configuracao);
      
      if (response.success) {
        showSuccess('Sucesso', 'Configurações salvas com sucesso!');
      } else {
        showError('Erro', response.error || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      showError('Erro', 'Não foi possível salvar as configurações');
    }
  };

  const criarAgendamento = async () => {
    try {
      const response = await apiService.post('/barbearia/agendamentos', novoAgendamento);
      
      if (response.success) {
        setModalNovoAgendamento(false);
        setNovoAgendamento({
          cliente: '',
          telefone: '',
          email: '',
          data: '',
          horario: '',
          servico: 'cabelo',
          observacoes: ''
        });
        await carregarDados();
        showSuccess('Agendamento criado com sucesso!');
      } else {
        showError('Erro', response.error || 'Erro ao criar agendamento');
      }
    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      showError('Erro', 'Não foi possível criar o agendamento');
    }
  };

  const adicionarDiaFolga = () => {
    if (novaFolga && !configuracao.diasFolga.includes(novaFolga)) {
      setConfiguracao({
        ...configuracao,
        diasFolga: [...configuracao.diasFolga, novaFolga]
      });
      setNovaFolga('');
    }
  };

  const removerDiaFolga = (data: string) => {
    setConfiguracao({
      ...configuracao,
      diasFolga: configuracao.diasFolga.filter(d => d !== data)
    });
  };

  const abrirModal = (agendamento: Agendamento) => {
    setAgendamentoSelecionado(agendamento);
    setModalAberto(true);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setAgendamentoSelecionado(null);
  };

  const atualizarStatusAgendamento = async (agendamentoId: string, updates: any) => {
    try {
      const response = await apiService.put(`/barbearia/agendamentos/${agendamentoId}`, updates);
      
      if (response.success) {
        await carregarDados();
        showSuccess('Agendamento atualizado com sucesso!');
      } else {
        showError('Erro', response.error || 'Erro ao atualizar agendamento');
      }
    } catch (error) {
      console.error('Erro ao atualizar agendamento:', error);
      showError('Erro', 'Não foi possível atualizar o agendamento');
    }
  };

  // Chat IA Functions
  const enviarMensagemIA = async () => {
    if (!novaMensagem.trim()) return;

    const mensagemUsuario: ChatMessage = {
      id: Date.now().toString(),
      content: novaMensagem,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, mensagemUsuario]);
    const mensagem = novaMensagem;
    setNovaMensagem('');
    setCarregandoChat(true);

    try {
      const response = await apiService.post('/barbearia/chat/ia', {
        mensagem,
        telefone: telefoneChat
      });

      if (response.success) {
        const respostaIA: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: response.data.resposta,
          sender: 'agent',
          timestamp: new Date().toISOString()
        };

        setChatMessages(prev => [...prev, respostaIA]);

        // Se foi criado um agendamento, recarregar dados
        if (response.data.tipo === 'agendamento' && response.data.agendamento) {
          await carregarDados();
          showSuccess('Agendamento criado via IA!');
        }
      } else {
        showError('Erro', response.error || 'Erro ao processar mensagem');
      }
    } catch (error) {
      console.error('Erro no chat IA:', error);
      showError('Erro', 'Não foi possível enviar a mensagem');
    } finally {
      setCarregandoChat(false);
    }
  };

  const formatarServico = (servico: string) => {
    switch (servico) {
      case 'cabelo': return 'Corte de Cabelo';
      case 'barba': return 'Barba';
      case 'cabelo_barba': return 'Cabelo + Barba';
      default: return servico;
    }
  };

  const formatarMetodoPagamento = (metodo: string) => {
    switch (metodo) {
      case 'dinheiro': return 'Dinheiro';
      case 'pix': return 'PIX';
      case 'cartao': return 'Cartão';
      case 'pendente': return 'Pendente';
      default: return metodo;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmado':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'pendente':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      case 'cancelado':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmado':
        return 'bg-green-100 text-green-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900">Painel da Barbearia</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Bem-vindo, {state.user?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChartBarIcon className="h-5 w-5 inline mr-2" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('agendamentos')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'agendamentos'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CalendarDaysIcon className="h-5 w-5 inline mr-2" />
              Agendamentos
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <ChatBubbleLeftRightIcon className="h-5 w-5 inline mr-2" />
              Chat IA
            </button>
            <button
              onClick={() => setActiveTab('configuracao')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'configuracao'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CogIcon className="h-5 w-5 inline mr-2" />
              Configurações
            </button>
            <button
              onClick={() => setActiveTab('folgas')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'folgas'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <XCircleIcon className="h-5 w-5 inline mr-2" />
              Dias de Folga
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="mt-6">
          {activeTab === 'dashboard' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Stats Cards */}
              {stats && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total de Agendamentos</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                      </div>
                      <CalendarDaysIcon className="w-8 h-8 text-blue-600" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Confirmados</p>
                        <p className="text-2xl font-bold text-green-600">{stats.confirmados}</p>
                      </div>
                      <CheckCircleIcon className="w-8 h-8 text-green-600" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Hoje</p>
                        <p className="text-2xl font-bold text-purple-600">{stats.hoje}</p>
                      </div>
                      <ClockIcon className="w-8 h-8 text-purple-600" />
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Receita</p>
                        <p className="text-2xl font-bold text-yellow-600">R$ {stats.receita.toFixed(2)}</p>
                      </div>
                      <div className="text-2xl">💰</div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Agendamentos de Hoje */}
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Agendamentos de Hoje</h3>
                    <button
                      onClick={() => setModalNovoAgendamento(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                    >
                      <PlusIcon className="h-4 w-4 inline mr-1" />
                      Novo Agendamento
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {agendamentos.filter(ag => {
                    const hoje = new Date().toISOString().split('T')[0];
                    return ag.data === hoje;
                  }).map((agendamento) => (
                    <div key={agendamento.id} className="px-6 py-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <UserIcon className="h-8 w-8 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{agendamento.cliente}</p>
                            <p className="text-sm text-gray-500">
                              {formatarServico(agendamento.servico)} • {agendamento.horario.substring(0, 5)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(agendamento.status)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(agendamento.status)}`}>
                            {agendamento.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {agendamentos.filter(ag => {
                    const hoje = new Date().toISOString().split('T')[0];
                    return ag.data === hoje;
                  }).length === 0 && (
                    <div className="px-6 py-8 text-center">
                      <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum agendamento hoje</h3>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'agendamentos' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Todos os Agendamentos</h3>
                      <p className="text-sm text-gray-500">Visualize e gerencie os agendamentos</p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => carregarDados()}
                        className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 text-sm"
                      >
                        Atualizar
                      </button>
                      <button
                        onClick={() => setModalNovoAgendamento(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                      >
                        <PlusIcon className="h-4 w-4 inline mr-1" />
                        Novo
                      </button>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-gray-200">
                  {agendamentos.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <CalendarDaysIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">Nenhum agendamento</h3>
                      <p className="mt-1 text-sm text-gray-500">Não há agendamentos para hoje.</p>
                    </div>
                  ) : (
                    agendamentos.map((agendamento) => (
                      <div 
                        key={agendamento.id} 
                        className="px-6 py-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex items-center cursor-pointer flex-1"
                            onClick={() => abrirModal(agendamento)}
                          >
                            <div className="flex-shrink-0">
                              <UserIcon className="h-8 w-8 text-gray-400" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {agendamento.cliente}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatarServico(agendamento.servico)} • {agendamento.telefone}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {new Date(agendamento.data).toLocaleDateString('pt-BR')} • R$ {(agendamento.valor || 0).toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-900">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              {agendamento.horario.substring(0, 5)}
                            </div>
                            <div className="flex items-center">
                              {getStatusIcon(agendamento.status)}
                              <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                                getStatusColor(agendamento.status)
                              }`}>
                                {agendamento.status}
                              </span>
                            </div>
                            {agendamento.status !== 'concluido' && agendamento.status !== 'cancelado' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  atualizarStatusAgendamento(agendamento.id, { status: 'concluido' });
                                }}
                                className="bg-green-600 text-white px-3 py-1 rounded-md text-xs hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                                title="Marcar como concluído"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'chat' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">Chat com IA para Agendamentos</h3>
                      <p className="text-sm text-gray-500">Teste o sistema de agendamento por IA</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={telefoneChat}
                        onChange={(e) => setTelefoneChat(e.target.value)}
                        placeholder="Telefone do cliente"
                        className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                      />
                      <button
                        onClick={() => setChatMessages([])}
                        className="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-700 text-sm"
                      >
                        Limpar Chat
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Chat Messages */}
                <div className="h-96 flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-gray-500 mt-8">
                        <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 mb-4" />
                        <p className="text-sm">Inicie uma conversa com a IA</p>
                        <p className="text-xs mt-1">Exemplo: "Quero agendar um corte para amanhã às 14h"</p>
                      </div>
                    ) : (
                      chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.sender === 'user'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            <p className={`text-xs mt-1 ${
                              message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              {new Date(message.timestamp).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                    
                    {carregandoChat && (
                      <div className="flex justify-start">
                        <div className="bg-gray-200 px-4 py-2 rounded-lg">
                          <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Input de Mensagem */}
                  <div className="border-t border-gray-200 p-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={novaMensagem}
                        onChange={(e) => setNovaMensagem(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !carregandoChat && enviarMensagemIA()}
                        placeholder="Digite sua mensagem para a IA..."
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={carregandoChat}
                      />
                      <button
                        onClick={enviarMensagemIA}
                        disabled={carregandoChat || !novaMensagem.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                      >
                        {carregandoChat ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <PaperAirplaneIcon className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'configuracao' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Configurações da Barbearia</h3>
                  <p className="text-sm text-gray-500">Configure as APIs e horários de funcionamento</p>
                </div>
                <div className="px-6 py-4 space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">API Key do WhatsApp</label>
                    <input
                      type="text"
                      value={configuracao.whatsappApiKey}
                      onChange={(e) => setConfiguracao({...configuracao, whatsappApiKey: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Insira sua API Key do WhatsApp"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">API Key do Gemini</label>
                    <input
                      type="text"
                      value={configuracao.geminiApiKey}
                      onChange={(e) => setConfiguracao({...configuracao, geminiApiKey: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Insira sua API Key do Gemini"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Número do WhatsApp</label>
                    <input
                      type="text"
                      value={configuracao.numeroWhatsapp}
                      onChange={(e) => setConfiguracao({...configuracao, numeroWhatsapp: e.target.value})}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Ex: +5511999999999"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Horário de Início</label>
                      <input
                        type="time"
                        value={configuracao.horarioFuncionamento.inicio}
                        onChange={(e) => setConfiguracao({
                          ...configuracao,
                          horarioFuncionamento: {
                            ...configuracao.horarioFuncionamento,
                            inicio: e.target.value
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Horário de Fim</label>
                      <input
                        type="time"
                        value={configuracao.horarioFuncionamento.fim}
                        onChange={(e) => setConfiguracao({
                          ...configuracao,
                          horarioFuncionamento: {
                            ...configuracao.horarioFuncionamento,
                            fim: e.target.value
                          }
                        })}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={salvarConfiguracao}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Salvar Configurações
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'folgas' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Gerenciar Dias de Folga</h3>
                  <p className="text-sm text-gray-500">Marque os dias em que a barbearia estará fechada</p>
                </div>
                <div className="px-6 py-4">
                  <div className="flex space-x-4 mb-6">
                    <input
                      type="date"
                      value={novaFolga}
                      onChange={(e) => setNovaFolga(e.target.value)}
                      className="block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={adicionarDiaFolga}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      Adicionar Folga
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {configuracao.diasFolga.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhum dia de folga configurado.</p>
                    ) : (
                      configuracao.diasFolga.map((data) => (
                        <div key={data} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded-md">
                          <span className="text-sm text-gray-900">
                            {new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          <button
                            onClick={() => removerDiaFolga(data)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <XCircleIcon className="h-5 w-5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Agendamento */}
      {modalAberto && agendamentoSelecionado && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Detalhes do Agendamento</h3>
                <button
                  onClick={fecharModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Cliente</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.cliente}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Telefone</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.telefone}</p>
                  </div>
                </div>
                
                {agendamentoSelecionado.email && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.email}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data</label>
                    <p className="mt-1 text-sm text-gray-900">
                      {new Date(agendamentoSelecionado.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Horário</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.horario}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Serviço</label>
                  <p className="mt-1 text-sm text-gray-900">{formatarServico(agendamentoSelecionado.servico)}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Valor</label>
                    <p className="mt-1 text-sm text-gray-900 font-semibold">R$ {(agendamentoSelecionado.valor || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status do Pagamento</label>
                    <p className={`mt-1 text-sm font-medium ${
                      agendamentoSelecionado.pago ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {agendamentoSelecionado.pago ? '✅ Pago' : '❌ Não pago'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Método de Pagamento</label>
                    <p className="mt-1 text-sm text-gray-900">{formatarMetodoPagamento(agendamentoSelecionado.metodo_pagamento)}</p>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status do Agendamento</label>
                  <div className="mt-1 flex items-center">
                    {getStatusIcon(agendamentoSelecionado.status)}
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                      getStatusColor(agendamentoSelecionado.status)
                    }`}>
                      {agendamentoSelecionado.status}
                    </span>
                  </div>
                </div>
                
                {agendamentoSelecionado.observacoes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Observações</label>
                    <p className="mt-1 text-sm text-gray-900">{agendamentoSelecionado.observacoes}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <label className="block font-medium">Criado em</label>
                    <p>{new Date(agendamentoSelecionado.created_at).toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <label className="block font-medium">Atualizado em</label>
                    <p>{new Date(agendamentoSelecionado.updated_at).toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  onClick={fecharModal}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Modal Novo Agendamento */}
      {modalNovoAgendamento && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Novo Agendamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <input
                  type="text"
                  value={novoAgendamento.cliente}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, cliente: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Nome do cliente"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={novoAgendamento.telefone}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, telefone: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="(11) 99999-9999"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="date"
                  value={novoAgendamento.data}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, data: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
                <input
                  type="time"
                  value={novoAgendamento.horario}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, horario: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Serviço</label>
                <select
                  value={novoAgendamento.servico}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, servico: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="cabelo">Corte de Cabelo - R$ 25,00</option>
                  <option value="barba">Barba - R$ 15,00</option>
                  <option value="cabelo_barba">Cabelo + Barba - R$ 35,00</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={novoAgendamento.observacoes}
                  onChange={(e) => setNovoAgendamento({...novoAgendamento, observacoes: e.target.value})}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setModalNovoAgendamento(false);
                  setNovoAgendamento({
                    cliente: '',
                    telefone: '',
                    email: '',
                    data: '',
                    horario: '',
                    servico: 'cabelo',
                    observacoes: ''
                  });
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={criarAgendamento}
                disabled={!novoAgendamento.cliente || !novoAgendamento.telefone || !novoAgendamento.data || !novoAgendamento.horario}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                Criar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Barbearia;