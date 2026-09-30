import type { Camera } from '../types/camera';

/**
 * Mock CCTV inventory for the Mumbai pilot.
 * Shape mirrors GET /cameras so the service can swap to the real API
 * without touching callers (see services/cameraService.ts).
 */
const IMG = (id: string) => `https://images.unsplash.com/${id}?w=640&q=60&auto=format&fit=crop`;

const CITY = 'photo-1477959858617-67f85cf4f1df';
const STREET = 'photo-1449824913935-59a10b8d2000';
const URBAN = 'photo-1514565131-fce0801e5785';
const NIGHT = 'photo-1519501025264-65ba15a82390';
const TOWERS = 'photo-1480714378408-67cf0d13bc1b';
const RAIL = 'photo-1474487548417-781cb71495f3';
const OVERPASS = 'photo-1502920917128-1aa500764cbd';

interface Row extends Omit<Camera, 'sector' | 'thumbnail'> {
  img: string;
}

const ROWS: Row[] = [
  // Thane
  { id: 'CAM-14', name: 'Thane Station E', area: 'Thane', location: 'Station East Gate', status: 'online', fps: 30, resolution: '2560x1440', lat: 19.1865, lng: 72.9759, img: RAIL },
  { id: 'CAM-15', name: 'Ghodbunder Rd', area: 'Thane', location: 'Ghodbunder Junction', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.21, lng: 72.96, img: STREET },
  { id: 'CAM-08', name: 'Teen Hath Naka', area: 'Thane', location: 'Naka Signal', status: 'maintenance', fps: 0, resolution: '1920x1080', lat: 19.195, lng: 72.97, img: CITY },
  // Navi Mumbai
  { id: 'CAM-17', name: 'Vashi Palm Beach', area: 'Navi Mumbai', location: 'Palm Beach Rd', status: 'online', fps: 30, resolution: '2560x1440', lat: 19.077, lng: 72.998, img: NIGHT },
  { id: 'CAM-18', name: 'Seawoods Nexus', area: 'Navi Mumbai', location: 'Mall Entry Plaza', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.02, lng: 73.017, img: URBAN },
  { id: 'CAM-19', name: 'CBD Belapur', area: 'Navi Mumbai', location: 'CBD Deco Junction', status: 'online', fps: 25, resolution: '1920x1080', lat: 19.016, lng: 73.034, img: TOWERS },
  // Andheri
  { id: 'CAM-20', name: 'Andheri Station W', area: 'Andheri', location: 'Station West FOB', status: 'online', fps: 30, resolution: '3840x2160', lat: 19.1197, lng: 72.8464, img: RAIL },
  { id: 'CAM-21', name: 'WEH Chakala', area: 'Andheri', location: 'WEH Flyover', status: 'online', fps: 30, resolution: '2560x1440', lat: 19.113, lng: 72.865, img: OVERPASS },
  { id: 'CAM-22', name: 'Lokhandwala Circle', area: 'Andheri', location: 'Circle Signal', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.1315, lng: 72.829, img: STREET },
  { id: 'CAM-05', name: 'Airport T2 Arrivals', area: 'Andheri', location: 'T2 Forecourt', status: 'online', fps: 30, resolution: '3840x2160', lat: 19.0902, lng: 72.8656, img: NIGHT },
  // Bandra
  { id: 'CAM-01', name: 'Sea Link Toll', area: 'Bandra', location: 'BWSL Toll Plaza', status: 'online', fps: 30, resolution: '2560x1440', lat: 19.04, lng: 72.82, img: OVERPASS },
  { id: 'CAM-06', name: 'Bandra Station W', area: 'Bandra', location: 'Station West Gate', status: 'online', fps: 25, resolution: '1920x1080', lat: 19.06, lng: 72.84, img: RAIL },
  { id: 'CAM-23', name: 'Linking Rd', area: 'Bandra', location: 'Linking Rd Market', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.065, lng: 72.835, img: URBAN },
  // Borivali
  { id: 'CAM-11', name: 'Borivali Station W', area: 'Borivali', location: 'Station West Skwalk', status: 'online', fps: 30, resolution: '2560x1440', lat: 19.2307, lng: 72.8567, img: RAIL },
  { id: 'CAM-24', name: 'SGNP Gate', area: 'Borivali', location: 'National Park Gate', status: 'online', fps: 28, resolution: '1920x1080', lat: 19.235, lng: 72.87, img: CITY },
  // Dadar
  { id: 'CAM-07', name: 'Dadar TT', area: 'Dadar', location: 'TT Junction', status: 'online', fps: 30, resolution: '3840x2160', lat: 19.0176, lng: 72.8562, img: CITY },
  { id: 'CAM-25', name: 'Dadar Station E', area: 'Dadar', location: 'Station East FOB', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.019, lng: 72.843, img: RAIL },
  { id: 'CAM-26', name: 'Five Gardens', area: 'Dadar', location: 'Garden Gate 1', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.02, lng: 72.86, img: URBAN },
  { id: 'CAM-12', name: 'Dadar Metro Gate 2', area: 'Dadar', location: 'Metro Gate 2', status: 'online', fps: 30, resolution: '3840x2160', lat: 19.021, lng: 72.85, img: NIGHT },
  // Powai
  { id: 'CAM-09', name: 'Powai Plaza', area: 'Powai', location: 'Plaza Crossing', status: 'online', fps: 28, resolution: '2560x1440', lat: 19.1197, lng: 72.9059, img: URBAN },
  { id: 'CAM-27', name: 'IIT Main Gate', area: 'Powai', location: 'IIT Bombay Gate', status: 'online', fps: 30, resolution: '1920x1080', lat: 19.133, lng: 72.915, img: TOWERS },
  // South Mumbai
  { id: 'CAM-03', name: 'CSMT Concourse', area: 'South Mumbai', location: 'Main Concourse', status: 'online', fps: 30, resolution: '3840x2160', lat: 18.9401, lng: 72.8357, img: RAIL },
  { id: 'CAM-02', name: 'Colaba Causeway', area: 'South Mumbai', location: 'Causeway Market', status: 'online', fps: 30, resolution: '1920x1080', lat: 18.9067, lng: 72.8147, img: STREET },
  { id: 'CAM-28', name: 'Gateway Plaza', area: 'South Mumbai', location: 'Gateway Forecourt', status: 'online', fps: 30, resolution: '2560x1440', lat: 18.922, lng: 72.8347, img: CITY },
  { id: 'CAM-29', name: 'Marine Drive', area: 'South Mumbai', location: "Queen's Necklace", status: 'online', fps: 30, resolution: '2560x1440', lat: 18.943, lng: 72.823, img: NIGHT },
];

export const mockCameras: Camera[] = ROWS.map((r) => ({
  ...r,
  sector: r.area,
  thumbnail: IMG(r.img),
}));

export const MUMBAI_AREAS = [
  'Thane',
  'Navi Mumbai',
  'Andheri',
  'Bandra',
  'Borivali',
  'Dadar',
  'Powai',
  'South Mumbai',
] as const;

export type MumbaiArea = (typeof MUMBAI_AREAS)[number];

export interface AreaIncident {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

/** Active incidents per area (mock). Backend: GET /incidents?area=&status=active */
export const mockAreaIncidents: Record<string, AreaIncident[]> = {
  Dadar: [{ id: 'ALR-8842', title: 'Multi-vehicle collision — Dadar TT', severity: 'CRITICAL' }],
  'South Mumbai': [{ id: 'ALR-8841', title: 'Crowd surge — CSMT concourse', severity: 'HIGH' }],
  Andheri: [{ id: 'ALR-8839', title: 'Unattended baggage — Airport T2', severity: 'MEDIUM' }],
  Bandra: [{ id: 'ALR-8836', title: 'Wrong-way vehicle — Sea Link', severity: 'HIGH' }],
  Thane: [{ id: 'ALR-8834', title: 'Signal fault — Teen Hath Naka', severity: 'MEDIUM' }],
  'Navi Mumbai': [],
  Borivali: [],
  Powai: [],
};
