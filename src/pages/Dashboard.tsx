import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  StarIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import StatsCard from '../components/UI/StatsCard';
import { MetricsChart } from '../components/Dashboard/MetricsChart';
import { apiService } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';

const Dashboard: React.FC = () => {
  const { state, dispatch } = useApp();
  const { showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [agentStats, conversationStats, agents, conversations] = await Promise.all([
          apiService.getAgentStats(),
          apiService.getConversationStats(),
          apiService.getAgents(),
          apiService.getConversations({ limit: 10 })
        ]);
        
        // Construir estatísticas do dashboard
        const dashboardStats = {
          overview: {
            totalAgents: agentStats.data?.stats?.total || 0,
            activeAgents: agentStats.data?.stats?.active || 0,
            totalConversations: conversationStats.data?.stats?.total || 0,
            activeConversations: conversationStats.data?.stats?.active || 0,
            avgSatisfaction: conversationStats.data?.stats?.avgSatisfaction || 0,
            avgResponseTime: 0
          },
          trends: {
            dailyConversations: conversationStats.data?.stats?.dailyConversations || [],
            dailyAgents: agentStats.data?.stats?.dailyCreated || []
          }
        };
        
        dispatch({ type: 'SET_DASHBOARD_STATS', payload: dashboardStats });
        dispatch({ type: 'SET_AGENTS', payload: agents.data?.agents || [] });
        dispatch({ type: 'SET_CONVERSATIONS', payload: conversations.data?.conversations || [] });
        
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro ao carregar dados do dashboard';
        setError(errorMessage);
        showError('Erro no Dashboard', errorMessage);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [dispatch, showError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao Carregar Dashboard</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const stats = state.dashboardStats;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-body text-gray-600 dark:text-gray-400 mt-2">Visão geral do sistema IA-ATT</p>
        </div>
        <div className="flex space-x-3">
          <button className="btn btn-primary">
            Novo Agente
          </button>
          <button className="btn btn-secondary">
            Relatório
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatsCard
          title="Total de Agentes"
          value={stats?.overview?.totalAgents || 0}
          change={`${stats?.overview?.activeAgents || 0} ativos`}
          icon={<UserGroupIcon className="w-6 h-6" />}
          color="primary"
          loading={loading}
        />
        <StatsCard
          title="Conversas Ativas"
          value={stats?.overview?.activeConversations || 0}
          change={`${stats?.overview?.totalConversations || 0} total`}
          icon={<ChatBubbleLeftRightIcon className="w-6 h-6" />}
          color="success"
          loading={loading}
        />
        <StatsCard
          title="Tempo Médio de Resposta"
          value={`${stats?.overview?.avgResponseTime?.toFixed(1) || '0.0'}s`}
          change="Últimos 7 dias"
          icon={<ClockIcon className="w-6 h-6" />}
          color="warning"
          loading={loading}
        />
        <StatsCard
          title="Satisfação Média"
          value={stats?.overview?.avgSatisfaction?.toFixed(1) || '0.0'}
          change="Avaliação geral"
          icon={<StarIcon className="w-6 h-6" />}
          color="purple"
          loading={loading}
        />
      </div>

      {/* Charts */}
      {!loading && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
          <div className="card card-large">
            <h3 className="text-h3 text-gray-900 dark:text-white mb-6">Conversas por Dia</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <MetricsChart
                data={stats.trends.dailyConversations}
                title="Conversas por Dia"
                dataKey="count"
                color="#3B82F6"
                type="area"
              />
            )}
          </div>
          <div className="card card-large">
            <h3 className="text-h3 text-gray-900 dark:text-white mb-6">Novos Agentes por Dia</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <MetricsChart
                data={stats.trends.dailyAgents}
                title="Novos Agentes por Dia"
                dataKey="count"
                color="#10B981"
                type="line"
              />
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
        {/* Active Agents */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="card card-large"
        >
          <h3 className="text-h3 text-gray-900 dark:text-white mb-6">Agentes Mais Ativos</h3>
          <div className="space-y-4">
            {Array.isArray(state.agents) && state.agents.length > 0 ? (
              state.agents.slice(0, 3).map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${agent.is_active ? 'bg-green-400' : 'bg-gray-400'}`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{agent.name}</p>
                      <p className="text-sm text-gray-500">{agent.total_conversations || 0} conversas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{agent.avg_satisfaction?.toFixed(1) || '0.0'}</p>
                    <p className="text-xs text-gray-500">satisfação</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">Nenhum agente encontrado</p>
                <p className="text-sm text-gray-400 mt-1">Crie seu primeiro agente para começar</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Recent Conversations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="card card-large"
        >
          <h3 className="text-h3 text-gray-900 dark:text-white mb-6">Conversas Recentes</h3>
          <div className="space-y-4">
            {Array.isArray(state.conversations) && state.conversations.length > 0 ? (
              state.conversations.slice(0, 3).map((conversation) => (
                <div key={conversation.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      conversation.status === 'active' ? 'bg-green-400' : 
                      conversation.status === 'resolved' ? 'bg-blue-400' : 'bg-yellow-400'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{conversation.customer_name || 'Cliente'}</p>
                      <p className="text-sm text-gray-500">{conversation.agent_name || 'Sem agente'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{conversation.message_count || 0}</p>
                    <p className="text-xs text-gray-500">mensagens</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500">Nenhuma conversa encontrada</p>
                <p className="text-sm text-gray-400 mt-1">As conversas aparecerão aqui quando iniciadas</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;