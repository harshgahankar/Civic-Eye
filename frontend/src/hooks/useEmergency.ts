import { useEffect, useState } from 'react';
import { backend } from '../services/backend';
import type { Incident } from '../types/incident';

/**
 * No response-unit registry exists in the backend, so units are an empty
 * list (the UI renders an empty state). Alerts are live backend incidents.
 */
export function useEmergency() {
  const [alerts, setAlerts] = useState<Incident[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.incidents(100)
      .then((rows) => { if (!cancelled) setAlerts(rows); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return { units: [], alerts };
}
