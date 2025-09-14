import React, { useState, useEffect } from 'react';
import {
  FunnelIcon,
  PlusIcon,
  TrashIcon,
  PlayIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../../contexts/AppContext';

interface FunnelStep {
  name: string;
  category: string;
  action: string;
}

interface FunnelResult {
  step: number;
  name: string;
  users: number;
  conversion_rate: string;
}

const FunnelAnalysis: React.FC = () => {
  const { state } = useApp();
  const userId = state.user?.id;
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [results, setResults] = useState<FunnelResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSteps, setLoadingSteps] = useState(true);

  // Carregar steps salvos ou criar steps padrão
  useEffect(() => {
    loadSavedSteps();
  }, [userId]);

  const loadSavedSteps = async () => {
    if (!userId) return;
    
    try {
      setLoadingSteps(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/analytics/funnel/steps', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.steps && data.steps.length > 0) {
          setSteps(data.steps);
        } else {
          // Se não há steps salvos, criar steps padrão baseados nos dados do usuário
          setSteps([
            { name: 'Início da Sessão', category: 'session', action: 'start' },
            { name: 'Visualização de Página', category: 'page_view', action: 'view' }
          ]);
        }
      } else {
        // Fallback para steps básicos
        setSteps([
          { name: 'Início da Sessão', category: 'session', action: 'start' },
          { name: 'Visualização de Página', category: 'page_view', action: 'view' }
        ]);
      }
    } catch (error) {
      console.error('Erro ao carregar steps:', error);
      // Fallback para steps básicos
      setSteps([
        { name: 'Início da Sessão', category: 'session', action: 'start' },
        { name: 'Visualização de Página', category: 'page_view', action: 'view' }
      ]);
    } finally {
      setLoadingSteps(false);
    }
  };

  const saveSteps = async () => {
    if (!userId) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/analytics/funnel/steps', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ steps })
      });
    } catch (error) {
      console.error('Erro ao salvar steps:', error);
    }
  };

  const addStep = () => {
    const newSteps = [...steps, { name: '', category: '', action: '' }];
    setSteps(newSteps);
    saveSteps();
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index: number, field: keyof FunnelStep, value: string) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
    // Salvar automaticamente após alteração
    setTimeout(() => saveSteps(), 500);
  };

  const analyzeFunnel = async () => {
    if (!userId) return;
    
    // Validar steps
    const validSteps = steps.filter(step => 
      step.name.trim() && step.category.trim() && step.action.trim()
    );
    
    if (validSteps.length < 2) {
      setError('É necessário pelo menos 2 etapas válidas para análise');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/analytics/funnel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ steps: validSteps }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao analisar funil');
      }
      
      const data = await response.json();
      setResults(data.data);
    } catch (error) {
      console.error('Erro ao analisar funil:', error);
      setError('Erro ao analisar funil de conversão');
    } finally {
      setLoading(false);
    }
  };

  const getConversionColor = (rate: string) => {
    const numRate = parseFloat(rate);
    if (numRate >= 80) return 'text-green-600 bg-green-100';
    if (numRate >= 60) return 'text-yellow-600 bg-yellow-100';
    if (numRate >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const commonCategories = [
    'page_view',
    'user_engagement',
    'ecommerce',
    'form_interaction',
    'video_engagement',
    'download',
    'social_interaction',
    'search',
  ];

  const commonActions = {
    page_view: ['home', 'product', 'category', 'about', 'contact'],
    user_engagement: ['click', 'scroll', 'hover', 'focus', 'blur'],
    ecommerce: ['add_to_cart', 'remove_from_cart', 'checkout', 'purchase', 'refund'],
    form_interaction: ['form_start', 'form_submit', 'form_error', 'field_focus'],
    video_engagement: ['video_start', 'video_pause', 'video_complete', 'video_seek'],
    download: ['file_download', 'pdf_download', 'image_download'],
    social_interaction: ['share', 'like', 'comment', 'follow'],
    search: ['search_query', 'search_result_click', 'search_filter'],
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <FunnelIcon className="h-8 w-8 mr-3 text-blue-600" />
            Análise de Funil
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Configure as etapas do seu funil de conversão e analise o desempenho
          </p>
        </div>
        
        <button
          onClick={analyzeFunnel}
          disabled={loading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          ) : (
            <PlayIcon className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Analisando...' : 'Analisar Funil'}
        </button>
      </div>

      {/* Configuração das etapas */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Etapas do Funil</h3>
          <button
            onClick={addStep}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Adicionar Etapa
          </button>
        </div>
        
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                </div>
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome da Etapa
                  </label>
                  <input
                    type="text"
                    value={step.name}
                    onChange={(e) => updateStep(index, 'name', e.target.value)}
                    placeholder="Ex: Página Inicial"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Categoria
                  </label>
                  <select
                    value={step.category}
                    onChange={(e) => updateStep(index, 'category', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecione uma categoria</option>
                    {commonCategories.map(category => (
                      <option key={category} value={category}>
                        {category.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ação
                  </label>
                  <select
                    value={step.action}
                    onChange={(e) => updateStep(index, 'action', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    disabled={!step.category}
                  >
                    <option value="">Selecione uma ação</option>
                    {step.category && commonActions[step.category as keyof typeof commonActions]?.map(action => (
                      <option key={action} value={action}>
                        {action.replace('_', ' ').toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(index)}
                  className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Erro</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resultados */}
      {results.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-6 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            Resultados da Análise
          </h3>
          
          {/* Visualização do funil */}
          <div className="mb-8">
            <div className="space-y-4">
              {results.map((result, index) => {
                const width = index === 0 ? 100 : (result.users / results[0].users) * 100;
                
                return (
                  <div key={result.step} className="relative">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0 w-8">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-600">{result.step}</span>
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-medium text-gray-900">{result.name}</h4>
                          <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-500">
                              {result.users.toLocaleString()} usuários
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConversionColor(result.conversion_rate)}`}>
                              {result.conversion_rate}%
                            </span>
                          </div>
                        </div>
                        
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${width}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Seta de conexão */}
                    {index < results.length - 1 && (
                      <div className="flex justify-center mt-2 mb-2">
                        <div className="w-0 h-0 border-l-4 border-r-4 border-t-8 border-l-transparent border-r-transparent border-t-gray-400"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Tabela detalhada */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Etapa
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nome
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuários
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Taxa de Conversão
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Drop-off
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.map((result, index) => {
                  const dropOff = index > 0 
                    ? ((results[index - 1].users - result.users) / results[index - 1].users * 100).toFixed(1)
                    : '0';
                  
                  return (
                    <tr key={result.step}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {result.step}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {result.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.users.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConversionColor(result.conversion_rate)}`}>
                          {result.conversion_rate}%
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {index > 0 ? `${dropOff}%` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {/* Insights */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900 mb-2">Insights</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              {results.length > 1 && (
                <li>
                  • Taxa de conversão geral: {((results[results.length - 1].users / results[0].users) * 100).toFixed(1)}%
                </li>
              )}
              {results.length > 1 && (
                <li>
                  • Maior drop-off: {Math.max(...results.slice(1).map((result, index) => 
                    (results[index].users - result.users) / results[index].users * 100
                  )).toFixed(1)}% entre etapas
                </li>
              )}
              <li>
                • Total de usuários no topo do funil: {results[0]?.users.toLocaleString()}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default FunnelAnalysis;