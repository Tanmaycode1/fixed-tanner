export class WebSocketClient {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly onMessage: (data: any) => void;
  private readonly onConnect: () => void;
  private readonly onDisconnect: () => void;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false;

  constructor(
    url: string, 
    onMessage: (data: any) => void,
    onConnect: () => void,
    onDisconnect: () => void
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onConnect = onConnect;
    this.onDisconnect = onDisconnect;
  }

  connect(token: string) {
    if (!this.url || this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket connection skipped:', {
        url: this.url,
        isConnecting: this.isConnecting,
        readyState: this.ws?.readyState
      });
      return;
    }
  
    try {
      this.isConnecting = true;
      
      // Ensure URL starts with ws:// or wss://
      const wsUrl = this.url.startsWith('ws://') || this.url.startsWith('wss://')
        ? this.url
        : `ws://${this.url}`;
      
      console.log('Attempting WebSocket connection to:', wsUrl);
      
      // Add connection timeout
      const connectionTimeout = setTimeout(() => {
        console.error('WebSocket connection timeout');
        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.log('Connection timed out, current state:', {
            readyState: this.ws.readyState,
            url: this.ws.url,
            error: this.ws.onerror
          });
          this.ws.close();
          this.handleReconnection();
        }
      }, 5000);
      
      this.ws = new WebSocket(wsUrl);
      
      // Add error event handler before open
      this.ws.onerror = (error) => {
        console.error('WebSocket connection error:', error);
        clearTimeout(connectionTimeout);
        this.handleReconnection();
      };
      
      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log('WebSocket connection established');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.onConnect();
      };

      this.setupEventListeners();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.handleReconnection();
    }
  }

  private setupEventListeners() {
    if (!this.ws) return;

    // onopen is now handled in connect()

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('WebSocket received:', data);
        this.onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      // Log more details about the connection state
      if (this.ws) {
        console.log('WebSocket state:', {
          readyState: this.ws.readyState,
          bufferedAmount: this.ws.bufferedAmount,
          url: this.ws.url,
          protocol: this.ws.protocol
        });
      }
      this.onDisconnect();
    };

    this.ws.onclose = (event) => {
      const closeReasons: { [key: number]: string } = {
        1000: 'Normal closure',
        1001: 'Going away',
        1002: 'Protocol error',
        1003: 'Unsupported data',
        1005: 'No status received',
        1006: 'Abnormal closure',
        1007: 'Invalid frame payload data',
        1008: 'Policy violation',
        1009: 'Message too big',
        1010: 'Mandatory extension',
        1011: 'Internal error',
        1015: 'TLS handshake',
        4001: 'Authentication failed',
        4002: 'Not a room participant',
        4003: 'Connection setup failed'
      };

      console.log('WebSocket closed:', {
        code: event.code,
        reason: event.reason || closeReasons[event.code] || 'Unknown',
        wasClean: event.wasClean
      });

      this.onDisconnect();
      if (!this.isConnecting && event.code !== 1000) {
        this.handleReconnection();
      }
    };
  }

  private handleReconnection() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      
      console.log(`Scheduling reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      this.reconnectTimeout = setTimeout(() => {
        const token = localStorage.getItem('access_token');
        if (token) {
          console.log(`Attempting reconnection ${this.reconnectAttempts}`);
          this.connect(token);
        } else {
          console.warn('No access token available for reconnection');
        }
      }, delay);
    } else {
      console.warn('Max reconnection attempts reached, giving up');
      this.onDisconnect();
    }
  }

  sendMessage(type: string, payload: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not connected. Message not sent:', { type, payload });
      const token = localStorage.getItem('access_token');
      if (token) {
        this.connect(token);
      }
      return;
    }

    try {
      const message = JSON.stringify({ type, ...payload });
      console.log('Sending WebSocket message:', message);
      this.ws.send(message);
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }

  disconnect() {
    console.log('Disconnecting WebSocket');
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.onDisconnect();
  }
}