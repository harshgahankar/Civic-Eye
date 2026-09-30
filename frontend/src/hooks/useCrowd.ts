import { useEffect, useState } from 'react';
import type { CrowdZone } from '../types/crowd';
import { backend } from '../services/backend';

export function useCrowd() {
  const [zones, setZones] = useState<CrowdZone[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.incidents(200)
      .then((rows) => {
        if (cancelled) return;
        setZones(rows
          .filter((i) => i.type === 'crowd-anomaly')
          .map((c, n) => ({
            id: c.id,
            name: `${c.cameraId} crowd zone`,
            cameraId: c.cameraId,
            sector: c.sector,
            density: Math.round(c.confidence),
            count: 0,
            capacity: 0,
            status: c.severity === 'critical' ? 'critical' : c.severity === 'high' ? 'elevated' : 'normal',
            trend: n === 0 ? 'up' : 'stable',
            updatedAt: c.timestamp,
          })));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return { zones };
}
