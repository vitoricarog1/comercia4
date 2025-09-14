import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  Cog6ToothIcon,
  TrashIcon,
  PlayIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import { apiService } from '../../services/api';

interface Backup {
  id: number;
  file_name: string;
  file_size: number;
  created_at: string;
  status: string;
}

interface BackupConfig {
  id: number;
  user_id: number;
  schedule: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface BackupStats {
  total_backups: number;
  total_size: number;
  last_backup: string | null;
  successful_backups: number;
  success_rate: number;
}

const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [schedule, setSchedule] = useState('0 2 * * *'); // Default: 2:00 AM daily
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [backupsRes, configRes, statsRes] = await Promise.all([
        apiService.get('/backup/list'),
        apiService.get('/backup/config'),
        apiService.get('/backup/stats')
      ]);

      if (backupsRes.success) {
        setBackups(backupsRes.backups);
      }

      if (configRes.success) {
        setConfig(configRes.config);
        if (configRes.config) {
          setSchedule(configRes.config.schedule);
        }
      }

      if (statsRes.success) {
        setStats(statsRes.stats);
      }
    } catch (error) {
      console.error('Erro ao carregar dados de backup:', error);
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    try {
      setCreating(true);
      const response = await apiService.post('/backup/create');
      
      if (response.success) {
        await loadData();
        alert('Backup criado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar backup:', error);
      alert('Erro ao criar backup');
    } finally {
      setCreating(false);
    }
  };

  const configureBackup = async () => {
    try {
      setConfiguring(true);
      const response = await apiService.post('/backup/configure', {
        schedule
      });
      
      if (response.success) {
        await loadData();
        setShowConfig(false);
        alert('Backup automático configurado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao configurar backup:', error);
      alert('Erro ao configurar backup automático');
    } finally {
      setConfiguring(false);
    }
  };

  const restoreBackup = async (backupId: number) => {
    if (!confirm('Tem certeza que deseja restaurar este backup? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const response = await apiService.post(`/backup/restore/${backupId}`);
      
      if (response.success) {
        alert('Backup restaurado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao restaurar backup:', error);
      alert('Erro ao restaurar backup');
    }
  };

  const deleteBackup = async (backupId: number) => {
    if (!confirm('Tem certeza que deseja deletar este backup?')) {
      return;
    }

    try {
      const response = await apiService.delete(`/backup/${backupId}`);
      
      if (response.success) {
        await loadData();
        alert('Backup deletado com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao deletar backup:', error);
      alert('Erro ao deletar backup');
    }
  };

  const testBackup = async () => {
    try {
      const response = await apiService.post('/backup/test');
      
      if (response.success) {
        alert('Teste de backup realizado com sucesso!');
        await loadData();
      }
    } catch (error) {
      console.error('Erro no teste de backup:', error);
      alert('Erro no teste de backup');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getScheduleDescription = (schedule: string) => {
    const scheduleMap: { [key: string]: string } = {
      '0 2 * * *': 'Diário às 02:00',
      '0 2 * * 0': 'Semanal (Domingo às 02:00)',
      '0 2 1 * *': 'Mensal (Dia 1 às 02:00)',
      '0 */6 * * *': 'A cada 6 horas',
      '0 */12 * * *': 'A cada 12 horas'
    };
    return scheduleMap[schedule] || schedule;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciamento de Backup</h2>
          <p className="text-gray-600">Configure e gerencie backups automáticos dos seus dados</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Cog6ToothIcon className="h-5 w-5 mr-2" />
            Configurar
          </button>
          <button
            onClick={createBackup}
            disabled={creating}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            ) : (
              <CloudArrowUpIcon className="h-5 w-5 mr-2" />
            )}
            {creating ? 'Criando...' : 'Criar Backup'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <ChartBarIcon className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Backups</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_backups}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <DocumentArrowDownIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tamanho Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.total_size)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <CheckCircleIcon className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-gray-900">{stats.success_rate}%</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
          >
            <div className="flex items-center">
              <ClockIcon className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Último Backup</p>
                <p className="text-sm font-bold text-gray-900">
                  {stats.last_backup ? formatDate(stats.last_backup) : 'Nunca'}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Current Configuration */}
      {config && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-lg shadow-sm border border-gray-200"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Configuração Atual</h3>
              <p className="text-gray-600">
                Backup automático: <span className="font-medium">{getScheduleDescription(config.schedule)}</span>
              </p>
              <p className="text-sm text-gray-500">
                Status: {config.enabled ? (
                  <span className="text-green-600 font-medium">Ativo</span>
                ) : (
                  <span className="text-red-600 font-medium">Inativo</span>
                )}
              </p>
            </div>
            <button
              onClick={testBackup}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <PlayIcon className="h-5 w-5 mr-2" />
              Testar
            </button>
          </div>
        </motion.div>
      )}

      {/* Backups List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Backups Disponíveis</h3>
        </div>
        
        {backups.length === 0 ? (
          <div className="p-8 text-center">
            <CloudArrowDownIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Nenhum backup encontrado</p>
            <p className="text-sm text-gray-500">Crie seu primeiro backup clicando no botão acima</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {backups.map((backup, index) => (
              <motion.div
                key={backup.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h4 className="text-sm font-medium text-gray-900">{backup.file_name}</h4>
                      {backup.status === 'completed' ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 ml-2" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500 ml-2" />
                      )}
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span>{formatFileSize(backup.file_size)}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(backup.created_at)}</span>
                      <span className="mx-2">•</span>
                      <span className={`capitalize ${
                        backup.status === 'completed' ? 'text-green-600' : 'text-yellow-600'
                      }`}>
                        {backup.status === 'completed' ? 'Concluído' : backup.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => restoreBackup(backup.id)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Restaurar backup"
                    >
                      <CloudArrowDownIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => deleteBackup(backup.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Deletar backup"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Configurar Backup Automático</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequência do Backup
                </label>
                <select
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="0 2 * * *">Diário às 02:00</option>
                  <option value="0 2 * * 0">Semanal (Domingo às 02:00)</option>
                  <option value="0 2 1 * *">Mensal (Dia 1 às 02:00)</option>
                  <option value="0 */6 * * *">A cada 6 horas</option>
                  <option value="0 */12 * * *">A cada 12 horas</option>
                </select>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Descrição:</strong> {getScheduleDescription(schedule)}
                </p>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowConfig(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={configureBackup}
                disabled={configuring}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {configuring ? 'Configurando...' : 'Salvar'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default BackupManager;