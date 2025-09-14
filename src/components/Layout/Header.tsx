import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, MagnifyingGlassIcon, UserCircleIcon, ArrowRightOnRectangleIcon, ChevronDownIcon, Cog6ToothIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useApp } from '../../contexts/AppContext';
import ThemeToggle from '../UI/ThemeToggle';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { state, dispatch } = useApp();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    window.location.href = '/login';
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Check for test credentials
    const authToken = localStorage.getItem('authToken');
    if (authToken === 'demo-token' && searchQuery.trim()) {
      alert(`Busca simulada por: "${searchQuery}". Em um ambiente real, isso filtraria agentes, conversas e clientes.`);
    }
  };

  const [notifications, setNotifications] = useState<any[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // Carregar notificações reais da API
  const loadNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/notifications?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setNotifications(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // Carregar notificações ao montar o componente
  useEffect(() => {
    loadNotifications();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4 transition-colors duration-200">
      <div className="flex items-center justify-between">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 mr-4"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-lg">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field block w-full pl-10 pr-3 py-2 dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                placeholder="Buscar agentes, conversas, clientes..."
              />
            </div>
          </form>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <ThemeToggle size="md" />
          
          {/* Notifications */}
          <div className="relative" ref={notificationRef}>
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gray-400 dark:text-gray-500 hover:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg transition-colors duration-200"
            >
              <BellIcon className="h-6 w-6" />
              {localStorage.getItem('authToken') === 'demo-token' && (
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400 animate-pulse"></span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && localStorage.getItem('authToken') === 'demo-token' && (
              <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-dropdown animate-slide-down">
                <div className="py-1">
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-h3 text-gray-900 dark:text-white">Notificações</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="px-4 py-8 text-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
                        <p className="text-caption text-gray-500 dark:text-gray-400 mt-2">Carregando...</p>
                      </div>
                    ) : notifications.length > 0 ? (
                      notifications.map((notification) => {
                        const timeAgo = notification.created_at ? 
                          new Date(notification.created_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : 'Agora';
                        
                        return (
                          <div key={notification.id} className={`px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 ${!notification.is_read ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                            <div className="flex items-start">
                              <div className="flex-1">
                                <p className="text-body font-medium text-gray-900 dark:text-white">{notification.title}</p>
                                <p className="text-body text-gray-500 dark:text-gray-300">{notification.message}</p>
                                <p className="text-caption text-gray-400 dark:text-gray-500 mt-1">{timeAgo}</p>
                              </div>
                              {!notification.is_read && (
                                <div className="ml-2 w-2 h-2 bg-blue-600 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <BellIcon className="h-8 w-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                        <p className="text-body text-gray-500 dark:text-gray-400">Nenhuma notificação</p>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
                    <button className="text-body text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200">Ver todas as notificações</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <div className="text-right">
                <p className="text-body font-medium text-gray-900 dark:text-white">{state.user?.name}</p>
                <p className="text-caption text-gray-500 dark:text-gray-400">{state.user?.email}</p>
              </div>
              <img
                className="h-8 w-8 rounded-full"
                src={state.user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.user?.name || 'User')}&background=6366f1&color=fff`}
                alt={state.user?.name}
              />
              <ChevronDownIcon className="h-4 w-4 text-gray-400 dark:text-gray-500" />
            </button>

            {/* Dropdown menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:ring-gray-700 z-dropdown animate-slide-down">
                <div className="py-1">
                  <button className="flex items-center w-full px-4 py-2 text-body text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200">
                    <Cog6ToothIcon className="h-4 w-4 mr-3" />
                    Configurações
                  </button>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-body text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-900 dark:hover:text-red-300 transition-colors duration-200"
                  >
                    <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};