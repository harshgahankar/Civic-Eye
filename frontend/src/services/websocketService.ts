type Handler = (msg: unknown) => void;

export class WebsocketService {
  private handlers = new Map<string, Set<Handler>>();
  private ws: WebSocket | null = null;

  connect(url?: string): void {
    const env = (import.meta as unknown as { env?: Record<string, string> }).env;
    const target = url ?? env?.VITE_WS_URL ?? 'ws://localhost:4000/ws';
    try {
      this.ws = new WebSocket(target);
      this.ws.onmessage = (ev) => {
        let parsed: { topic?: string; data?: unknown } = {};
        try {
          parsed = JSON.parse(ev.data as string) as { topic?: string; data?: unknown };
        } catch {
          parsed = { data: ev.data };
        }
        const topic = parsed.topic ?? 'message';
        this.handlers.get(topic)?.forEach((h) => h(parsed.data ?? ev.data));
      };
    } catch {
      this.ws = null;
    }
  }

  subscribe(topic: string, handler: Handler): () => void {
    if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
    this.handlers.get(topic)?.add(handler);
    return () => this.handlers.get(topic)?.delete(handler);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export const websocketService = new WebsocketService();
