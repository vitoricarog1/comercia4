import React, { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  ChatBubbleLeftRightIcon,
  BellIcon,
  ClockIcon,
  GlobeAltIcon,
  CheckIcon,
  XMarkIcon,
  PlayIcon
} from '@heroicons/react/24/outline';

interface NotificationSettingsProps {
  onBack: () => void;
  onTestNotification: () => void;
}

interface GeneralSettings {
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
  email_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  push_frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
  quiet_hours_start: string;
  quiet_hours_end: string;
  timezone: string;
}

interface NotificationType {
  id: number;
  name: string;
  description: string;
  category: string;
  priority: string;
  default_enabled: boolean;
}

interface TypePreference {
  notification_type_id: number;
  email_enabled: boolean;
  push_enabled: boolean;
  sms_enabled: boolean;
}

interface Device {
  id: number;
  device_type: string;
  device_name: string;
  app_version: string;
  os_version: string;
  is_active: boolean;
  last_used_at: string;
  created_at: string;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  onBack,
  onTestNotification
}) => {
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings>({
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
    email_frequency: 'immediate',
    push_frequency: 'immediate',
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    timezone: 'America/Sao_Paulo'
  });
  
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
  const [typePreferences, setTypePreferences] = useState<TypePreference[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'types' | 'devices'>('general');

  useEffect(() => {
    loadSettings();
    loadDevices();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setGeneralSettings(data.data.general_settings);
        setNotificationTypes(data.data.available_types);
        setTypePreferences(data.data.type_preferences);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await fetch('/api/notifications/devices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDevices(data.data);
      }
    } catch (error) {
      console.error('Error loading devices:', error);
    }
  };

  const saveGeneralSettings = async () => {
    setSaving(true);
    
    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(generalSettings)
      });
      
      if (response.ok) {
        alert('Configurações salvas com sucesso!');
      } else {
        alert('Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const updateTypePreference = async (typeId: number, field: keyof TypePreference, value: boolean) => {
    try {
      const response = await fetch(`/api/notifications/settings/types/${typeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          [field]: value,
          // Manter valores existentes para outros campos
          ...getTypePreference(typeId)
        })
      });
      
      if (response.ok) {
        // Atualizar estado local
        setTypePreferences(prev => {
          const existing = prev.find(p => p.notification_type_id === typeId);
          if (existing) {
            return prev.map(p => 
              p.notification_type_id === typeId 
                ? { ...p, [field]: value }
                : p
            );
          } else {
            return [...prev, {
              notification_type_id: typeId,
              email_enabled: field === 'email_enabled' ? value : true,
              push_enabled: field === 'push_enabled' ? value : true,
              sms_enabled: field === 'sms_enabled' ? value : false
            }];
          }
        });
      }
    } catch (error) {
      console.error('Error updating type preference:', error);
    }
  };

  const removeDevice = async (deviceId: number) => {
    if (!confirm('Tem certeza que deseja remover este dispositivo?')) return;
    
    try {
      const response = await fetch(`/api/notifications/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        setDevices(prev => prev.filter(d => d.id !== deviceId));
      }
    } catch (error) {
      console.error('Error removing device:', error);
    }
  };

  const getTypePreference = (typeId: number) => {
    return typePreferences.find(p => p.notification_type_id === typeId) || {
      notification_type_id: typeId,
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false
    };
  };

  const formatDeviceType = (type: string) => {
    switch (type) {
      case 'ios': return 'iOS';
      case 'android': return 'Android';
      case 'web': return 'Web';
      default: return type;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'security':
        return '🔒';
      case 'billing':
        return '💳';
      case 'feature':
        return '✨';
      case 'marketing':
        return '📢';
      default:
        return '🔔';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Configurações de Notificação</h1>
        </div>
        
        <button
          onClick={onTestNotification}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <PlayIcon className="h-4 w-4" />
          <span>Testar Notificação</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Configurações Gerais
          </button>
          <button
            onClick={() => setActiveTab('types')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'types'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Tipos de Notificação
          </button>
          <button
            onClick={() => setActiveTab('devices')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'devices'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Dispositivos
          </button>
        </nav>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Channel Settings */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Canais de Notificação</h3>
            
            <div className="space-y-4">
              {/* Email */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Email</p>
                    <p className="text-sm text-gray-500">Receber notificações por email</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <select
                    value={generalSettings.email_frequency}
                    onChange={(e) => setGeneralSettings(prev => ({
                      ...prev,
                      email_frequency: e.target.value as any
                    }))}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    disabled={!generalSettings.email_enabled}
                  >
                    <option value="immediate">Imediato</option>
                    <option value="hourly">A cada hora</option>
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                  </select>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generalSettings.email_enabled}
                      onChange={(e) => setGeneralSettings(prev => ({
                        ...prev,
                        email_enabled: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Push */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Push Notifications</p>
                    <p className="text-sm text-gray-500">Notificações no dispositivo</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <select
                    value={generalSettings.push_frequency}
                    onChange={(e) => setGeneralSettings(prev => ({
                      ...prev,
                      push_frequency: e.target.value as any
                    }))}
                    className="text-sm border border-gray-300 rounded-md px-3 py-1"
                    disabled={!generalSettings.push_enabled}
                  >
                    <option value="immediate">Imediato</option>
                    <option value="hourly">A cada hora</option>
                    <option value="daily">Diário</option>
                    <option value="weekly">Semanal</option>
                  </select>
                  
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generalSettings.push_enabled}
                      onChange={(e) => setGeneralSettings(prev => ({
                        ...prev,
                        push_enabled: e.target.checked
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* SMS */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">SMS</p>
                    <p className="text-sm text-gray-500">Mensagens de texto (apenas críticas)</p>
                  </div>
                </div>
                
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generalSettings.sms_enabled}
                    onChange={(e) => setGeneralSettings(prev => ({
                      ...prev,
                      sms_enabled: e.target.checked
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <ClockIcon className="h-5 w-5" />
              <span>Horário de Silêncio</span>
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Início
                </label>
                <input
                  type="time"
                  value={generalSettings.quiet_hours_start}
                  onChange={(e) => setGeneralSettings(prev => ({
                    ...prev,
                    quiet_hours_start: e.target.value
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fim
                </label>
                <input
                  type="time"
                  value={generalSettings.quiet_hours_end}
                  onChange={(e) => setGeneralSettings(prev => ({
                    ...prev,
                    quiet_hours_end: e.target.value
                  }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>
            
            <p className="text-sm text-gray-500 mt-2">
              Durante este período, apenas notificações críticas serão enviadas.
            </p>
          </div>

          {/* Timezone */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <GlobeAltIcon className="h-5 w-5" />
              <span>Fuso Horário</span>
            </h3>
            
            <select
              value={generalSettings.timezone}
              onChange={(e) => setGeneralSettings(prev => ({
                ...prev,
                timezone: e.target.value
              }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
              <option value="America/New_York">New York (GMT-5)</option>
              <option value="Europe/London">London (GMT+0)</option>
              <option value="Asia/Tokyo">Tokyo (GMT+9)</option>
            </select>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={saveGeneralSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </div>
      )}

      {/* Notification Types Tab */}
      {activeTab === 'types' && (
        <div className="space-y-4">
          {notificationTypes.map((type) => {
            const preference = getTypePreference(type.id);
            
            return (
              <div key={type.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{getCategoryIcon(type.category)}</span>
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {type.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`text-xs font-medium ${getPriorityColor(type.priority)}`}>
                          {type.priority.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {type.category.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    {/* Email Toggle */}
                    <div className="text-center">
                      <EnvelopeIcon className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preference.email_enabled}
                          onChange={(e) => updateTypePreference(type.id, 'email_enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    {/* Push Toggle */}
                    <div className="text-center">
                      <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preference.push_enabled}
                          onChange={(e) => updateTypePreference(type.id, 'push_enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    {/* SMS Toggle */}
                    <div className="text-center">
                      <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preference.sms_enabled}
                          onChange={(e) => updateTypePreference(type.id, 'sms_enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Devices Tab */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          {devices.length === 0 ? (
            <div className="text-center py-12">
              <DevicePhoneMobileIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Nenhum dispositivo registrado</p>
              <p className="text-sm text-gray-400 mt-2">
                Dispositivos serão registrados automaticamente quando você acessar o app.
              </p>
            </div>
          ) : (
            devices.map((device) => (
              <div key={device.id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <DevicePhoneMobileIcon className="h-6 w-6 text-gray-600" />
                    </div>
                    
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">
                        {device.device_name || `Dispositivo ${formatDeviceType(device.device_type)}`}
                      </h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Tipo: {formatDeviceType(device.device_type)}</p>
                        {device.app_version && (
                          <p>Versão do App: {device.app_version}</p>
                        )}
                        {device.os_version && (
                          <p>Sistema: {device.os_version}</p>
                        )}
                        <p>Último uso: {new Date(device.last_used_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      {device.is_active ? (
                        <>
                          <CheckIcon className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600">Ativo</span>
                        </>
                      ) : (
                        <>
                          <XMarkIcon className="h-5 w-5 text-red-500" />
                          <span className="text-sm text-red-600">Inativo</span>
                        </>
                      )}
                    </div>
                    
                    <button
                      onClick={() => removeDevice(device.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;