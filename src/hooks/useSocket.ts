import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useApp } from '../contexts/AppContext';

interface UseSocketOptions {
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
}

interface SocketEvents {
  // Authentication events
  'authenticated': (data: { success: boolean; userId: string }) => void;
  'authentication_error': (data: { error: string }) => void;
  
  // Initial data
  'initial_data': (data: { conversations: any[]; agents: any[]; whatsappSessions: any[]; timestamp: string }) => void;
  
  // Message events
  'new_message': (data: any) => void;
  'message_error': (data: { error: string }) => void;
  'conversation_messages': (data: { conversationId: string; messages: any[]; hasMore: boolean }) => void;
  'messages_error': (data: { error: string }) => void;
  
  // Typing events
  'user_typing': (data: { userId: string; conversationId: string }) => void;
  'user_stopped_typing': (data: { userId: string; conversationId: string }) => void;
  
  // Agent events
  'agent_status_updated': (data: { agentId: string; status: string; timestamp: string }) => void;
  'agent_status_error': (data: { error: string }) => void;
  'agent_updated': (data: any) => void;
  
  // Conversation events
  'conversation_updated': (data: { id: string; updated_at: string; last_message: any }) => void;
  'new_conversation': (data: any) => void;
  
  // WhatsApp events
  'whatsapp_message_received': (data: any) => void;
  'whatsapp_session_updated': (data: { sessionId: string; status: string; metadata: any; timestamp: string }) => void;
  'whatsapp_session_error': (data: { error: string }) => void;
  
  // Metrics events
  'real_time_metrics': (data: { activeConversations: number; todayMessages: number; activeAgents: number; activeWhatsAppSessions: number; timestamp: string }) => void;
  'metrics_updated': (data: any) => void;
  'metrics_error': (data: { error: string }) => void;
  
  // Notification events
  'notification': (data: any) => void;
  'system_notification': (data: any) => void;
  
  // Error events
  'error': (data: { message: string }) => void;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { state } = useApp();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const eventListenersRef = useRef<Map<string, Function[]>>(new Map());

  const {
    autoConnect = true,
    reconnection = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000
  } = options;

  useEffect(() => {
    if (!state.user || !autoConnect) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    // Initialize socket connection
    socketRef.current = io('http://localhost:3001', {
      reconnection,
      reconnectionAttempts,
      reconnectionDelay,
      transports: ['websocket', 'polling']
    });

    const socket = socketRef.current;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('🔌 Connected to server');
      
      // Authenticate after connection
      socket.emit('authenticate', {
        userId: state.user?.id,
        token
      });
    });
    
    // Authentication handlers
    socket.on('authenticated', (data) => {
      console.log('✅ Socket authenticated:', data);
      setIsConnected(true);
      setConnectionError(null);
    });
    
    socket.on('authentication_error', (data) => {
      console.error('❌ Socket authentication failed:', data.error);
      setConnectionError(data.error);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('🔌 Connection error:', error.message);
      setConnectionError(error.message);
      setIsConnected(false);
    });

    // Re-register all event listeners
    eventListenersRef.current.forEach((listeners, event) => {
      listeners.forEach(listener => {
        socket.on(event, listener);
      });
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [state.user, autoConnect, reconnection, reconnectionAttempts, reconnectionDelay]);

  const connect = () => {
    if (socketRef.current && !socketRef.current.connected) {
      socketRef.current.connect();
    }
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  const emit = (event: string, data?: any) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected. Cannot emit event:', event);
    }
  };

  const on = <K extends keyof SocketEvents>(event: K, listener: SocketEvents[K]) => {
    if (socketRef.current) {
      socketRef.current.on(event, listener);
      
      // Store listener for re-registration on reconnect
      if (!eventListenersRef.current.has(event)) {
        eventListenersRef.current.set(event, []);
      }
      eventListenersRef.current.get(event)!.push(listener);
    }
  };

  const off = <K extends keyof SocketEvents>(event: K, listener?: SocketEvents[K]) => {
    if (socketRef.current) {
      if (listener) {
        socketRef.current.off(event, listener);
        
        // Remove from stored listeners
        const listeners = eventListenersRef.current.get(event);
        if (listeners) {
          const index = listeners.indexOf(listener);
          if (index > -1) {
            listeners.splice(index, 1);
          }
        }
      } else {
        socketRef.current.off(event);
        eventListenersRef.current.delete(event);
      }
    }
  };

  // Chat methods
  const sendMessage = (conversationId: string, message: string, agentId: string) => {
    emit('send_message', { conversationId, message, agentId });
  };
  
  const joinConversation = (conversationId: string) => {
    emit('join_conversation', { conversationId });
  };
  
  const leaveConversation = (conversationId: string) => {
    emit('leave_conversation', { conversationId });
  };
  
  const startTyping = (conversationId: string) => {
    emit('typing_start', { conversationId });
  };
  
  const stopTyping = (conversationId: string) => {
    emit('typing_stop', { conversationId });
  };
  
  const getConversationMessages = (conversationId: string, limit = 50, offset = 0) => {
    emit('get_conversation_messages', { conversationId, limit, offset });
  };
  
  // Agent methods
  const updateAgentStatus = (agentId: string, status: string) => {
    emit('update_agent_status', { agentId, status });
  };
  
  // WhatsApp methods
  const updateWhatsAppSession = (sessionId: string, status: string, metadata?: any) => {
    emit('whatsapp_session_update', { sessionId, status, metadata });
  };
  
  // Metrics methods
  const getRealTimeMetrics = () => {
    emit('get_real_time_metrics');
  };

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    connect,
    disconnect,
    emit,
    on,
    off,
    // Chat methods
    sendMessage,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    getConversationMessages,
    // Agent methods
    updateAgentStatus,
    // WhatsApp methods
    updateWhatsAppSession,
    // Metrics methods
    getRealTimeMetrics
  };
};

export default useSocket;