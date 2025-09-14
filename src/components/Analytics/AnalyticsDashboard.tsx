import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChartBarIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  EyeIcon,
  UserGroupIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../../contexts/AppContext';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

interface DashboardMetrics {
  basicMetrics: {
    total_events: number;
    active_days: number;
    categories_used: number;
    avg_event_value: number;
  };
  eventsByCategory: Array<{
    event_category: string;
    count: number;
    unique_actions: number;
  }>;
  performanceMetrics: Array<{
    metric_type: string;
    avg_value: number;
    min_value: number;
    max_value: number;
    count: number;
  }>;
  dailyTrends: Array<{
    date: string;
    events_count: number;
    categories_count: number;
  }>;
  topActions: Array<{
    event_action: string;
    event_category: string;
    count: number;
  }>;
  dateRange: {
    start: string;
    end: string;
  };
}

interface UserSegment {
  segment: string;
  event_count: number;
  first_event?: string;
  last_event?: string;
}

const AnalyticsDashboard: React.FC = () => {
  const { state } = useApp();
  const userId = state.user?.id;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [userSegment, setUserSegment] = useState<UserSegment | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [error, setError] = useState<string | null>(null);

  const dateRangeOptions = [
    { value: '7d', label: 'Últimos 7 dias' },
    { value: '30d', label: 'Últimos 30 dias' },
    { value: '90d', label: 'Últimos 90 dias' },
    { value: '365d', label: 'Último ano' },
  ];

  useEffect(() => {
    loadDashboardData();
  }, [dateRange, userId]);

  const loadDashboardData = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      
      // Carregar métricas do dashboard
      const metricsResponse = await fetch(`/api/analytics/dashboard?dateRange=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!metricsResponse.ok) {
        throw new Error('Erro ao carregar métricas');
      }
      
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData.data);
      
      // Carregar segmento do usuário
      const segmentResponse = await fetch('/api/analytics/user/segment', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (segmentResponse.ok) {
        const segmentData = await segmentResponse.json();
        setUserSegment(segmentData.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      setError('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const downloadExcelReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/analytics/reports/excel?dateRange=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      alert('Erro ao gerar relatório Excel');
    }
  };

  const downloadPDFReport = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/analytics/reports/pdf?dateRange=${dateRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Erro ao gerar relatório');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `analytics-report-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Erro ao baixar relatório:', error);
      alert('Erro ao gerar relatório PDF');
    }
  };

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'power_user': return 'text-purple-600 bg-purple-100';
      case 'regular_user': return 'text-blue-600 bg-blue-100';
      case 'casual_user': return 'text-green-600 bg-green-100';
      case 'new_user': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSegmentLabel = (segment: string) => {
    switch (segment) {
      case 'power_user': return 'Usuário Avançado';
      case 'regular_user': return 'Usuário Regular';
      case 'casual_user': return 'Usuário Casual';
      case 'new_user': return 'Novo Usuário';
      default: return 'Desconhecido';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Erro</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={loadDashboardData}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Nenhum dado disponível</p>
      </div>
    );
  }

  // Configuração dos gráficos
  const dailyTrendsData = {
    labels: metrics.dailyTrends.map(item => format(parseISO(item.date), 'dd/MM', { locale: ptBR })),
    datasets: [
      {
        label: 'Eventos',
        data: metrics.dailyTrends.map(item => item.events_count),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      },
      {
        label: 'Categorias',
        data: metrics.dailyTrends.map(item => item.categories_count),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      },
    ],
  };

  const eventsByCategoryData = {
    labels: metrics.eventsByCategory.map(item => item.event_category),
    datasets: [
      {
        data: metrics.eventsByCategory.map(item => item.count),
        backgroundColor: [
          '#3B82F6',
          '#10B981',
          '#F59E0B',
          '#EF4444',
          '#8B5CF6',
          '#06B6D4',
          '#84CC16',
          '#F97316',
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const topActionsData = {
    labels: metrics.topActions.map(item => `${item.event_action} (${item.event_category})`),
    datasets: [
      {
        label: 'Contagem',
        data: metrics.topActions.map(item => item.count),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="mt-1 text-sm text-gray-500">
            Período: {format(parseISO(metrics.dateRange.start), 'dd/MM/yyyy', { locale: ptBR })} - {format(parseISO(metrics.dateRange.end), 'dd/MM/yyyy', { locale: ptBR })}
          </p>
        </div>
        
        <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {dateRangeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <div className="flex gap-2">
            <button
              onClick={downloadExcelReport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              Excel
            </button>
            <button
              onClick={downloadPDFReport}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Métricas básicas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <EyeIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total de Eventos</dt>
                  <dd className="text-lg font-medium text-gray-900">{metrics.basicMetrics.total_events.toLocaleString()}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Dias Ativos</dt>
                  <dd className="text-lg font-medium text-gray-900">{metrics.basicMetrics.active_days}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Categorias Usadas</dt>
                  <dd className="text-lg font-medium text-gray-900">{metrics.basicMetrics.categories_used}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ArrowTrendingUpIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Valor Médio</dt>
                  <dd className="text-lg font-medium text-gray-900">{(metrics.basicMetrics.avg_event_value || 0).toFixed(2)}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Segmento do usuário */}
      {userSegment && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Seu Perfil de Uso</h3>
          <div className="flex items-center space-x-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getSegmentColor(userSegment.segment)}`}>
              <UserGroupIcon className="h-4 w-4 mr-2" />
              {getSegmentLabel(userSegment.segment)}
            </span>
            <span className="text-sm text-gray-500">
              {userSegment.event_count} eventos registrados
            </span>
          </div>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendências diárias */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Tendências Diárias</h3>
          <div className="h-64">
            <Line data={dailyTrendsData} options={chartOptions} />
          </div>
        </div>

        {/* Eventos por categoria */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Eventos por Categoria</h3>
          <div className="h-64">
            <Doughnut data={eventsByCategoryData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Top ações */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Top Ações</h3>
        <div className="h-64">
          <Bar data={topActionsData} options={chartOptions} />
        </div>
      </div>

      {/* Métricas de performance */}
      {metrics.performanceMetrics.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Métricas de Performance</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo de Métrica
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Médio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Mínimo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Máximo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contagem
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.performanceMetrics.map((metric, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {metric.metric_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.avg_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.min_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.max_value.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {metric.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;