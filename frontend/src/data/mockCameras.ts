import type { Camera } from '../types/camera';

export const mockCameras: Camera[] = [
  { id: 'CAM-01', name: 'Expressway North', sector: 'Sector A', status: 'online', fps: 30, resolution: '2560x1440', lat: 28.6139, lng: 77.209 },
  { id: 'CAM-03', name: 'Expressway South', sector: 'Sector A', status: 'online', fps: 25, resolution: '1920x1080', lat: 28.6125, lng: 77.2115 },
  { id: 'CAM-04', name: 'Metro Central', sector: 'Sector B', status: 'online', fps: 30, resolution: '2560x1440', lat: 28.6167, lng: 77.2083 },
  { id: 'CAM-05', name: 'Market Row', sector: 'Sector B', status: 'online', fps: 24, resolution: '1920x1080', lat: 28.618, lng: 77.205 },
  { id: 'CAM-07', name: 'Junction A', sector: 'Sector C', status: 'online', fps: 30, resolution: '3840x2160', lat: 28.61, lng: 77.213 },
  { id: 'CAM-08', name: 'Junction B', sector: 'Sector C', status: 'maintenance', fps: 0, resolution: '1920x1080', lat: 28.609, lng: 77.2145 },
  { id: 'CAM-09', name: 'River Bridge', sector: 'Sector D', status: 'online', fps: 28, resolution: '2560x1440', lat: 28.6205, lng: 77.2015 },
  { id: 'CAM-12', name: 'Station Gate 2', sector: 'Sector D', status: 'online', fps: 30, resolution: '3840x2160', lat: 28.6225, lng: 77.199 },
];
