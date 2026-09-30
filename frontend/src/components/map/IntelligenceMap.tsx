import CameraMarker from './CameraMarker';
import IncidentMarker from './IncidentMarker';
import ResourceMarker from './ResourceMarker';

export interface IntelligenceMapProps {
  interactive?: boolean;
}

export function IntelligenceMap({ interactive = true }: IntelligenceMapProps) {
  return (
    <div className={`relative w-full h-[420px] bg-primary overflow-hidden rounded-xl border border-outline-variant shadow-card ${interactive ? '' : 'pointer-events-none'}`}>
      <svg viewBox="0 0 800 420" className="absolute inset-0 w-full h-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#3c475d" strokeWidth="0.5" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="800" height="420" fill="#1b263b" />
        <rect width="800" height="420" fill="url(#grid)" />
        <path d="M0 300 C 200 280, 400 340, 800 290 L 800 420 L 0 420 Z" fill="#24466e" opacity="0.8" />
        <path d="M0 120 H800 M0 200 H800 M120 0 V420 M320 0 V420 M560 0 V420" stroke="#828da7" strokeWidth="2" opacity="0.4" />
        <path d="M120 200 L560 120" stroke="#d3e3ff" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.7" />
      </svg>
      <CameraMarker x="30%" y="28%" id="CAM-03" />
      <CameraMarker x="62%" y="42%" id="CAM-12" />
      <CameraMarker x="70%" y="55%" id="CAM-07" critical />
      <IncidentMarker x="70%" y="55%" label="INC-2401 CRITICAL" />
      <ResourceMarker x="45%" y="60%" label="UNIT-12" />
      <ResourceMarker x="78%" y="35%" label="UNIT-07" />
      <div className="absolute left-1/2 top-[16%] w-max max-w-[min(220px,60%)] -translate-x-1/2 rounded-xl border border-red-200 bg-red-50/95 p-2.5 shadow-pop backdrop-blur-sm sm:left-[58%] sm:top-[30%] sm:translate-x-0">
        <p className="font-label-caps text-error">CAM-07 · CRITICAL</p>
        <p className="pt-0.5 font-body-sm text-on-surface">Unattended baggage · Times Sq · conf 98.2%</p>
      </div>
      <p className="absolute bottom-2.5 left-3 rounded bg-primary/70 px-1.5 py-0.5 font-data-mono-sm text-blue-200 backdrop-blur-sm">BLUEPRINT GRID · NYC-METRO-01 · RIVER + ROAD LAYER</p>
    </div>
  );
}

export default IntelligenceMap;
