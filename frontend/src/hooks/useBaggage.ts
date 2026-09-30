import { useMemo } from 'react';
import type { BaggageItem } from '../types/baggage';

const mockBaggage: BaggageItem[] = [
  { id: 'BAG-301', cameraId: 'CAM-12', sector: 'Sector D', label: 'Black roller bag · bench', confidence: 91.4, unattendedFor: '6m 12s', status: 'flagged', timestamp: '2026-09-30T08:38:31Z' },
  { id: 'BAG-302', cameraId: 'CAM-04', sector: 'Sector B', label: 'Duffel · pillar 3', confidence: 84.2, unattendedFor: '3m 05s', status: 'monitoring', timestamp: '2026-09-30T08:36:00Z' },
];

export function useBaggage() {
  const items = useMemo(() => mockBaggage, []);
  return { items };
}
