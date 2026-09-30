export const routes = [
  { path: '/', label: 'Command Center' },
  { path: '/incidents', label: 'Incidents' },
  { path: '/cameras', label: 'Live Cameras' },
  { path: '/tracking', label: 'Tracking' },
  { path: '/crowd', label: 'Crowd Intelligence' },
  { path: '/baggage', label: 'Baggage Detection' },
  { path: '/emergency', label: 'Emergency Response' },
  { path: '/analytics', label: 'Analytics' },
  { path: '/verification', label: 'AI Verification' },
  { path: '/settings', label: 'Settings' },
];

export const sectors = ['Sector A', 'Sector B', 'Sector C', 'Sector D'];

export const thresholds = {
  criticalConfidence: 90,
  highConfidence: 80,
  crowdCritical: 85,
  crowdElevated: 65,
  baggageFlagMinutes: 5,
  fpsWarning: 15,
};

export const API_URL = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:8000/api/v1';
