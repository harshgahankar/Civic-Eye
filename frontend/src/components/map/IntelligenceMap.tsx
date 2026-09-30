import CameraMarker from './CameraMarker';
import IncidentMarker from './IncidentMarker';
import ResourceMarker from './ResourceMarker';

export interface IntelligenceMapProps {
  interactive?: boolean;
}

export function IntelligenceMap({ interactive = true }: IntelligenceMapProps) {
  return (
    <div className={`relative w-full h-[420px] bg-primary overflow-hidden rounded-sm border border-outline-variant ${interactive ? '' : 'pointer-events-none'}`}>
      <svg viewBox="0 0 800 420" className="absolute inset-0 w-full h-full" aria-hidden>
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
      <div className="absolute left-[58%] top-[30%] bg-error-container text-on-error-container border border-error rounded-sm p-space-sm max-w-[220px] shadow-lg">
        <p className="font-label-caps">CAM-07 · CRITICAL</p>
        <p className="font-body-sm">Unattended baggage · Times Sq · conf 98.2%</p>
      </div>
      <p className="absolute bottom-space-sm left-space-sm font-data-mono-sm text-secondary-fixed-dim">BLUEPRINT GRID · NYC-METRO-01 · RIVER + ROAD LAYER</p>
    </div>
  );
}

export default IntelligenceMap;
