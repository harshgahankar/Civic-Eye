import { useEffect, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import { Circle, MapContainer, Marker, Popup, TileLayer, ZoomControl, useMap } from 'react-leaflet';
import {
  fetchOsdbCameras,
  isOsdbConfigured,
  type ExternalCamera,
} from '../../services/surveillanceService';
import { useUiStore } from '../../store/uiStore';

export interface MumbaiLiveMapProps {
  interactive?: boolean;
}

const CENTER: [number, number] = [19.075, 72.905];
const HOME_ZOOM = 11;
const BOUNDS: L.LatLngBoundsExpression = [
  [18.8, 72.68],
  [19.35, 73.08],
];

interface Cam {
  id: string;
  site: string;
  pos: [number, number];
  status: 'LIVE' | 'IDLE';
  fps: number;
}

const CAMERAS: Cam[] = [
  { id: 'CAM-11', site: 'Borivali West', pos: [19.2307, 72.8567], status: 'LIVE', fps: 30 },
  { id: 'CAM-14', site: 'Thane Station E', pos: [19.1865, 72.9759], status: 'LIVE', fps: 30 },
  { id: 'CAM-09', site: 'Powai Plaza', pos: [19.1197, 72.9059], status: 'LIVE', fps: 30 },
  { id: 'CAM-05', site: 'Airport T2', pos: [19.0902, 72.8656], status: 'LIVE', fps: 30 },
  { id: 'CAM-04', site: 'Juhu Beach', pos: [19.1075, 72.8263], status: 'LIVE', fps: 30 },
  { id: 'CAM-06', site: 'Sea Link South', pos: [19.033, 72.819], status: 'LIVE', fps: 25 },
  { id: 'CAM-03', site: 'CSMT Concourse', pos: [18.9401, 72.8357], status: 'LIVE', fps: 30 },
  { id: 'CAM-02', site: 'Colaba Causeway', pos: [18.9067, 72.8147], status: 'IDLE', fps: 15 },
];

const UNITS = [
  { id: 'UNIT-12', pos: [19.03, 72.87] as [number, number] },
  { id: 'UNIT-07', pos: [19.08, 72.88] as [number, number] },
];

const CRITICAL = {
  id: 'INC-2401',
  title: 'Dadar TT pile-up',
  cam: 'CAM-07 · DADAR',
  pos: [19.0176, 72.8562] as [number, number],
  meta: '2 lanes blocked · conf 94.2%',
  unit: 'UNIT-12 en route · ETA 3 min',
};

const WARNING = {
  id: 'INC-2400',
  title: 'Unattended baggage — Airport T2',
  cam: 'CAM-05 · AIRPORT',
  pos: [19.094, 72.872] as [number, number],
  meta: 'Dwell 07:18 · conf 91.4%',
  unit: 'CISF desk notified',
};

const MONO = "'IBM Plex Mono',monospace";
const SANS = "'Public Sans',sans-serif";
const DISPLAY = "'Sora',sans-serif";

function camIcon(cam: Cam): L.DivIcon {
  const live = cam.status === 'LIVE';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <span style="position:relative;display:flex;width:26px;height:26px;border-radius:9999px;background:#0f172a;border:1.5px solid ${live ? '#60a5fa' : '#64748b'};box-shadow:0 2px 8px rgba(0,0,0,.55);align-items:center;justify-content:center">
        <span class="material-symbols-outlined" style="font-size:15px;color:${live ? '#dbeafe' : '#94a3b8'}">videocam</span>
        <span style="position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:9999px;background:${live ? '#10b981' : '#64748b'};border:2px solid #0f172a"></span>
      </span>
      <span style="margin-top:3px;border-radius:5px;background:rgba(15,23,42,.88);padding:1px 6px;font-family:${MONO};font-size:9px;font-weight:600;letter-spacing:.04em;color:${live ? '#dbeafe' : '#94a3b8'};white-space:nowrap">${cam.id}</span>
    </div>`,
    iconSize: [72, 50],
    iconAnchor: [36, 15],
  });
}

function camPopup(cam: Cam): string {
  const live = cam.status === 'LIVE';
  return `<div style="min-width:190px">
    <p style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.08em;color:${live ? '#2563eb' : '#64748b'}">${cam.id} · ${cam.status}</p>
    <p style="font-family:${DISPLAY};font-size:15px;font-weight:600;color:#0f172a;margin:2px 0">${cam.site}</p>
    <p style="font-family:${MONO};font-size:11px;color:#64748b">${cam.fps} FPS · H.265 · 1080p</p>
    <a href="/cameras" style="display:inline-block;margin-top:8px;border-radius:8px;background:#0f172a;padding:6px 12px;font-family:${MONO};font-size:11px;font-weight:700;color:#fff;text-decoration:none">OPEN LIVE WALL →</a>
  </div>`;
}

function incidentIcon(kind: 'critical' | 'warning'): L.DivIcon {
  const color = kind === 'critical' ? '#dc2626' : '#f59e0b';
  const label = kind === 'critical' ? 'CRITICAL' : 'WARNING';
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-8px)">
      <span style="position:relative;display:flex;width:${kind === 'critical' ? 22 : 18}px;height:${kind === 'critical' ? 22 : 18}px">
        <span style="position:absolute;width:100%;height:100%;border-radius:9999px;background:${color};opacity:.55;animation:ping 1.6s cubic-bezier(0,0,.2,1) infinite"></span>
        <span style="width:100%;height:100%;border-radius:${kind === 'critical' ? '9999px' : '6px'};background:${color};border:2px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center">
          <span class="material-symbols-outlined" style="font-size:12px;color:#fff">${kind === 'critical' ? 'priority_high' : 'warning'}</span>
        </span>
      </span>
      <span style="margin-top:4px;border-radius:6px;background:${color};padding:2px 6px;font-family:${MONO};font-size:10px;font-weight:700;color:#fff;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.45)">${label}</span>
    </div>`,
    iconSize: [110, 56],
    iconAnchor: [55, 48],
  });
}

function incidentPopup(o: { id: string; title: string; cam: string; meta: string; unit: string; critical: boolean }): string {
  const color = o.critical ? '#dc2626' : '#b45309';
  return `<div style="min-width:210px">
    <p style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.08em;color:${color}">${o.id} · ${o.critical ? 'CRITICAL' : 'WARNING'}</p>
    <p style="font-family:${DISPLAY};font-size:16px;font-weight:600;color:#0f172a;margin:2px 0">${o.title}</p>
    <p style="font-family:${MONO};font-size:11px;color:#64748b">${o.cam}</p>
    <p style="font-family:${MONO};font-size:11px;color:#64748b">${o.meta}</p>
    <p style="font-family:${MONO};font-size:11px;color:#64748b">${o.unit}</p>
    <a href="/incidents/${o.id}" style="display:inline-block;margin-top:8px;border-radius:8px;background:${color};padding:6px 12px;font-family:${MONO};font-size:11px;font-weight:700;color:#fff;text-decoration:none">OPEN DOSSIER →</a>
  </div>`;
}

const unitIcon = (id: string): L.DivIcon =>  L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;gap:4px">
      <span style="width:11px;height:11px;border-radius:3px;background:#10b981;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5)"></span>
      <span style="border-radius:4px;background:rgba(15,23,42,.85);padding:1px 5px;font-family:${MONO};font-size:9px;font-weight:600;color:#a7f3d0;white-space:nowrap">${id}</span>
    </div>`,
    iconSize: [80, 18],
    iconAnchor: [40, 9],
  });

/** Teal diamond for provider (OSDB) external cameras. */
const osdbIcon = (label: string): L.DivIcon =>
  L.divIcon({
    className: '',
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <span style="width:13px;height:13px;background:#14b8a6;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.5);transform:rotate(45deg);border-radius:3px"></span>
      <span style="margin-top:3px;max-width:96px;overflow:hidden;text-overflow:ellipsis;border-radius:4px;background:rgba(15,23,42,.85);padding:1px 5px;font-family:${MONO};font-size:9px;font-weight:600;color:#5eead4;white-space:nowrap">${label}</span>
    </div>`,
    iconSize: [100, 34],
    iconAnchor: [50, 10],
  });

function osdbPopup(c: ExternalCamera): string {
  return `<div style="min-width:190px">
    <p style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.08em;color:#0d9488">OSDB · EXTERNAL FEED</p>
    <p style="font-family:${DISPLAY};font-size:15px;font-weight:600;color:#0f172a;margin:2px 0">${c.name}</p>
    <p style="font-family:${MONO};font-size:11px;color:#64748b">${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}${c.city ? ` · ${c.city}` : ''}</p>
    <p style="font-family:${MONO};font-size:11px;color:#64748b">REF ${c.id}</p>
  </div>`;
}

/** Camera markers with zoom-out clustering (plain Leaflet layer, cleaned up on unmount). */
function ClusteredCameras({ interactive }: { interactive: boolean }) {
  const map = useMap();
  useEffect(() => {
    const group = (L as unknown as { markerClusterGroup: (o: object) => L.LayerGroup }).markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 52,
      spiderfyOnMaxZoom: true,
      spiderfyOnEveryZoom: false,
      disableClusteringAtZoom: 15,
      iconCreateFunction: (cluster: { getChildCount: () => number }) => {
        const n = cluster.getChildCount();
        return L.divIcon({
          className: '',
          html: `<span style="display:flex;width:36px;height:36px;border-radius:9999px;background:#0f172a;border:2px solid #60a5fa;color:#dbeafe;font-family:${MONO};font-size:12px;font-weight:700;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.5)">${n}</span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
      },
    });
    CAMERAS.forEach((c) => {
      const m = L.marker(c.pos, { icon: camIcon(c), keyboard: interactive, title: `${c.id} · ${c.site}` });
      m.bindPopup(camPopup(c), { closeButton: true });
      m.bindTooltip(`${c.id} · ${c.site}`, { direction: 'top', offset: [0, -18], opacity: 1, className: 'civic-tip' });
      group.addLayer(m);
    });
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [map, interactive]);
  return null;
}

function RecenterButton() {
  const map = useMap();
  return (
    <button
      type="button"
      aria-label="Recenter on Mumbai"
      title="Recenter on Mumbai"
      onClick={() => map.flyTo(CENTER, HOME_ZOOM, { duration: 0.8 })}
      className="absolute bottom-9 right-3 z-[500] flex h-9 w-9 items-center justify-center rounded-xl border border-outline-variant bg-white text-on-surface shadow-card transition hover:text-secondary"
    >
      <span className="material-symbols-outlined text-[20px]">my_location</span>
    </button>
  );
}

const LEGEND: { dot: string; label: string; pulse?: boolean }[] = [
  { dot: '#60a5fa', label: 'CAM · LIVE' },
  { dot: '#64748b', label: 'CAM · IDLE' },
  { dot: '#f59e0b', label: 'WARNING', pulse: true },
  { dot: '#dc2626', label: 'CRITICAL', pulse: true },
  { dot: '#10b981', label: 'UNIT' },
];

export function MumbaiLiveMap({ interactive = true }: MumbaiLiveMapProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [osdb, setOsdb] = useState<ExternalCamera[] | null>(null);
  const [osdbState, setOsdbState] = useState<'off' | 'loading' | 'live' | 'error'>('off');
  const configured = isOsdbConfigured();

  const toggleOsdb = async () => {
    if (osdbState === 'loading') return;
    if (osdbState === 'live' && osdb) {
      setOsdb(null);
      setOsdbState('off');
      return;
    }
    if (!configured) {
      pushToast('OSDB feed is not configured (missing key).', 'error');
      return;
    }
    setOsdbState('loading');
    try {
      const cams = await fetchOsdbCameras();
      setOsdb(cams);
      setOsdbState('live');
      pushToast(`OSDB feed live — ${cams.length} external cameras plotted.`, 'success');
    } catch (e) {
      setOsdbState('error');
      pushToast(e instanceof Error ? e.message : 'OSDB feed unreachable.', 'error');
    }
  };

  const osdbChip =
    osdbState === 'live' && osdb
      ? `OSDB · ${osdb.length} LIVE`
      : osdbState === 'loading'
        ? 'OSDB · LOADING…'
        : osdbState === 'error'
          ? 'OSDB · OFFLINE'
          : 'OSDB · STANDBY';

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-outline-variant bg-primary shadow-card">
      <MapContainer
        center={CENTER}
        zoom={HOME_ZOOM}
        minZoom={10}
        maxZoom={16}
        maxBounds={BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={interactive}
        dragging={interactive}
        touchZoom={interactive}
        doubleClickZoom={interactive}
        zoomControl={false}
        attributionControl
        className="h-full w-full"
        style={{ background: '#0b1b2b' }}
      >
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <ZoomControl position="topright" />
        <ClusteredCameras interactive={interactive} />
        <Circle
          center={CRITICAL.pos}
          radius={900}
          pathOptions={{ color: '#dc2626', weight: 1.5, dashArray: '6 4', fillColor: '#dc2626', fillOpacity: 0.08 }}
        />
        <Circle
          center={WARNING.pos}
          radius={450}
          pathOptions={{ color: '#f59e0b', weight: 1.5, dashArray: '6 4', fillColor: '#f59e0b', fillOpacity: 0.08 }}
        />
        {UNITS.map((u) => (
          <Marker key={u.id} position={u.pos} icon={unitIcon(u.id)} keyboard={false} interactive={false} />
        ))}
        {osdb?.map((c) => (
          <Marker key={`osdb-${c.id}`} position={[c.lat, c.lng]} icon={osdbIcon(c.name)} keyboard={interactive}>
            <Popup>
              <div dangerouslySetInnerHTML={{ __html: osdbPopup(c) }} />
            </Popup>
          </Marker>
        ))}
        <Marker position={WARNING.pos} icon={incidentIcon('warning')} keyboard={interactive}>
          <Popup>
            <div
              dangerouslySetInnerHTML={{
                __html: incidentPopup({
                  id: WARNING.id,
                  title: WARNING.title,
                  cam: WARNING.cam,
                  meta: WARNING.meta,
                  unit: WARNING.unit,
                  critical: false,
                }),
              }}
            />
          </Popup>
        </Marker>
        <Marker position={CRITICAL.pos} icon={incidentIcon('critical')} keyboard={interactive} zIndexOffset={500}>
          <Popup>
            <div
              dangerouslySetInnerHTML={{
                __html: incidentPopup({
                  id: CRITICAL.id,
                  title: CRITICAL.title,
                  cam: CRITICAL.cam,
                  meta: CRITICAL.meta,
                  unit: CRITICAL.unit,
                  critical: true,
                }),
              }}
            />
          </Popup>
        </Marker>
        <RecenterButton />
      </MapContainer>

      {/* Overlay chips (never intercept map gestures) */}
      <div className="pointer-events-none absolute left-3 top-3 z-[500] flex items-center gap-2">
        <span className="rounded-lg bg-primary/85 px-2.5 py-1.5 font-data-mono-sm font-semibold text-blue-200 backdrop-blur-sm">
          MUMBAI · MH-MUM-01
        </span>
        <span className="hidden items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 font-data-mono-sm text-emerald-300 backdrop-blur-sm sm:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
        </span>
        <button
          type="button"
          onClick={toggleOsdb}
          title={configured ? 'Toggle provider camera feed' : 'OSDB feed not configured'}
          aria-pressed={osdbState === 'live'}
          className={`pointer-events-auto rounded-lg px-2.5 py-1.5 font-data-mono-sm font-semibold backdrop-blur-sm transition ${
            osdbState === 'live'
              ? 'bg-teal-500/25 text-teal-200'
              : osdbState === 'loading'
                ? 'bg-white/10 text-slate-300'
                : osdbState === 'error'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200'
          }`}
        >
          {osdbChip}
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[500] rounded-xl border border-white/10 bg-primary/85 px-3 py-2 backdrop-blur-sm">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {LEGEND.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 font-data-mono-sm text-slate-300">
              <span className="relative flex h-2 w-2">
                {l.pulse && <span className="absolute h-full w-full rounded-full animate-ping opacity-60" style={{ background: l.dot }} />}
                <span className="h-2 w-2 rounded-full" style={{ background: l.dot }} />
              </span>
              {l.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5 font-data-mono-sm text-slate-300">
            <span className="h-2 w-4 rounded-full border border-dashed border-red-400/70 bg-red-500/10" />
            IMPACT ZONE
          </span>
          {osdbState === 'live' && osdb && (
            <span className="flex items-center gap-1.5 font-data-mono-sm text-slate-300">
              <span className="h-2 w-2 rotate-45 rounded-[2px] bg-teal-400" />
              OSDB FEED · {osdb.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default MumbaiLiveMap;
