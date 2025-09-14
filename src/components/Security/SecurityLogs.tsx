import React, { useState, useEffect } from 'react';
import { apiService } from '../../services/api';
import { useNotification } from '../../contexts/NotificationContext';

interface SecurityLog {
  id: string;
  event_type: string;
  description: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  status: 'success' | 'warning' | 'error';
}

const SecurityLogs: React.FC = () => {
  const [logs, setLogs] = useState<SecurityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { showError } = useNotification();

  useEffect(() => {
    loadSecurityLogs();
  }, []);

  const loadSecurityLogs = async () => {
    try {
      const response = await apiService.get('/user/security-logs');
      if (response.success) {
        setLogs(response.data);
      } else {
        showError('Erro ao carregar logs', 'Não foi possível carregar os logs de segurança');
      }
    } catch (error) {
      console.error('Error loading security logs:', error);
      showError('Erro de conexão', 'Não foi possível conectar ao servidor');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse p-3 bg-gray-100 rounded-md">
            <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-300 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.length === 0 ? (
        <div className="p-3 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-sm text-gray-600">Nenhum evento de segurança registrado</p>
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className={`flex items-center justify-between p-3 rounded-md border ${getStatusColor(log.status)}`}>
            <div>
              <p className="text-sm font-medium">{log.description}</p>
              <p className="text-xs opacity-75">
                {formatDate(log.created_at)} • IP: {log.ip_address}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default SecurityLogs;