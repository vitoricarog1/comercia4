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
  PlusIcon
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

export const Barbearia: React.FC = () => {
  const { user } = useApp();
  const { showSuccess, showError } = useNotification();
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
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
  const [activeTab, setActiveTab] = useState<'agendamentos' | 'chat' | 'configuracao' | 'folgas'>('agendamentos');
  const [novaFolga, setNovaFolga] = useState('');
  const [agentId] = useState(8); // ID do agente Gemini da barbearia
  const [modalAberto, setModalAberto] = useState(false);
  const [agendamentoSelecionado, setAgendamentoSelecionado] = useState<Agendamento | null>(null);
  
  // Estados do Chat
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [conversas, setConversas] = useState<any[]>([]);
  const [conversaAtiva, setConversaAtiva] = useState<string | null>(null);
  const [carregandoChat, setCarregandoChat] = useState(false);
  
  // Estados para modal de WhatsApp
  const [modalWhatsApp, setModalWhatsApp] = useState(false);
  const [numeroWhatsApp, setNumeroWhatsApp] = useState('');

  useEffect(() => {
    // Autenticar automaticamente como usuário da barbearia
    autenticarBarbearia();
  }, []);

  const autenticarBarbearia = async () => {
    try {
      // Verificar se já está autenticado
      if (apiService.isAuthenticated()) {
        await carregarDados();
        return;
      }

      // Verificar se o usuário atual tem permissão de barbearia
      if (!user || (user.role !== 'barber' && user.role !== 'barbearia' && user.role !== 'admin')) {
        showError('Acesso negado', 'Você não tem permissão para acessar o sistema da barbearia');
        return;
      }

      await carregarDados();
    } catch (error) {
      console.error('Erro na autenticação:', error);
      showError('Erro ao conectar com o sistema da barbearia');
    }
  };

  const carregarDados = async () => {
    try {
      setLoading(true);
      
      // Carregar conversas do agente da barbearia
       const conversasRes = await apiService.get(`/barbearia/conversations?agent_id=${agentId}`);
       
       // Processar conversas para extrair agendamentos
       if (conversasRes.success) {
         const processedAppointments = conversasRes.data
           .filter((conv: any) => conv.status === 'active')
           .map((conv: any) => ({
             id: conv.id,
             cliente: conv.title || 'Cliente',
             telefone: conv.phone_number || '',
             servico: 'Corte de Cabelo',
             data: new Date(conv.created_at).toLocaleDateString('pt-BR'),
             horario: new Date(conv.created_at).toLocaleTimeString('pt-BR', { 
               hour: '2-digit', 
               minute: '2-digit' 
             }),
             status: 'confirmado' as const
           }));
         
         setAgendamentos(processedAppointments);
       }
       
       // Carregar configurações do agente
       const agentRes = await apiService.get(`/barbearia/agent/${agentId}`);
       if (agentRes.success) {
         const agent = agentRes.data;
         
         if (agent.whatsapp_config && agent.model_config) {
           const whatsappConfig = JSON.parse(agent.whatsapp_config);
           const modelConfig = JSON.parse(agent.model_config);
           
           setConfiguracao({
             geminiApiKey: process.env.REACT_APP_GEMINI_API_KEY || '',
             whatsappApiKey: whatsappConfig.apiKey || '',
             numeroWhatsapp: whatsappConfig.phoneNumber || '',
             horarioFuncionamento: modelConfig.horarioFuncionamento || { inicio: '08:00', fim: '18:00' },
             diasFolga: modelConfig.diasFolga || []
           });
         }
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
      // Atualizar configurações do agente
      const whatsappConfig = {
        apiKey: configuracao.whatsappApiKey,
        phoneNumber: configuracao.numeroWhatsapp
      };
      
      const modelConfig = {
        horarioFuncionamento: configuracao.horarioFuncionamento,
        diasFolga: configuracao.diasFolga,
        intervalos: 30
      };
      
      const response = await apiService.put(`/barbearia/agent/${agentId}`, {
         whatsapp_config: JSON.stringify(whatsappConfig),
         model_config: JSON.stringify(modelConfig)
       });
      
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

  const atualizarStatusAgendamento = async (agendamentoId: string, novoStatus: string) => {
    try {
      await apiService.put(`/barbearia/agendamento/${agendamentoId}`, {
        status: novoStatus
      });
      
      // Atualizar a lista local
      setAgendamentos(prev => prev.map(ag => 
        ag.id === agendamentoId ? { ...ag, status: novoStatus as any } : ag
      ));
      
      showSuccess('Status atualizado com sucesso!');
      
      // Recarregar dados para garantir sincronização
      carregarDados();
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      showError('Erro ao atualizar status do agendamento');
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

  // Funções do Chat
  const carregarConversas = async () => {
    try {
      const response = await apiService.get('/barbearia/conversas');
      setConversas(response.data);
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    }
  };

  const carregarMensagens = async (conversaId: string) => {
    try {
      setCarregandoChat(true);
      const response = await apiService.get(`/barbearia/conversas/${conversaId}/mensagens`);
      setMensagens(response.data);
      setConversaAtiva(conversaId);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setCarregandoChat(false);
    }
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaAtiva) return;

    try {
      setCarregandoChat(true);
      const response = await apiService.post('/barbearia/chat/enviar', {
        conversaId: conversaAtiva,
        mensagem: novaMensagem
      });
      
      // Adicionar mensagem à lista
      setMensagens(prev => [...prev, {
        id: Date.now(),
        texto: novaMensagem,
        tipo: 'enviada',
        timestamp: new Date().toISOString()
      }]);
      
      setNovaMensagem('');
      
      // Se a resposta contém um agendamento, recarregar agendamentos
      if (response.data.agendamento) {
        await carregarDados();
        showSuccess('Sucesso', 'Agendamento criado com sucesso!');
      }
      
      // Adicionar resposta do Gemini se houver
      if (response.data.resposta) {
        setTimeout(() => {
          setMensagens(prev => [...prev, {
            id: Date.now() + 1,
            texto: response.data.resposta,
            tipo: 'recebida',
            timestamp: new Date().toISOString()
          }]);
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      showError('Erro', 'Erro ao enviar mensagem');
    } finally {
      setCarregandoChat(false);
    }
  };

  const iniciarNovaConversa = async (telefone: string) => {
    try {
      const response = await apiService.post('/barbearia/conversas/nova', { telefone });
      await carregarConversas();
      setConversaAtiva(response.data.id);
      setMensagens([]);
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error);
    }
  };

  // Carregar conversas quando a aba chat for ativada
  useEffect(() => {
    if (activeTab === 'chat') {
      carregarConversas();
    }
  }, [activeTab]);

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
              <span className="text-sm text-gray-500">Bem-vindo, {user?.name}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
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
              <PhoneIcon className="h-5 w-5 inline mr-2" />
              Chat
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
          {activeTab === 'agendamentos' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Agendamentos de Hoje</h3>
                  <p className="text-sm text-gray-500">Visualize e gerencie os agendamentos</p>
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
                                R$ {(agendamento.valor || 0).toFixed(2)} • {agendamento.pago ? '✅ Pago' : '❌ Não pago'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="text-sm text-gray-900">
                              <ClockIcon className="h-4 w-4 inline mr-1" />
                              {agendamento.horario}
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
                                  atualizarStatusAgendamento(agendamento.id, 'concluido');
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
               <div className="bg-white shadow rounded-lg h-96">
                 <div className="px-6 py-4 border-b border-gray-200">
                   <div className="flex justify-between items-center">
                     <div>
                       <h3 className="text-lg font-medium text-gray-900">Chat WhatsApp</h3>
                       <p className="text-sm text-gray-500">Gerencie as conversas e agendamentos</p>
                     </div>
                     <button
                       onClick={() => setModalWhatsApp(true)}
                       className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                     >
                       <PlusIcon className="h-4 w-4 inline mr-1" />
                       Nova Conversa
                     </button>
                   </div>
                 </div>
                 
                 <div className="flex h-80">
                   {/* Lista de Conversas */}
                   <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
                     {conversas.length === 0 ? (
                       <div className="p-4 text-center text-gray-500">
                         <PhoneIcon className="mx-auto h-8 w-8 mb-2" />
                         <p className="text-sm">Nenhuma conversa ainda</p>
                       </div>
                     ) : (
                       conversas.map((conversa) => (
                         <div
                           key={conversa.id}
                           onClick={() => carregarMensagens(conversa.id)}
                           className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                             conversaAtiva === conversa.id ? 'bg-blue-50 border-blue-200' : ''
                           }`}
                         >
                           <div className="flex items-center">
                             <UserIcon className="h-8 w-8 text-gray-400 mr-3" />
                             <div className="flex-1">
                               <p className="text-sm font-medium text-gray-900">{conversa.telefone}</p>
                               <p className="text-xs text-gray-500 truncate">{conversa.ultima_mensagem}</p>
                             </div>
                           </div>
                         </div>
                       ))
                     )}
                   </div>
                   
                   {/* Área de Mensagens */}
                   <div className="flex-1 flex flex-col">
                     {conversaAtiva ? (
                       <>
                         {/* Mensagens */}
                         <div className="flex-1 overflow-y-auto p-4 space-y-3">
                           {carregandoChat ? (
                             <div className="text-center text-gray-500">
                               <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                               <p className="text-sm mt-2">Carregando...</p>
                             </div>
                           ) : mensagens.length === 0 ? (
                             <div className="text-center text-gray-500">
                               <p className="text-sm">Nenhuma mensagem ainda</p>
                             </div>
                           ) : (
                             mensagens.map((mensagem) => (
                               <div
                                 key={mensagem.id}
                                 className={`flex ${
                                   mensagem.tipo === 'enviada' ? 'justify-end' : 'justify-start'
                                 }`}
                               >
                                 <div
                                   className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                                     mensagem.tipo === 'enviada'
                                       ? 'bg-blue-600 text-white'
                                       : 'bg-gray-200 text-gray-900'
                                   }`}
                                 >
                                   <p className="text-sm">{mensagem.texto}</p>
                                   <p className={`text-xs mt-1 ${
                                     mensagem.tipo === 'enviada' ? 'text-blue-100' : 'text-gray-500'
                                   }`}>
                                     {new Date(mensagem.timestamp).toLocaleTimeString('pt-BR', {
                                       hour: '2-digit',
                                       minute: '2-digit'
                                     })}
                                   </p>
                                 </div>
                               </div>
                             ))
                           )}
                         </div>
                         
                         {/* Input de Mensagem */}
                         <div className="border-t border-gray-200 p-4">
                           <div className="flex space-x-2">
                             <input
                               type="text"
                               value={novaMensagem}
                               onChange={(e) => setNovaMensagem(e.target.value)}
                               onKeyPress={(e) => e.key === 'Enter' && enviarMensagem()}
                               placeholder="Digite sua mensagem..."
                               className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                               disabled={carregandoChat}
                             />
                             <button
                               onClick={enviarMensagem}
                               disabled={carregandoChat || !novaMensagem.trim()}
                               className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                             >
                               Enviar
                             </button>
                           </div>
                         </div>
                       </>
                     ) : (
                       <div className="flex-1 flex items-center justify-center text-gray-500">
                         <div className="text-center">
                           <PhoneIcon className="mx-auto h-12 w-12 mb-4" />
                           <p className="text-sm">Selecione uma conversa para começar</p>
                         </div>
                       </div>
                     )}
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
      
      {/* Modal WhatsApp */}
      {modalWhatsApp && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Nova Conversa WhatsApp</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número do WhatsApp (com DDD)
              </label>
              <input
                type="text"
                value={numeroWhatsApp}
                onChange={(e) => setNumeroWhatsApp(e.target.value)}
                placeholder="Ex: 11999999999"
                className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setModalWhatsApp(false);
                  setNumeroWhatsApp('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  if (numeroWhatsApp.trim()) {
                    iniciarNovaConversa(numeroWhatsApp.trim());
                    setModalWhatsApp(false);
                    setNumeroWhatsApp('');
                  }
                }}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
              >
                Iniciar Conversa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Barbearia;