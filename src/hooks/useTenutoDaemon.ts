import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'OFFLINE';

export interface LinkState {
  tempo: number;
  phase: number;
  beat: number;
}

export interface DaemonMessage {
  type: string;
  [key: string]: any;
}

export const useTenutoDaemon = (url: string = 'ws://127.0.0.1:8080') => {
  const [status, setStatus] = useState<ConnectionStatus>('DISCONNECTED');
  const [isDaemonOffline, setIsDaemonOffline] = useState(false);
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const retryCountRef = useRef<number>(0);
  const MAX_RETRIES = 3;
  const onMessageCallbacks = useRef<Set<(msg: DaemonMessage) => void>>(new Set());

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    if (retryCountRef.current >= MAX_RETRIES) {
      setStatus('OFFLINE');
      setIsDaemonOffline(true);
      return;
    }

    setStatus('CONNECTING');
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Tenuto Daemon');
      setStatus('CONNECTED');
      setIsDaemonOffline(false);
      backoffRef.current = 1000;
      retryCountRef.current = 0;
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg: DaemonMessage = JSON.parse(event.data);
        if (msg.type === 'LINK_STATE') {
          setLinkState({ tempo: msg.tempo, phase: msg.phase, beat: msg.beat });
        }
        onMessageCallbacks.current.forEach(cb => cb(msg));
      } catch (err) {
        console.error('Failed to parse daemon message', err);
      }
    };

    ws.onclose = () => {
      if (status === 'CONNECTED') {
        console.log('Disconnected from Tenuto Daemon');
      }
      setStatus('DISCONNECTED');
      socketRef.current = null;
      
      if (retryCountRef.current < MAX_RETRIES) {
        retryCountRef.current += 1;
        // Exponential backoff
        const nextBackoff = Math.min(backoffRef.current * 2, 30000);
        backoffRef.current = nextBackoff;
        reconnectTimeoutRef.current = window.setTimeout(connect, nextBackoff);
      } else {
        setStatus('OFFLINE');
        setIsDaemonOffline(true);
      }
    };

    ws.onerror = (err) => {
      // Fail quietly without console.error
      ws.close();
    };
  }, [url, status]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      socketRef.current?.close();
    };
  }, [connect]);

  const sendMessage = useCallback((msg: DaemonMessage) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const addMessageListener = useCallback((cb: (msg: DaemonMessage) => void) => {
    onMessageCallbacks.current.add(cb);
    return () => onMessageCallbacks.current.delete(cb);
  }, []);

  return {
    status,
    isDaemonOffline,
    linkState,
    sendMessage,
    addMessageListener
  };
};
