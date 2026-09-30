export type DetectionAction = 'Track' | 'Verify' | 'Dispatch' | 'Monitor' | 'Review';

export interface Detection {
  id: string;
  timestamp: string;
  cameraId: string;
  sector: string;
  label: string;
  confidence: number;
  delta: string;
  action: DetectionAction;
}
