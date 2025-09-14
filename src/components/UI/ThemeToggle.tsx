import React from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ 
  className = '', 
  size = 'md', 
  showLabel = false 
}) => {
  const { theme, toggleTheme } = useTheme();

  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12'
  };

  const iconSizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showLabel && (
        <span className="text-caption text-gray-600 dark:text-gray-400">
          {theme === 'light' ? 'Modo Claro' : 'Modo Escuro'}
        </span>
      )}
      
      <button
        onClick={toggleTheme}
        className={`
          ${sizeClasses[size]}
          relative inline-flex items-center justify-center
          rounded-lg border border-gray-200 dark:border-gray-700
          bg-white dark:bg-gray-800
          text-gray-500 dark:text-gray-400
          hover:bg-gray-50 dark:hover:bg-gray-700
          hover:text-gray-700 dark:hover:text-gray-200
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          dark:focus:ring-offset-gray-800
          transition-all duration-200 ease-in-out
          group
        `}
        title={theme === 'light' ? 'Alternar para modo escuro' : 'Alternar para modo claro'}
        aria-label={theme === 'light' ? 'Alternar para modo escuro' : 'Alternar para modo claro'}
      >
        {/* Ícone do Sol (Modo Claro) */}
        <SunIcon 
          className={`
            ${iconSizes[size]}
            absolute transition-all duration-300 ease-in-out
            ${theme === 'light' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 rotate-90 scale-75'
            }
          `}
        />
        
        {/* Ícone da Lua (Modo Escuro) */}
        <MoonIcon 
          className={`
            ${iconSizes[size]}
            absolute transition-all duration-300 ease-in-out
            ${theme === 'dark' 
              ? 'opacity-100 rotate-0 scale-100' 
              : 'opacity-0 -rotate-90 scale-75'
            }
          `}
        />
        
        {/* Indicador visual de hover */}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-primary-500/10 to-success-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </button>
    </div>
  );
};

export default ThemeToggle;