/**
 * Backend-compatible WebSocket client for WS /api/v1/ws.
 *
 * Server protocol (backend Step 5):
 *  - server → HELLO { client_id }, SUBSCRIBED, PONG, ERROR, event envelopes
 *  - envelopes carry { event_id, event_type, timestamp, source, camera_id,
 *    incident_id, payload } — exposed to subscribers under BOTH the raw
 *    event_type topic and the legacy 'message' topic.
 *  - client → { action: 'subscribe', camera_ids, incident_types,
 *    severities, event_types } | { action: 'ping' } | { action: 'unsubscribe' }
 */
type Handler = (msg: unknown) => void;

export interface RealtimeEnvelope {
  event_id?: string;
  event_type: string;
  timestamp?: number;
  source?: string;
  camera_id?: string | null;
  incident_id?: string | null;
  payload?: Record<string, unknown>;
}

const DEFAULT_URL = 'ws://localhost:8000/api/v1/ws';

export class WebsocketService {
  private handlers = new Map<string, Set<Handler>>();
  private ws: WebSocket | null = null;
  private url = DEFAULT_URL;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 2000;
  private intentionalClose = false;
  connected = false;

  connect(url?: string): void {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    this.url = url ?? env?.VITE_WS_URL ?? DEFAULT_URL;
    this.intentionalClose = false;
    this.open();
  }

  private open(): void {
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.ws = null;
      this.scheduleReconnect();
      return;
    }
    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = 2000;
      this.send({ action: 'subscribe', camera_ids: [] });
    };
    this.ws.onmessage = (ev) => {
      let parsed: RealtimeEnvelope & { topic?: string; data?: unknown } | null = null;
      try {
        parsed = JSON.parse(ev.data as string) as RealtimeEnvelope;
      } catch {
        this.emit('message', ev.data);
        return;
      }
      if (!parsed || typeof parsed !== 'object') return;
      // Legacy { topic, data } shape (older mock servers).
      if ('topic' in parsed && typeof parsed.topic === 'string') {
        this.emit(parsed.topic, parsed.data);
        return;
      }
      const envelope = parsed as RealtimeEnvelope;
      if (envelope.event_type === 'PONG') {
        this.emit('pong', envelope);
        return;
      }
      this.emit('message', envelope);
      if (envelope.event_type) this.emit(envelope.event_type, envelope);
    };
    this.ws.onclose = () => {
      this.connected = false;
      this.ws = null;
      if (!this.intentionalClose) this.scheduleReconnect();
    };
    this.ws.onerror = () => {
      try { this.ws?.close(); } catch { /* noop */ }
    };
  }

  private scheduleReconnect(): void {
    if (this.intentionalClose || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
      this.open();
    }, this.reconnectDelay);
  }

  send(msg: unknown): void {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(msg));
      }
    } catch { /* noop */ }
  }

  subscribe(topic: string, handler: Handler): () => void {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic)?.add(handler);
    return () => this.handlers.get(topic)?.delete(handler);
  }

  private emit(topic: string, msg: unknown): void {
    this.handlers.get(topic)?.forEach((h) => {
      try { h(msg); } catch { /* one bad handler must not break others */ }
    });
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;
    this.connected = false;
  }
}

export const websocketService = new WebsocketService();
