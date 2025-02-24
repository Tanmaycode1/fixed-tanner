import { useEffect, useRef, useCallback } from 'react';

interface WebSocketOptions {
  url: string;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function useWebSocket({ url, onMessage, onConnect, onDisconnect }: WebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const isConnected = useRef(false);

  useEffect(() => {
    if (!url) return;

    const socket = new WebSocket(url);

    socket.onopen = () => {
      console.log('WebSocket connected');
      isConnected.current = true;
      onConnect?.();
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage?.(data);
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      isConnected.current = false;
      onDisconnect?.();
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, [url, onMessage, onConnect, onDisconnect]);

  const sendMessage = useCallback((message: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return {
    sendMessage,
    isConnected: isConnected.current
  };
}