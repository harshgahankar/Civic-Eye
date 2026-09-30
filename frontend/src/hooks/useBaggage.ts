import { useEffect, useState } from 'react';
import type { BaggageItem } from '../types/baggage';
import { backend } from '../services/backend';

export function useBaggage() {
  const [items, setItems] = useState<BaggageItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.incidents(200)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows
          .filter((i) => i.type === 'unattended-object')
          .map((b) => ({
            id: b.id,
            cameraId: b.cameraId,
            sector: b.sector,
            label: b.title,
            confidence: b.confidence,
            unattendedFor: b.description,
            status: b.status === 'active' ? 'flagged' : b.status === 'resolved' ? 'claimed' : 'monitoring',
            timestamp: b.timestamp,
          })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return { items };
}
