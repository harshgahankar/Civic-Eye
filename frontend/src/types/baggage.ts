export type BaggageStatus = 'flagged' | 'monitoring' | 'cleared' | 'claimed';

export interface BaggageItem {
  id: string;
  cameraId: string;
  sector: string;
  label: string;
  confidence: number;
  unattendedFor: string;
  status: BaggageStatus;
  timestamp: string;
  thumbnail?: string;
}
