import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  HomeIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  CogIcon,
  CreditCardIcon,
  ShieldCheckIcon,
  BoltIcon,
  PhoneIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  DevicePhoneMobileIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useApp } from '../../contexts/AppContext';

const navigation = [
  { name: 'Dashboard', href: '/dashboard/', icon: HomeIcon },
  { name: 'Agentes de IA', href: '/dashboard/agents', icon: UserGroupIcon },
  { name: 'Conversas', href: '/dashboard/conversations', icon: ChatBubbleLeftRightIcon },
  { name: 'Chat IA', href: '/dashboard/chat', icon: ChatBubbleLeftRightIcon },
  { name: 'WhatsApp', href: '/dashboard/whatsapp', icon: DevicePhoneMobileIcon },
  { name: 'Analytics', href: '/dashboard/analytics', icon: ChartBarIcon },
  { name: 'Integrações', href: '/dashboard/integrations', icon: BoltIcon },
  { name: 'Treinamento', href: '/dashboard/training', icon: DocumentTextIcon },
  { name: 'Canais', href: '/dashboard/channels', icon: PhoneIcon },
  { name: 'Alertas', href: '/dashboard/alerts', icon: ExclamationTriangleIcon },
  { name: 'Pagamentos', href: '/dashboard/payments', icon: CreditCardIcon },
  { name: 'Admin', href: '/dashboard/admin', icon: ShieldCheckIcon },
  { name: 'Configurações', href: '/dashboard/settings', icon: CogIcon },
];

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const location = useLocation();
  const { state } = useApp();

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-colors duration-200">
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 dark:border-gray-700">
        {/* Close button for mobile */}
        <button
          onClick={onClose}
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
        >
          <XMarkIcon className="h-6 w-6" />
        </button>
        <div className="flex items-center">
          <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
             <span className="text-white text-lg font-bold">D</span>
           </div>
          <div className="ml-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Dinâmica</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">SaaS Platform 2025</p>
          </div>
        </div>
      </div>

      {/* Test Mode Indicator */}
      {localStorage.getItem('authToken') === 'demo-token' && (
        <div className="px-6 py-4 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-200 dark:border-primary-700">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-primary-500 rounded-full animate-pulse"></div>
            <p className="ml-3 text-sm font-medium text-primary-800 dark:text-primary-200">Modo Demonstração</p>
          </div>
        </div>
      )}

      {/* User Info */}
      {state.user && (
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center">
            <div className="relative">
              <img
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-gray-200 dark:ring-gray-700"
                src={state.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user.name)}&background=6366f1&color=fff`}
                alt={state.user.name}
              />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-success-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
            </div>
            <div className="ml-4 flex-1 min-w-0">
              <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{state.user.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{state.user.plan} plan</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === '/dashboard/' && location.pathname === '/dashboard');
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={`group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 scale-[1.02]'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-primary-600 dark:hover:text-primary-400 hover:scale-[1.01]'
              }`}
            >
              <item.icon
                className={`mr-4 h-6 w-6 flex-shrink-0 transition-colors duration-200 ${
                  isActive ? 'text-white' : 'text-gray-400 dark:text-gray-500 group-hover:text-primary-500'
                }`}
              />
              <span className="font-medium">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Quick Stats */}
      <div className="px-4 py-6 border-t border-gray-200 dark:border-gray-700">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estatísticas Rápidas</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-300">Agentes Ativos</span>
              <span className="text-lg font-bold text-success-600 dark:text-success-400">
                {localStorage.getItem('authToken') === 'demo-token' ? '8' : (Array.isArray(state.agents) ? state.agents.filter(a => a.isActive).length : 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-300">Conversas Hoje</span>
              <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                {localStorage.getItem('authToken') === 'demo-token' ? '47' : (state.dashboardStats?.activeConversations || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-300">WhatsApp Ativo</span>
              <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                {localStorage.getItem('authToken') === 'demo-token' ? '12' : '0'}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-300">Satisfação</span>
              <span className="text-lg font-bold text-warning-600 dark:text-warning-400">
                {localStorage.getItem('authToken') === 'demo-token' ? '4.8★' : 'N/A'}
              </span>
            </div>
          </div>
          
          {/* Usage Progress */}
          {localStorage.getItem('authToken') === 'demo-token' && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300 mb-2">
                <span>Uso do Plano</span>
                <span className="font-semibold">73%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-300" style={{width: '73%'}}></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">2.190 / 3.000 mensagens</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};