import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

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
  const [linkState, setLinkState] = useState<LinkState | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const onMessageCallbacks = useRef<Set<(msg: DaemonMessage) => void>>(new Set());

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('CONNECTING');
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to Tenuto Daemon');
      setStatus('CONNECTED');
      backoffRef.current = 1000;
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
      console.log('Disconnected from Tenuto Daemon');
      setStatus('DISCONNECTED');
      socketRef.current = null;
      
      // Exponential backoff
      const nextBackoff = Math.min(backoffRef.current * 2, 30000);
      backoffRef.current = nextBackoff;
      reconnectTimeoutRef.current = window.setTimeout(connect, nextBackoff);
    };

    ws.onerror = (err) => {
      console.error('WebSocket error', err);
      ws.close();
    };
  }, [url]);

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
    linkState,
    sendMessage,
    addMessageListener
  };
};
