import type { ResponseUnit } from '../types/emergency';

export const mockUnits: ResponseUnit[] = [
  { id: 'EMS-14', type: 'EMS', name: 'EMS Unit 14', target: 'INC-1042 · Junction A', distance: '1.2 km', status: 'en-route', eta: '4 min' },
  { id: 'POL-208', type: 'Police', name: 'Patrol 208', target: 'INC-1042 · Junction A', distance: '0.8 km', status: 'on-scene', eta: 'On scene' },
  { id: 'ENG-03', type: 'Engineering', name: 'Tow & Clear 03', target: 'Standby · Sector C', distance: '2.5 km', status: 'available', eta: '9 min' },
  { id: 'POL-104', type: 'Police', name: 'Patrol 104', target: 'INC-1041 · Metro Central', distance: '0.4 km', status: 'en-route', eta: '2 min' },
];
