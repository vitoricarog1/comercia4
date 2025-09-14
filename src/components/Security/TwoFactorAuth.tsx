import React, { useState, useEffect } from 'react';
import { QrCodeIcon, ShieldCheckIcon, KeyIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { api } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

interface TwoFactorAuthProps {
  user: {
    id: string;
    two_factor_enabled: boolean;
  };
  onUpdate: () => void;
}

interface SetupData {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({ user, onUpdate }) => {
  const [isEnabled, setIsEnabled] = useState(user.two_factor_enabled);
  const [isLoading, setIsLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [password, setPassword] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'main' | 'setup' | 'verify' | 'disable'>('main');
  const { addNotification } = useNotification();

  useEffect(() => {
    setIsEnabled(user.two_factor_enabled);
  }, [user.two_factor_enabled]);

  const handleSetup2FA = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/2fa/setup');
      if (response.data.success) {
        setSetupData(response.data);
        setStep('setup');
        addNotification('QR Code gerado com sucesso', 'success');
      }
    } catch (error: any) {
      addNotification(
        error.response?.data?.error || 'Erro ao configurar 2FA',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!verificationToken.trim()) {
      addNotification('Digite o código de verificação', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/2fa/verify', {
        token: verificationToken
      });
      
      if (response.data.success) {
        setIsEnabled(true);
        setStep('main');
        setVerificationToken('');
        setSetupData(null);
        onUpdate();
        addNotification('2FA ativado com sucesso!', 'success');
      }
    } catch (error: any) {
      addNotification(
        error.response?.data?.error || 'Código inválido',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!password.trim()) {
      addNotification('Digite sua senha atual', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.post('/auth/2fa/disable', {
        password
      });
      
      if (response.data.success) {
        setIsEnabled(false);
        setStep('main');
        setPassword('');
        onUpdate();
        addNotification('2FA desativado com sucesso', 'success');
      }
    } catch (error: any) {
      addNotification(
        error.response?.data?.error || 'Erro ao desativar 2FA',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBackupCodes = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/2fa/backup-codes');
      if (response.data.success) {
        setBackupCodes(response.data.backupCodes);
        setShowBackupCodes(true);
        addNotification('Novos códigos de backup gerados', 'success');
      }
    } catch (error: any) {
      addNotification(
        error.response?.data?.error || 'Erro ao gerar códigos de backup',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    addNotification('Códigos copiados para a área de transferência', 'success');
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes-2fa.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (step === 'setup' && setupData) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <QrCodeIcon className="h-6 w-6 text-blue-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-900">Configurar Autenticação de Dois Fatores</h3>
        </div>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Escaneie o QR Code abaixo com seu aplicativo autenticador (Google Authenticator, Authy, etc.)
            </p>
            <div className="inline-block p-4 bg-white border-2 border-gray-300 rounded-lg">
              <img 
                src={setupData.qrCode} 
                alt="QR Code para 2FA" 
                className="w-48 h-48"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ou digite manualmente a chave secreta:
            </label>
            <div className="bg-gray-50 p-3 rounded-md border">
              <code className="text-sm font-mono text-gray-800 break-all">
                {setupData.secret}
              </code>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Códigos de Backup (guarde em local seguro):
            </label>
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-2">Importante: Guarde estes códigos em local seguro!</p>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                    {setupData.backupCodes.map((code, index) => (
                      <div key={index} className="bg-white p-2 rounded border">
                        {code}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => {
                setStep('verify');
              }}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Continuar para Verificação
            </button>
            <button
              onClick={() => {
                setStep('main');
                setSetupData(null);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'verify') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <ShieldCheckIcon className="h-6 w-6 text-green-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-900">Verificar Configuração</h3>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador:
          </p>

          <div>
            <input
              type="text"
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono"
              maxLength={6}
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleVerify2FA}
              disabled={isLoading || verificationToken.length !== 6}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Verificando...' : 'Ativar 2FA'}
            </button>
            <button
              onClick={() => setStep('setup')}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'disable') {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-6">
          <ExclamationTriangleIcon className="h-6 w-6 text-red-600 mr-3" />
          <h3 className="text-lg font-medium text-gray-900">Desativar Autenticação de Dois Fatores</h3>
        </div>

        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">
              <strong>Atenção:</strong> Desativar o 2FA reduzirá a segurança da sua conta.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Digite sua senha atual para confirmar:
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Sua senha atual"
            />
          </div>

          <div className="flex space-x-3">
            <button
              onClick={handleDisable2FA}
              disabled={isLoading || !password.trim()}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Desativando...' : 'Desativar 2FA'}
            </button>
            <button
              onClick={() => {
                setStep('main');
                setPassword('');
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <ShieldCheckIcon className="h-6 w-6 text-blue-600 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Autenticação de Dois Fatores</h3>
            <p className="text-sm text-gray-500">
              Adicione uma camada extra de segurança à sua conta
            </p>
          </div>
        </div>
        <div className="flex items-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            isEnabled 
              ? 'bg-green-100 text-green-800' 
              : 'bg-gray-100 text-gray-800'
          }`}>
            {isEnabled ? 'Ativado' : 'Desativado'}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          A autenticação de dois fatores (2FA) adiciona uma camada extra de segurança à sua conta, 
          exigindo um código adicional do seu dispositivo móvel além da sua senha.
        </p>

        {!isEnabled ? (
          <div className="space-y-3">
            <button
              onClick={handleSetup2FA}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                'Configurando...'
              ) : (
                <>
                  <ShieldCheckIcon className="h-4 w-4 mr-2" />
                  Ativar 2FA
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex items-center">
                <ShieldCheckIcon className="h-5 w-5 text-green-400 mr-2" />
                <span className="text-sm font-medium text-green-800">
                  Sua conta está protegida com 2FA
                </span>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={handleGenerateBackupCodes}
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {isLoading ? (
                  'Gerando...'
                ) : (
                  <>
                    <KeyIcon className="h-4 w-4 mr-2" />
                    Gerar Novos Códigos de Backup
                  </>
                )}
              </button>
              <button
                onClick={() => setStep('disable')}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
              >
                Desativar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de códigos de backup */}
      {showBackupCodes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <KeyIcon className="h-6 w-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-medium text-gray-900">Códigos de Backup</h3>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start">
                  <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mt-0.5 mr-2 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Importante!</p>
                    <p>Guarde estes códigos em local seguro. Cada código só pode ser usado uma vez.</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <div className="grid grid-cols-1 gap-2 font-mono text-sm">
                  {backupCodes.map((code, index) => (
                    <div key={index} className="bg-white p-2 rounded border text-center">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={copyBackupCodes}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Copiar
                </button>
                <button
                  onClick={downloadBackupCodes}
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                >
                  Baixar
                </button>
              </div>

              <button
                onClick={() => setShowBackupCodes(false)}
                className="w-full border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
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

export default TwoFactorAuth;