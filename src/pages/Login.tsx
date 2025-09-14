import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { apiService } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { useNotification } from '../contexts/NotificationContext';
import { useAnalytics } from '../hooks/useAnalytics';

export const Login: React.FC = () => {
  const { dispatch } = useApp();
  const { showSuccess, showError } = useNotification();
  const { trackFormInteraction, trackUserAction, trackError, trackApiResponse } = useAnalytics();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError('Email é obrigatório');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email inválido');
      return false;
    }
    if (!formData.password.trim()) {
      setError('Senha é obrigatória');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const startTime = Date.now();
    
    // Rastrear início do formulário de login
    trackFormInteraction('login', 'submit', {
      email: formData.email.split('@')[1] || 'unknown', // apenas o domínio por privacidade
      hasPassword: formData.password.length > 0
    });

    try {
      const response = await apiService.login(formData.email, formData.password);
      const responseTime = Date.now() - startTime;
      
      if (response.success) {
        trackApiResponse('/api/auth/login', responseTime, 200);
        
        // Rastrear login bem-sucedido
        trackUserAction('login_success', 'authentication', {
          loginMethod: 'email_password',
          responseTime
        });
        
        dispatch({ type: 'SET_USER', payload: response.data.user });
        showSuccess('Login realizado com sucesso!', `Bem-vindo, ${response.data.user.name}`);
        
        // Usar redirecionamento retornado pela API
        const redirectTo = response.data.user.redirect_to || '/dashboard';
        navigate(redirectTo);
      } else {
        // Rastrear erro de login
        trackError('login_failed', response.error || 'Invalid credentials', {
          email: formData.email.split('@')[1] || 'unknown',
          responseTime
        });
        
        trackFormInteraction('login', 'error', {
          errorType: 'invalid_credentials',
          email: formData.email.split('@')[1] || 'unknown'
        });
        
        setError(response.error || 'Credenciais inválidas');
        showError('Erro no login', response.error || 'Credenciais inválidas');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      const responseTime = Date.now() - startTime;
      const errorMessage = error.message || 'Não foi possível conectar com o servidor';
      
      // Rastrear erro de conexão
      trackError('login_connection_error', errorMessage, {
        email: formData.email.split('@')[1] || 'unknown',
        responseTime
      });
      
      trackFormInteraction('login', 'error', {
        errorType: 'connection_error',
        email: formData.email.split('@')[1] || 'unknown'
      });
      
      setError(errorMessage);
      showError('Erro de conexão', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    if (error) setError('');
  };

  // Rastrear início do formulário quando o usuário começa a digitar
  const handleEmailFocus = () => {
    trackFormInteraction('login', 'start', {
      field: 'email'
    });
  };

  const handlePasswordToggle = () => {
    setShowPassword(!showPassword);
    trackUserAction('password_visibility_toggle', 'form_interaction', {
      visible: !showPassword
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center p-4 transition-colors duration-200">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div 
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl mb-6 shadow-lg shadow-primary-500/25"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-white text-3xl font-bold">D</span>
          </motion.div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Dinâmica</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">Soluções em IA</p>
        </div>

        {/* Login Form */}
        <motion.div 
          className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-700 p-8 backdrop-blur-sm"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">Bem-vindo de volta</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">Entre na sua conta para continuar</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 p-4 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-700 rounded-xl"
            >
              <p className="text-danger-600 dark:text-danger-400 text-base font-medium">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label htmlFor="email" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Email
              </label>
              <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={handleEmailFocus}
                  required
                  className="w-full px-5 py-4 text-base border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="seu@email.com"
                />
            </div>

            <div>
              <label htmlFor="password" className="block text-base font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  className="w-full px-5 py-4 pr-14 text-base border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="••••••••"
                />
                <motion.button
                  type="button"
                  onClick={handlePasswordToggle}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-primary-500 dark:hover:text-primary-400 transition-colors duration-200"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-6 h-6" />
                  ) : (
                    <EyeIcon className="w-6 h-6" />
                  )}
                </motion.button>
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white py-4 px-6 rounded-xl font-semibold text-lg shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={!loading ? { scale: 1.02 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                  Entrando...
                </div>
              ) : (
                'Entrar'
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center space-y-6">
            <p className="text-base text-gray-600 dark:text-gray-400">
              Não tem uma conta?{' '}
              <Link to="/register" className="text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 font-semibold transition-colors duration-200">
                Criar conta
              </Link>
            </p>
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <motion.a
                href="/admin"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 text-base font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-all duration-200"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Painel Administrativo
              </motion.a>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div 
          className="text-center mt-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <p className="text-base text-gray-500 dark:text-gray-400">
            © 2025 Dinâmica. Todos os direitos reservados.
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
};