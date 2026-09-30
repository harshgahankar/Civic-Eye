import { useEffect } from 'react';
import { websocketService } from '../services/websocketService';

/** Open the backend WS once for the whole app (auto-reconnect built in). */
export function useRealtime() {
  useEffect(() => {
    websocketService.connect();
    return () => websocketService.disconnect();
  }, []);
}
