import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadow?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  border?: boolean;
  hover?: boolean;
  loading?: boolean;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10'
};

const shadowClasses = {
  none: '',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl'
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  shadow = 'md',
  border = true,
  hover = false,
  loading = false,
  header,
  footer,
  onClick
}) => {
  const isClickable = !!onClick;

  const cardContent = (
    <>
      {header && (
        <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
          {header}
        </div>
      )}
      
      <div className={loading ? 'opacity-50 pointer-events-none' : ''}>
        {children}
      </div>
      
      {footer && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-6">
          {footer}
        </div>
      )}
      
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-xl">
          <div className="flex flex-col items-center space-y-2">
            <div className="w-8 h-8 border-2 border-gray-200 dark:border-gray-700 border-t-primary-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Carregando...</span>
          </div>
        </div>
      )}
    </>
  );

  const baseClasses = `
    relative bg-white dark:bg-gray-800 rounded-xl transition-all duration-200
    ${border ? 'border border-gray-200 dark:border-gray-700' : ''}
    ${shadowClasses[shadow]}
    ${paddingClasses[padding]}
    ${isClickable ? 'cursor-pointer' : ''}
    ${className}
  `;

  if (isClickable) {
    return (
      <motion.div
        className={baseClasses}
        onClick={onClick}
        whileHover={hover ? { 
          scale: 1.02, 
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
        } : {}}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {cardContent}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={baseClasses}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={hover ? { 
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
      } : {}}
    >
      {cardContent}
    </motion.div>
  );
};

export default Card;