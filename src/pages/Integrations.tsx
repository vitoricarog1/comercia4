import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  KeyIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../contexts/AppContext';
import { aiService, getImplementationTutorial } from '../services/aiProviders';

interface ConfigurationErrors {
  apiKey?: string;
  model?: string;
  general?: string;
}

export const Integrations: React.FC = () => {
  const { state, dispatch } = useApp();
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showTutorial, setShowTutorial] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [testLoading, setTestLoading] = useState<string | null>(null);
  const [configErrors, setConfigErrors] = useState<ConfigurationErrors>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (!token || token === 'demo-token') {
      // Mock data for testing
      const mockProviders = [
        {
          id: 'openai-1',
          name: 'OpenAI GPT',
          type: 'chatgpt',
          models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo'],
          isConfigured: true,
          config: { apiKey: 'sk-demo...', model: 'gpt-3.5-turbo' }
        },
        {
          id: 'google-1',
          name: 'Google Gemini',
          type: 'gemini',
          models: ['gemini-pro', 'gemini-pro-vision'],
          isConfigured: false,
          config: {}
        },
        {
          id: 'huggingface-1',
          name: 'Hugging Face',
          type: 'huggingface',
          models: ['mistral-7b', 'llama-2-7b', 'code-llama'],
          isConfigured: true,
          config: { apiKey: 'hf_demo...', model: 'mistral-7b' }
        }
      ];
      dispatch({ type: 'SET_AI_PROVIDERS', payload: mockProviders });
    } else {
      const providers = aiService.getProviders();
      dispatch({ type: 'SET_AI_PROVIDERS', payload: providers });
    }
  }, [dispatch]);

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const validateConfiguration = (): boolean => {
    const errors: ConfigurationErrors = {};
    
    if (!apiKey.trim()) {
      errors.apiKey = 'API Key é obrigatória';
    } else if (apiKey.trim().length < 10) {
      errors.apiKey = 'API Key deve ter pelo menos 10 caracteres';
    }
    
    setConfigErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetConfigurationForm = () => {
    setSelectedProvider(null);
    setApiKey('');
    setSelectedModel('');
    setConfigErrors({});
    setSuccessMessage(null);
  };

  const handleConfigureProvider = async (providerId: string) => {
    if (!validateConfiguration()) return;
    
    setConfigLoading(true);
    setConfigErrors({});
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token || token === 'demo-token') {
        // Mock configuration for testing
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API delay
        
        const updatedProviders = state.aiProviders.map(provider => 
          provider.id === providerId 
            ? { 
                ...provider, 
                isConfigured: true, 
                config: { apiKey: apiKey.trim(), model: selectedModel } 
              }
            : provider
        );
        
        dispatch({ type: 'SET_AI_PROVIDERS', payload: updatedProviders });
        
        const providerName = state.aiProviders.find(p => p.id === providerId)?.name;
        setSuccessMessage(`${providerName} configurado com sucesso!`);
        resetConfigurationForm();
      } else {
        aiService.configureProvider(providerId, { 
          apiKey: apiKey.trim(),
          model: selectedModel 
        });
        
        const updatedProviders = aiService.getProviders();
        dispatch({ type: 'SET_AI_PROVIDERS', payload: updatedProviders });
        
        const providerName = state.aiProviders.find(p => p.id === providerId)?.name;
        setSuccessMessage(`${providerName} configurado com sucesso!`);
        resetConfigurationForm();
      }
    } catch (error) {
      setConfigErrors({ 
        general: error instanceof Error ? error.message : 'Erro ao configurar provedor' 
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const testConnection = async (providerId: string) => {
    setTestLoading(providerId);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token || token === 'demo-token') {
        // Mock connection test for testing
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay
        
        const providerName = state.aiProviders.find(p => p.id === providerId)?.name;
        setSuccessMessage(`Teste de ${providerName} realizado com sucesso! Conexão estabelecida.`);
      } else {
        const response = await aiService.sendMessage(
          providerId,
          'Teste de conexão - responda apenas "Conexão estabelecida com sucesso!"',
          '',
          'professional'
        );
        
        const providerName = state.aiProviders.find(p => p.id === providerId)?.name;
        setSuccessMessage(`Teste de ${providerName} realizado com sucesso!`);
      }
    } catch (error) {
      const providerName = state.aiProviders.find(p => p.id === providerId)?.name;
      setConfigErrors({ 
        general: `Erro no teste de ${providerName}: ${error instanceof Error ? error.message : 'Erro desconhecido'}` 
      });
    } finally {
      setTestLoading(null);
    }
  };

  const tutorials = getImplementationTutorial();

  const integrationChannels = [
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      description: 'Conecte com a API oficial do WhatsApp Business',
      icon: '📱',
      status: 'pending',
      color: 'green',
    },
    // Outras integrações serão disponibilizadas em breve
  ];

  // Integrações em desenvolvimento (ocultas temporariamente)
  const upcomingIntegrations = [
    {
      id: 'telegram',
      name: 'Telegram Bot',
      description: 'Em desenvolvimento - Disponível em breve',
      icon: '✈️',
      status: 'coming_soon',
      color: 'gray',
    },
    {
      id: 'messenger',
      name: 'Facebook Messenger',
      description: 'Em desenvolvimento - Disponível em breve',
      icon: '💬',
      status: 'coming_soon',
      color: 'gray',
    },
    {
      id: 'email',
      name: 'Email',
      description: 'Em desenvolvimento - Disponível em breve',
      icon: '📧',
      status: 'coming_soon',
      color: 'gray',
    },
    {
      id: 'website',
      name: 'Chat Website',
      description: 'Em desenvolvimento - Disponível em breve',
      icon: '🌐',
      status: 'coming_soon',
      color: 'gray',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Success Message */}
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-green-50 border border-green-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-green-700">{successMessage}</p>
          </div>
        </motion.div>
      )}

      {/* Error Message */}
      {configErrors.general && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500 mr-2" />
            <p className="text-red-700">{configErrors.general}</p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrações</h1>
          <p className="text-gray-600">Configure provedores de IA e canais de comunicação</p>
        </div>
      </div>

      {/* AI Providers Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Provedores de IA</h2>
          <div className="text-sm text-gray-500">
            {state.aiProviders.filter(p => p.isConfigured).length} de {state.aiProviders.length} configurados
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {state.aiProviders.map((provider, index) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    provider.type === 'chatgpt' ? 'bg-green-100' :
                    provider.type === 'gemini' ? 'bg-blue-100' : 'bg-purple-100'
                  }`}>
                    {provider.type === 'chatgpt' && '🤖'}
                    {provider.type === 'gemini' && '🧠'}
                    {provider.type === 'huggingface' && '🤗'}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-sm text-gray-500">{provider.models.length} modelos</p>
                  </div>
                </div>
                {provider.isConfigured ? (
                  <CheckCircleIcon className="w-6 h-6 text-green-500" />
                ) : (
                  <ExclamationTriangleIcon className="w-6 h-6 text-yellow-500" />
                )}
              </div>

              <div className="space-y-3">
                <div className={`px-3 py-2 rounded-lg text-sm ${
                  provider.isConfigured 
                    ? 'bg-green-50 text-green-700' 
                    : 'bg-yellow-50 text-yellow-700'
                }`}>
                  {provider.isConfigured ? 'Configurado' : 'Não configurado'}
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedProvider(provider.id)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <CogIcon className="w-4 h-4 inline mr-1" />
                    Configurar
                  </button>
                  <button
                    onClick={() => setShowTutorial(provider.type)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                  >
                    Tutorial
                  </button>
                </div>

                {provider.isConfigured && (
                  <button
                    onClick={() => testConnection(provider.id)}
                    disabled={testLoading === provider.id}
                    className={`w-full px-3 py-2 rounded-lg transition-colors text-sm flex items-center justify-center ${
                      testLoading === provider.id
                        ? 'bg-green-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white`}
                  >
                    {testLoading === provider.id ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Testando...
                      </>
                    ) : (
                      'Testar Conexão'
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Communication Channels */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Canais de Comunicação</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrationChannels.map((channel, index) => (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">{channel.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{channel.name}</h3>
                    <p className="text-sm text-gray-500">{channel.description}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className={`px-3 py-2 rounded-lg text-sm ${
                  channel.status === 'connected' ? 'bg-green-50 text-green-700' :
                  channel.status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                  'bg-gray-50 text-gray-700'
                }`}>
                  {channel.status === 'connected' && 'Conectado'}
                  {channel.status === 'pending' && 'Pendente aprovação'}
                  {channel.status === 'available' && 'Disponível'}
                </div>

                <button className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
                  <LinkIcon className="w-4 h-4 inline mr-1" />
                  {channel.status === 'connected' ? 'Gerenciar' : 'Conectar'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Upcoming Integrations Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Próximas Integrações</h2>
          <div className="text-sm text-gray-500">
            Em desenvolvimento
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {upcomingIntegrations.map((channel, index) => (
            <motion.div
              key={channel.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="border border-gray-200 rounded-lg p-6 bg-gray-50 opacity-75"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="text-2xl grayscale">{channel.icon}</div>
                  <div>
                    <h3 className="font-semibold text-gray-600">{channel.name}</h3>
                    <p className="text-sm text-gray-500">{channel.description}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="px-3 py-2 rounded-lg text-sm bg-gray-100 text-gray-600">
                  Em breve
                </div>

                <button 
                  disabled
                  className="w-full px-3 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed text-sm"
                >
                  Disponível em breve
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Configuration Modal */}
      {selectedProvider && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Configurar {state.aiProviders.find(p => p.id === selectedProvider)?.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  API Key *
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    if (configErrors.apiKey) {
                      setConfigErrors(prev => ({ ...prev, apiKey: undefined }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                    configErrors.apiKey
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  }`}
                  placeholder="Cole sua API key aqui..."
                  disabled={configLoading}
                />
                {configErrors.apiKey && (
                  <p className="mt-1 text-sm text-red-600">{configErrors.apiKey}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modelo (opcional)
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={configLoading}
                >
                  <option value="">Selecione um modelo</option>
                  {state.aiProviders.find(p => p.id === selectedProvider)?.models.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => handleConfigureProvider(selectedProvider)}
                disabled={configLoading}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                  configLoading
                    ? 'bg-blue-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white`}
              >
                {configLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
              <button
                onClick={resetConfigurationForm}
                disabled={configLoading}
                className={`flex-1 px-4 py-2 border border-gray-300 rounded-lg transition-colors ${
                  configLoading
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tutorial Modal */}
      {showTutorial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {tutorials[showTutorial as keyof typeof tutorials].title}
            </h3>
            
            <div className="space-y-3">
              {tutorials[showTutorial as keyof typeof tutorials].steps.map((step, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                    {index + 1}
                  </div>
                  <p className="text-sm text-gray-700">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                📚 Documentação completa: 
                <a 
                  href={tutorials[showTutorial as keyof typeof tutorials].documentation}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 underline hover:text-blue-800"
                >
                  {tutorials[showTutorial as keyof typeof tutorials].documentation}
                </a>
              </p>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTutorial(null)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Integrations;