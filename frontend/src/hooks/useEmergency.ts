import { useMemo } from 'react';
import { mockUnits } from '../data/mockResources';
import { mockDetections } from '../data/mockDetections';

export function useEmergency() {
  const units = useMemo(() => mockUnits, []);
  const alerts = useMemo(() => mockDetections, []);
  return { units, alerts };
}
