/**
 * Static camera install directory — reference geography ONLY.
 *
 * This is the single static data file in the app, and it contains no
 * operational values: no statuses, no incidents, no units, no counts.
 * Every live value on screen (status, fps, incidents, health) comes from
 * the backend (/cameras/health, /incidents, /dashboard/snapshot, WS).
 * Coordinates are install reference points; the backend has no geo store.
 */
import type { Camera } from '../types/camera';

interface DirectoryEntry {
  id: string;
  name: string;
  area: string;
  location: string;
  lat: number;
  lng: number;
}

const ENTRIES: DirectoryEntry[] = [
  { id: 'CAM-14', name: 'Thane Station E', area: 'Thane', location: 'Station East Gate', lat: 19.1865, lng: 72.9759 },
  { id: 'CAM-15', name: 'Ghodbunder Rd', area: 'Thane', location: 'Ghodbunder Junction', lat: 19.21, lng: 72.96 },
  { id: 'CAM-08', name: 'Teen Hath Naka', area: 'Thane', location: 'Naka Signal', lat: 19.195, lng: 72.97 },
  { id: 'CAM-17', name: 'Vashi Palm Beach', area: 'Navi Mumbai', location: 'Palm Beach Rd', lat: 19.077, lng: 72.998 },
  { id: 'CAM-18', name: 'Seawoods Nexus', area: 'Navi Mumbai', location: 'Mall Entry Plaza', lat: 19.02, lng: 73.017 },
  { id: 'CAM-19', name: 'CBD Belapur', area: 'Navi Mumbai', location: 'CBD Deco Junction', lat: 19.016, lng: 73.034 },
  { id: 'CAM-20', name: 'Andheri Station W', area: 'Andheri', location: 'Station West FOB', lat: 19.1197, lng: 72.8464 },
  { id: 'CAM-21', name: 'WEH Chakala', area: 'Andheri', location: 'WEH Flyover', lat: 19.113, lng: 72.865 },
  { id: 'CAM-22', name: 'Lokhandwala Circle', area: 'Andheri', location: 'Circle Signal', lat: 19.1315, lng: 72.829 },
  { id: 'CAM-05', name: 'Airport T2 Arrivals', area: 'Andheri', location: 'T2 Forecourt', lat: 19.0902, lng: 72.8656 },
  { id: 'CAM-01', name: 'Sea Link Toll', area: 'Bandra', location: 'BWSL Toll Plaza', lat: 19.04, lng: 72.82 },
  { id: 'CAM-06', name: 'Bandra Station W', area: 'Bandra', location: 'Station West Gate', lat: 19.06, lng: 72.84 },
  { id: 'CAM-23', name: 'Linking Rd', area: 'Bandra', location: 'Linking Rd Market', lat: 19.065, lng: 72.835 },
  { id: 'CAM-11', name: 'Borivali Station W', area: 'Borivali', location: 'Station West Skwalk', lat: 19.2307, lng: 72.8567 },
  { id: 'CAM-24', name: 'SGNP Gate', area: 'Borivali', location: 'National Park Gate', lat: 19.235, lng: 72.87 },
  { id: 'CAM-07', name: 'Dadar TT', area: 'Dadar', location: 'TT Junction', lat: 19.0176, lng: 72.8562 },
  { id: 'CAM-25', name: 'Dadar Station E', area: 'Dadar', location: 'Station East FOB', lat: 19.019, lng: 72.843 },
  { id: 'CAM-26', name: 'Five Gardens', area: 'Dadar', location: 'Garden Gate 1', lat: 19.02, lng: 72.86 },
  { id: 'CAM-12', name: 'Dadar Metro Gate 2', area: 'Dadar', location: 'Metro Gate 2', lat: 19.021, lng: 72.85 },
  { id: 'CAM-09', name: 'Powai Plaza', area: 'Powai', location: 'Plaza Crossing', lat: 19.1197, lng: 72.9059 },
  { id: 'CAM-27', name: 'IIT Main Gate', area: 'Powai', location: 'IIT Bombay Gate', lat: 19.133, lng: 72.915 },
  { id: 'CAM-03', name: 'CSMT Concourse', area: 'South Mumbai', location: 'Main Concourse', lat: 18.9401, lng: 72.8357 },
  { id: 'CAM-02', name: 'Colaba Causeway', area: 'South Mumbai', location: 'Causeway Market', lat: 18.9067, lng: 72.8147 },
  { id: 'CAM-28', name: 'Gateway Plaza', area: 'South Mumbai', location: 'Gateway Forecourt', lat: 18.922, lng: 72.8347 },
  { id: 'CAM-29', name: 'Marine Drive', area: 'South Mumbai', location: "Queen's Necklace", lat: 18.943, lng: 72.823 },
  { id: 'CAM-04', name: 'Juhu Beach', area: 'Andheri', location: 'Juhu Beach', lat: 19.1075, lng: 72.8263 },
];

/** Directory cameras with unknown live status (overlaid by /cameras/health). */
export const directoryCameras: Camera[] = ENTRIES.map((e) => ({
  id: e.id,
  name: e.name,
  sector: e.area,
  area: e.area,
  location: e.location,
  status: 'offline',
  fps: 0,
  resolution: '',
  lat: e.lat,
  lng: e.lng,
}));

export const directoryAreas: string[] = [...new Set(ENTRIES.map((e) => e.area))];
