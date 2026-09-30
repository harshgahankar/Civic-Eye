import CameraMarker from './CameraMarker';
import IncidentMarker from './IncidentMarker';
import ResourceMarker from './ResourceMarker';
import type { MapMode } from './MapControls';

export interface MumbaiMapProps {
  interactive?: boolean;
  mode?: MapMode;
  zoom?: number;
}

const MODE_FILTER: Record<MapMode, string> = {
  OPTICAL: 'none',
  THERMAL: 'sepia(0.55) hue-rotate(-35deg) saturate(2.2) contrast(1.05)',
  TRAFFIC: 'saturate(1.7) contrast(1.12)',
};

/**
 * Stylized Mumbai operations grid (Salsette island + harbour).
 * Marker positions are projected from real WGS-84 coordinates onto the
 * 800x460 viewBox (lon 72.75–73.00, lat 18.85–19.30).
 */
export function MumbaiMap({ interactive = true, mode = 'OPTICAL', zoom = 1 }: MumbaiMapProps) {
  return (
    <div className={`relative w-full h-[420px] bg-primary overflow-hidden rounded-xl border border-outline-variant shadow-card ${interactive ? '' : 'pointer-events-none'}`}>
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
      >
        <svg viewBox="0 0 800 460" className="absolute inset-0 w-full h-full" aria-hidden preserveAspectRatio="xMidYMid slice" style={{ filter: MODE_FILTER[mode] }}>
          <defs>
            <pattern id="mumbai-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3c475d" strokeWidth="0.5" opacity="0.5" />
            </pattern>
            <linearGradient id="mumbai-sea" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#13263c" />
              <stop offset="100%" stopColor="#0e1c2e" />
            </linearGradient>
          </defs>

          {/* Sea */}
          <rect width="800" height="460" fill="url(#mumbai-sea)" />
          <rect width="800" height="460" fill="url(#mumbai-grid)" />

          {/* Salsette island landmass */}
          <path
            d="M330,28 L520,44 L660,68 L722,108 L682,168 L622,228 L522,298 L422,358 L322,398 L242,424 L202,400 L196,330 L212,272 L202,222 L216,170 L252,118 L300,68 Z"
            fill="#23405f"
            stroke="#4a6b8d"
            strokeWidth="1.5"
            opacity="0.95"
          />
          {/* Trombay / Chembur rise */}
          <path
            d="M560,200 L610,210 L600,260 L555,250 Z"
            fill="#2a4a6e"
            stroke="#4a6b8d"
            strokeWidth="1"
            opacity="0.9"
          />
          {/* Elephanta island */}
          <ellipse cx="470" cy="345" rx="16" ry="10" fill="#2a4a6e" stroke="#4a6b8d" strokeWidth="1" />

          {/* Thane creek */}
          <path d="M660,68 C 640,120 630,170 622,228" fill="none" stroke="#5f87a8" strokeWidth="5" opacity="0.85" strokeLinecap="round" />

          {/* Arterials */}
          <g fill="none" strokeLinecap="round">
            {/* Western Express Hwy */}
            <path d="M300,60 L295,400" stroke="#d3e3ff" strokeWidth="2.5" opacity="0.75" />
            <path d="M300,60 L295,400" stroke="#0f172a" strokeWidth="0.8" strokeDasharray="7 5" opacity="0.9" />
            {/* Eastern Express Hwy */}
            <path d="M470,60 L440,360" stroke="#d3e3ff" strokeWidth="2.5" opacity="0.75" />
            <path d="M470,60 L440,360" stroke="#0f172a" strokeWidth="0.8" strokeDasharray="7 5" opacity="0.9" />
            {/* Bandra–Worli Sea Link */}
            <path d="M221,273 C 205,295 198,312 200,330" stroke="#fbbf24" strokeWidth="3" opacity="0.9" />
            {/* Atal Setu harbour link */}
            <path d="M420,352 C 490,345 560,338 628,330" stroke="#d3e3ff" strokeWidth="2" strokeDasharray="8 4" opacity="0.7" />
          </g>

          {/* Water labels */}
          <text x="70" y="230" fill="#7d9cbd" fontSize="13" letterSpacing="3" transform="rotate(-90 70 230)" fontFamily="monospace">ARABIAN SEA</text>
          <text x="500" y="330" fill="#7d9cbd" fontSize="11" letterSpacing="2" fontFamily="monospace">MUMBAI HARBOUR</text>
          <text x="636" y="60" fill="#7d9cbd" fontSize="11" letterSpacing="2" fontFamily="monospace">THANE CREEK</text>
          <text x="448" y="368" fill="#5f87a8" fontSize="9" letterSpacing="1" fontFamily="monospace">ELEPHANTA I.</text>
          {/* Locality labels */}
          <text x="330" y="52" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">BORIVALI</text>
          <text x="690" y="130" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">THANE</text>
          <text x="505" y="172" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">POWAI</text>
          <text x="375" y="200" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">AIRPORT T2</text>
          <text x="252" y="188" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">JUHU</text>
          <text x="150" y="300" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">SEA LINK</text>
          <text x="350" y="312" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">DADAR</text>
          <text x="278" y="392" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">CSMT</text>
          <text x="150" y="415" fill="#a9c3dc" fontSize="10" letterSpacing="1" fontFamily="monospace">COLABA</text>
        </svg>
      </div>

      {/* Camera nodes (projected WGS-84) */}
      <CameraMarker x="42.6%" y="15.4%" id="CAM-11" />
      <CameraMarker x="88%" y="25.2%" id="CAM-14" />
      <CameraMarker x="62.4%" y="40%" id="CAM-09" />
      <CameraMarker x="46.3%" y="46.5%" id="CAM-05" />
      <CameraMarker x="30.5%" y="42.8%" id="CAM-04" />
      <CameraMarker x="27.6%" y="59.3%" id="CAM-06" />
      <CameraMarker x="42.5%" y="62.8%" id="CAM-07" critical />
      <IncidentMarker x="42.5%" y="62.8%" label="INC-2401 CRITICAL" />
      <ResourceMarker x="48%" y="69%" label="UNIT-12" />
      <ResourceMarker x="52%" y="52%" label="UNIT-07" />
      <CameraMarker x="34.3%" y="80%" id="CAM-03" />
      <CameraMarker x="25.9%" y="87.4%" id="CAM-02" />

      {/* Critical callout */}
      <div className="absolute left-1/2 top-[30%] w-max max-w-[min(230px,62%)] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50/95 p-2.5 shadow-pop backdrop-blur-sm sm:left-[47%] sm:top-[68%] sm:translate-x-0">
        <p className="font-label-caps text-error">CAM-07 · CRITICAL</p>
        <p className="pt-0.5 font-body-sm text-on-surface">Dadar TT pile-up · 2 lanes blocked · conf 94.2%</p>
      </div>

      <p className="absolute bottom-2.5 left-3 rounded bg-primary/70 px-1.5 py-0.5 font-data-mono-sm text-blue-200 backdrop-blur-sm">
        MUMBAI GRID · MH-MUM-01 · {mode} LAYER · {Math.round(zoom * 100)}%
      </p>
    </div>
  );
}

export default MumbaiMap;
