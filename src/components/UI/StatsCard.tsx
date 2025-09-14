import React from 'react';
import { motion } from 'framer-motion';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
  loading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({ 
  title, 
  value, 
  change, 
  icon, 
  color = 'primary',
  loading = false
}) => {
  const colorClasses = {
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400',
    success: 'bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400',
    warning: 'bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400',
    danger: 'bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400'
  };

  const getChangeColorClass = (changeValue?: string) => {
    if (!changeValue) return '';
    const isPositive = changeValue.startsWith('+');
    return isPositive 
      ? 'text-success-600 dark:text-success-400' 
      : 'text-danger-600 dark:text-danger-400';
  };

  if (loading) {
    return (
      <div className="card animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-2"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="relative overflow-hidden rounded-xl p-4 lg:p-6 shadow-sm border transition-all duration-200 hover:shadow-md hover:-translate-y-1 card group cursor-pointer"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-1 truncate">
            {title}
          </p>
          <p className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors duration-200">
            {value}
          </p>
          {change && (
            <div className="flex items-center gap-1 mt-1">
              <span className={`text-sm font-medium ${getChangeColorClass(change)}`}>
                {change}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                vs. período anterior
              </span>
            </div>
          )}
        </div>
        <div className="ml-3 lg:ml-4 flex-shrink-0">
          <div className={`p-2 lg:p-3 rounded-xl ${colorClasses[color]} group-hover:scale-110 transition-transform duration-200`}>
            <div className="w-5 h-5 lg:w-6 lg:h-6">
              {icon}
            </div>
          </div>
        </div>
      </div>
      
      {/* Indicador visual de hover */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary-500/5 to-success-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />
    </motion.div>
  );
};

export default StatsCard;