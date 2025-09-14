import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCardIcon, CheckIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

interface Plan {
  id: string;
  name: string;
  price: number;
  interval: 'monthly' | 'yearly';
  features: string[];
  maxAgents: number;
  maxConversations: number;
  maxWhatsappSessions: number;
  maxAiRequests: number;
  popular?: boolean;
}

interface Transaction {
  id: string;
  planId: string;
  amount: number;
  provider: 'stripe' | 'paypal' | 'pix';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: string;
}

interface UserLimits {
  maxAgents: number;
  maxConversations: number;
  maxWhatsappSessions: number;
  maxAiRequests: number;
  currentAgents: number;
  currentConversations: number;
  currentWhatsappSessions: number;
  currentAiRequests: number;
}

const Payments: React.FC = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [userLimits, setUserLimits] = useState<UserLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plans' | 'history' | 'limits'>('plans');
  const { addNotification } = useNotification();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [plansRes, transactionsRes, limitsRes] = await Promise.all([
        apiService.get('/payment/plans'),
        apiService.get('/payment/history'),
        apiService.get('/payment/limits')
      ]);
      
      setPlans(plansRes.data);
      setTransactions(transactionsRes.data);
      setUserLimits(limitsRes.data);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      addNotification('Erro ao carregar dados de pagamento', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (planId: string, provider: 'stripe' | 'paypal' | 'pix') => {
    setProcessingPayment(planId);
    
    try {
      const response = await api.post('/payment/create-session', {
        planId,
        provider
      });

      if (provider === 'pix') {
        // Mostrar código PIX
        addNotification('Código PIX gerado! Escaneie o QR Code para pagar.', 'success');
        // Aqui você pode abrir um modal com o código PIX
      } else {
        // Redirecionar para Stripe ou PayPal
        window.location.href = response.data.url;
      }
    } catch (error: any) {
      console.error('Erro ao processar pagamento:', error);
      addNotification(
        error.response?.data?.message || 'Erro ao processar pagamento',
        'error'
      );
    } finally {
      setProcessingPayment(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'refunded': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return 'Concluído';
      case 'pending': return 'Pendente';
      case 'failed': return 'Falhou';
      case 'refunded': return 'Reembolsado';
      default: return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Pagamentos e Planos</h1>
        <p className="mt-2 text-gray-600">
          Gerencie sua assinatura e histórico de pagamentos
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'plans', name: 'Planos', icon: CreditCardIcon },
            { id: 'history', name: 'Histórico', icon: ClockIcon },
            { id: 'limits', name: 'Limites', icon: CheckIcon }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-5 w-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Plans Tab */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-lg shadow-lg border-2 ${
                plan.popular ? 'border-blue-500' : 'border-gray-200'
              } p-6`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Mais Popular
                  </span>
                </div>
              )}
              
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(plan.price)}
                  </span>
                  <span className="text-gray-600">/{plan.interval === 'monthly' ? 'mês' : 'ano'}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-6">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckIcon className="h-5 w-5 text-green-500 mr-2" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <button
                  onClick={() => handlePayment(plan.id, 'stripe')}
                  disabled={processingPayment === plan.id}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processingPayment === plan.id ? 'Processando...' : 'Pagar com Cartão'}
                </button>
                
                <button
                  onClick={() => handlePayment(plan.id, 'pix')}
                  disabled={processingPayment === plan.id}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pagar com PIX
                </button>
                
                <button
                  onClick={() => handlePayment(plan.id, 'paypal')}
                  disabled={processingPayment === plan.id}
                  className="w-full bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Pagar com PayPal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Histórico de Transações</h3>
          </div>
          
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhuma transação encontrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plano
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Método
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {transaction.planId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 capitalize">
                        {transaction.provider}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          getStatusColor(transaction.status)
                        }`}>
                          {getStatusText(transaction.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(transaction.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Limits Tab */}
      {activeTab === 'limits' && userLimits && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Agentes', current: userLimits.currentAgents, max: userLimits.maxAgents },
            { label: 'Conversas', current: userLimits.currentConversations, max: userLimits.maxConversations },
            { label: 'Sessões WhatsApp', current: userLimits.currentWhatsappSessions, max: userLimits.maxWhatsappSessions },
            { label: 'Requisições IA', current: userLimits.currentAiRequests, max: userLimits.maxAiRequests }
          ].map((limit, index) => {
            const percentage = (limit.current / limit.max) * 100;
            const isNearLimit = percentage > 80;
            
            return (
              <div key={index} className="bg-white p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{limit.label}</h3>
                  <span className={`text-sm font-medium ${
                    isNearLimit ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {limit.current} / {limit.max}
                  </span>
                </div>
                
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      isNearLimit ? 'bg-red-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                  ></div>
                </div>
                
                <p className="text-sm text-gray-500 mt-2">
                  {percentage.toFixed(1)}% utilizado
                </p>
                
                {isNearLimit && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-700">
                      Você está próximo do limite. Considere fazer upgrade do seu plano.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Payments;