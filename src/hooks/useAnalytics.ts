import { useContext, useCallback } from 'react';
import { useApp } from '../contexts/AppContext';

interface AnalyticsEvent {
  eventCategory: string;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  metadata?: Record<string, any>;
}

interface PerformanceMetric {
  metricType: string;
  metricValue: number;
  metadata?: Record<string, any>;
}

export const useAnalytics = () => {
  const { state } = useApp();
  const userId = state.user?.id;

  const trackEvent = useCallback(async (event: AnalyticsEvent) => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3001/api/analytics/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('Erro ao registrar evento de analytics:', error);
    }
  }, [userId]);

  const trackPerformance = useCallback(async (metric: PerformanceMetric) => {
    if (!userId) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3001/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metric),
      });
    } catch (error) {
      console.error('Erro ao registrar métrica de performance:', error);
    }
  }, [userId]);

  const trackPageView = useCallback((pageName: string, metadata?: Record<string, any>) => {
    trackEvent({
      eventCategory: 'page_view',
      eventAction: 'view',
      eventLabel: pageName,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        url: window.location.href,
      },
    });
  }, [trackEvent]);

  const trackUserAction = useCallback((action: string, category: string = 'user_engagement', metadata?: Record<string, any>) => {
    trackEvent({
      eventCategory: category,
      eventAction: action,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }, [trackEvent]);

  const trackFormInteraction = useCallback((formName: string, action: 'start' | 'submit' | 'error', metadata?: Record<string, any>) => {
    trackEvent({
      eventCategory: 'form_interaction',
      eventAction: `form_${action}`,
      eventLabel: formName,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }, [trackEvent]);

  const trackAgentInteraction = useCallback((agentId: string, action: string, metadata?: Record<string, any>) => {
    trackEvent({
      eventCategory: 'agent_interaction',
      eventAction: action,
      eventLabel: agentId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }, [trackEvent]);

  const trackChatMessage = useCallback((conversationId: string, messageType: 'user' | 'agent', metadata?: Record<string, any>) => {
    trackEvent({
      eventCategory: 'chat',
      eventAction: `message_${messageType}`,
      eventLabel: conversationId,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }, [trackEvent]);

  const trackError = useCallback((errorType: string, errorMessage: string, metadata?: Record<string, any>) => {
    trackEvent({
      eventCategory: 'error',
      eventAction: errorType,
      eventLabel: errorMessage,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      },
    });
  }, [trackEvent]);

  const trackLoadTime = useCallback((pageName: string, loadTime: number, metadata?: Record<string, any>) => {
    trackPerformance({
      metricType: 'page_load_time',
      metricValue: loadTime,
      metadata: {
        ...metadata,
        pageName,
        timestamp: new Date().toISOString(),
      },
    });
  }, [trackPerformance]);

  const trackApiResponse = useCallback((endpoint: string, responseTime: number, statusCode: number, metadata?: Record<string, any>) => {
    trackPerformance({
      metricType: 'api_response_time',
      metricValue: responseTime,
      metadata: {
        ...metadata,
        endpoint,
        statusCode,
        timestamp: new Date().toISOString(),
      },
    });
  }, [trackPerformance]);

  // Batch tracking para múltiplos eventos
  const trackEventsBatch = useCallback(async (events: AnalyticsEvent[]) => {
    if (!userId || events.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      await fetch('http://localhost:3001/api/analytics/events/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Erro ao registrar eventos em lote:', error);
    }
  }, [userId]);

  return {
    trackEvent,
    trackPerformance,
    trackPageView,
    trackUserAction,
    trackFormInteraction,
    trackAgentInteraction,
    trackChatMessage,
    trackError,
    trackLoadTime,
    trackApiResponse,
    trackEventsBatch,
  };
};

export default useAnalytics;