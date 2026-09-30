import type { IncidentSeverity } from './incident';

export type UnitType = 'EMS' | 'Police' | 'Fire' | 'Engineering';
export type UnitStatus = 'available' | 'en-route' | 'on-scene' | 'offline';

export interface ResponseUnit {
  id: string;
  type: UnitType;
  name: string;
  target: string;
  distance: string;
  status: UnitStatus;
  eta: string;
}

export interface AlertItem {
  id: string;
  title: string;
  severity: IncidentSeverity;
  timestamp: string;
  acknowledged: boolean;
}
