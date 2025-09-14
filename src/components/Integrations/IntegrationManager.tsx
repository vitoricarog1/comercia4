import React, { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  CogIcon,
  ChatBubbleLeftRightIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../../services/api';

interface Integration {
  platform: string;
  isActive: boolean;
  config?: any;
}

interface IntegrationSetup {
  telegram?: {
    botToken: string;
    webhookUrl: string;
  };
  instagram?: {
    accessToken: string;
    pageId: string;
  };
  facebook_messenger?: {
    accessToken: string;
    pageId: string;
    verifyToken: string;
  };
  email?: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
  };
}

const IntegrationManager: React.FC = () => {
  const [integrations, setIntegrations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [setupModal, setSetupModal] = useState<string | null>(null);
  const [setupData, setSetupData] = useState<IntegrationSetup>({});
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const platformIcons = {
    telegram: ChatBubbleLeftRightIcon,
    instagram: DevicePhoneMobileIcon,
    facebook_messenger: GlobeAltIcon,
    email: EnvelopeIcon,
    whatsapp: ChatBubbleLeftRightIcon
  };

  const platformNames = {
    telegram: 'Telegram',
    instagram: 'Instagram',
    facebook_messenger: 'Facebook Messenger',
    email: 'Email',
    whatsapp: 'WhatsApp'
  };

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await apiService.get('/integrations');
      if (response.success) {
        setIntegrations(response.integrations);
      }
    } catch (error) {
      console.error('Error fetching integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupIntegration = async (platform: string) => {
    try {
      const data = setupData[platform as keyof IntegrationSetup];
      if (!data) return;

      const response = await apiService.post(`/integrations/${platform}/setup`, data);
      
      if (response.success) {
        await fetchIntegrations();
        setSetupModal(null);
        setSetupData({});
        alert('Integração configurada com sucesso!');
      } else {
        alert('Erro ao configurar integração: ' + response.error);
      }
    } catch (error) {
      console.error('Setup error:', error);
      alert('Erro ao configurar integração');
    }
  };

  const handleDisableIntegration = async (platform: string) => {
    if (!confirm(`Tem certeza que deseja desabilitar a integração ${platformNames[platform as keyof typeof platformNames]}?`)) {
      return;
    }

    try {
      const response = await apiService.delete(`/integrations/${platform}`);
      
      if (response.success) {
        await fetchIntegrations();
        alert('Integração desabilitada com sucesso!');
      } else {
        alert('Erro ao desabilitar integração: ' + response.error);
      }
    } catch (error) {
      console.error('Disable error:', error);
      alert('Erro ao desabilitar integração');
    }
  };

  const handleTestConnection = async (platform: string) => {
    try {
      const response = await apiService.get(`/integrations/${platform}/test`);
      setTestResults(prev => ({ ...prev, [platform]: response }));
      
      setTimeout(() => {
        setTestResults(prev => ({ ...prev, [platform]: null }));
      }, 3000);
    } catch (error) {
      console.error('Test error:', error);
      setTestResults(prev => ({ ...prev, [platform]: { success: false, error: 'Erro no teste' } }));
    }
  };

  const renderSetupForm = (platform: string) => {
    const updateSetupData = (field: string, value: any) => {
      setSetupData(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform as keyof IntegrationSetup],
          [field]: value
        }
      }));
    };

    switch (platform) {
      case 'telegram':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bot Token
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                onChange={(e) => updateSetupData('botToken', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Webhook URL
              </label>
              <input
                type="url"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://yourdomain.com/api/integrations/webhooks/telegram"
                onChange={(e) => updateSetupData('webhookUrl', e.target.value)}
              />
            </div>
          </div>
        );

      case 'instagram':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Instagram Access Token"
                onChange={(e) => updateSetupData('accessToken', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Page ID
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Instagram Page ID"
                onChange={(e) => updateSetupData('pageId', e.target.value)}
              />
            </div>
          </div>
        );

      case 'facebook_messenger':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Access Token
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Facebook Page Access Token"
                onChange={(e) => updateSetupData('accessToken', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Page ID
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Facebook Page ID"
                onChange={(e) => updateSetupData('pageId', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Verify Token
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Webhook Verify Token"
                onChange={(e) => updateSetupData('verifyToken', e.target.value)}
              />
            </div>
          </div>
        );

      case 'email':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Host
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="smtp.gmail.com"
                  onChange={(e) => updateSetupData('host', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="587"
                  onChange={(e) => updateSetupData('port', parseInt(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="mr-2"
                  onChange={(e) => updateSetupData('secure', e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-700">Usar SSL/TLS</span>
              </label>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="seu-email@gmail.com"
                onChange={(e) => updateSetupData('user', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha
              </label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Senha ou App Password"
                onChange={(e) => updateSetupData('pass', e.target.value)}
              />
            </div>
          </div>
        );

      default:
        return <div>Configuração não disponível para esta plataforma.</div>;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Integrações Externas</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(platformNames).map(([platform, name]) => {
          const Icon = platformIcons[platform as keyof typeof platformIcons];
          const isActive = integrations.includes(platform);
          const testResult = testResults[platform];

          return (
            <div key={platform} className="bg-white rounded-lg shadow-md p-6 border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Icon className="h-8 w-8 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
                </div>
                <div className="flex items-center space-x-2">
                  {isActive ? (
                    <CheckCircleIcon className="h-6 w-6 text-green-500" />
                  ) : (
                    <XCircleIcon className="h-6 w-6 text-gray-400" />
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-medium ${
                    isActive ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {isActive ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {testResult && (
                  <div className={`p-2 rounded text-sm ${
                    testResult.success 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {testResult.success ? testResult.message : testResult.error}
                  </div>
                )}

                <div className="flex space-x-2">
                  {!isActive ? (
                    <button
                      onClick={() => setSetupModal(platform)}
                      className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 flex items-center justify-center"
                    >
                      <PlusIcon className="h-4 w-4 mr-1" />
                      Configurar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleTestConnection(platform)}
                        className="flex-1 bg-gray-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 flex items-center justify-center"
                      >
                        <CogIcon className="h-4 w-4 mr-1" />
                        Testar
                      </button>
                      <button
                        onClick={() => handleDisableIntegration(platform)}
                        className="bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Setup Modal */}
      {setupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Configurar {platformNames[setupModal as keyof typeof platformNames]}
              </h3>
              <button
                onClick={() => setSetupModal(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            {renderSetupForm(setupModal)}

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setSetupModal(null)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md font-medium hover:bg-gray-400"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleSetupIntegration(setupModal)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700"
              >
                Configurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationManager;