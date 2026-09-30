import { useEffect, useState } from 'react';
import type { Track } from '../types/tracking';
import { useTrackingStore } from '../store/trackingStore';
import { backend } from '../services/backend';

/**
 * Live tracks derived from recent backend behavior events.
 * Groups envelopes by (camera, first track id); positions are unavailable
 * (backend tracks in pixel space, not geo) so paths carry event times only.
 */
const COLORS = ['#436086', '#ba1a1a', '#0f766e', '#7c3aed', '#b45309'];

export function useTracking() {
  const { activeTrackId, follow, setActiveTrack, setFollow } = useTrackingStore();
  const [tracks, setTracks] = useState<Track[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.recentBehavior(100)
      .then((events) => {
        if (cancelled) return;
        const groups = new Map<string, typeof events>();
        for (const e of events) {
          const tid = e.track_ids?.[0] ?? -1;
          const key = `${e.camera_id}::${tid}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(e);
        }
        setTracks([...groups.entries()].slice(0, 12).map(([key, evs], n) => {
          const [cameraId, tid] = key.split('::');
          const latest = evs[evs.length - 1];
          return {
            id: `TRK-${cameraId}-${tid}`,
            label: `${latest.behavior_type} · track ${tid}`,
            cameraId,
            sector: 'Live',
            confidence: Math.round(latest.score * 1000) / 10,
            status: 'active' as const,
            color: COLORS[n % COLORS.length],
            updatedAt: new Date(latest.timestamp * 1000).toISOString(),
            path: evs.map((e) => ({
              lat: 0,
              lng: 0,
              timestamp: new Date(e.timestamp * 1000).toISOString(),
              cameraId: e.camera_id,
            })),
          };
        }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const active = tracks.find((t) => t.id === activeTrackId) ?? tracks[0] ?? null;
  return { tracks, active, activeTrackId, follow, setActiveTrack, setFollow };
}
