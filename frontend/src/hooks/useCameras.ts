import { useEffect, useMemo, useState } from 'react';
import { directoryCameras } from '../data/cameraDirectory';
import { useCameraStore } from '../store/cameraStore';
import { backend, type BackendCameraHealth } from '../services/backend';
import type { Camera } from '../types/camera';

function overlayHealth(cameras: Camera[], health: BackendCameraHealth[]): Camera[] {
  const byId = new Map(health.map((h) => [h.camera_id, h]));
  return cameras.map((c) => {
    const h = byId.get(c.id);
    if (!h) return c;
    const status = h.status === 'ONLINE' ? 'online' : h.status === 'OFFLINE' ? 'offline' : 'maintenance';
    return { ...c, status, fps: h.fps > 0 ? Math.round(h.fps) : c.fps };
  });
}

export function useCameras() {
  const { selectedId, sectorFilter, setSelected } = useCameraStore();
  const [health, setHealth] = useState<BackendCameraHealth[]>([]);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      backend.cameraHealth()
        .then((h) => { if (!cancelled) setHealth(h); })
        .catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);

  const cameras = useMemo(() => {
    const withHealth = overlayHealth(directoryCameras, health);
    if (sectorFilter === 'all' || sectorFilter === 'ALL AREAS') return withHealth;
    return withHealth.filter((c) => c.area === sectorFilter || c.sector === sectorFilter);
  }, [sectorFilter, health]);
  const selected = cameras.find((c) => c.id === selectedId) ?? cameras[0] ?? null;
  return { cameras, selected, selectedId, setSelected, liveHealth: health.length > 0 };
}
