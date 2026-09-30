import { useState } from 'react';
import { useParams } from 'react-router-dom';
import IncidentDetails from '../../components/incidents/IncidentDetails';
import AIAnalysis from '../../components/ai/AIAnalysis';
import AIDecisionTrail from '../../components/ai/AIDecisionTrail';
import EmergencyPanel from '../../components/emergency/EmergencyPanel';
import DispatchModal from '../../components/emergency/DispatchModal';
import DetectionOverlay from '../../components/cctv/DetectionOverlay';
import { printPage } from '../../utils/actions';
import { useUiStore } from '../../store/uiStore';

const FEED_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCeoZtQeufb9Na37b9Xq3_BjHWzjZiIGKKOk1iB_-3Q6e-jtYvYUFFeXfLm-Dl3zXWcxhc5Cr2RllvsIrBnSON613Ef3nFeyZH4YnBVsls6r8eIwAUbAUdrzSD-mz8rrVZEzSth4OBFd4hKlAbiASVDSGchQrc8-IHv4n1I7yFgQqnKwZVzCM6LPEAYLV_LV7pjhM1mD_ZR0DaxBZtodzcMHApoDGgSVXTDOjeKPUt1ekRigwYZ3T2F';

const META = [
  { k: 'SEVERITY', v: 'CRITICAL' },
  { k: 'STATUS', v: 'ACTIVE' },
  { k: 'CAMERA', v: 'CAM-07 · JUNCTION A' },
  { k: 'REPORTED', v: '08:42:10Z' },
  { k: 'CONFIDENCE', v: '94.2%' },
];

const ENTITIES = [
  { k: 'VEHICLES', v: '3 TRACKED' },
  { k: 'PERSONS', v: '6 IN FRAME' },
  { k: 'PLATES', v: '2 CAPTURED' },
  { k: 'CLIPS', v: '4 SEALED' },
];

export function IncidentDetailsPage() {
  const { id } = useParams();
  const num = id ?? '1042';
  const pushToast = useUiStore((s) => s.pushToast);
  const [forwarded, setForwarded] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);

  const forward = () => {
    setForwarded(true);
    pushToast(`INC-${num} dossier forwarded to watch command.`, 'success');
  };

  return (
    <div className="flex flex-col gap-space-lg">
      {/* Dossier header */}
      <header className="flex flex-wrap items-end gap-space-md">
        <div>
          <p className="font-label-caps text-on-surface-variant">CASE FILE &middot; TRAFFIC DIVISION</p>
          <h1 className="font-headline-xl text-on-surface">INCIDENT {num}</h1>
        </div>
        <div className="ml-auto flex gap-space-sm">
          <button type="button" onClick={printPage} className="font-label-caps rounded-sm border border-outline px-space-md py-2 text-on-surface-variant hover:border-on-surface-variant transition">PRINT</button>
          <button
            type="button"
            onClick={forward}
            disabled={forwarded}
            className="font-label-caps rounded-sm bg-secondary px-space-md py-2 text-on-primary hover:bg-blue-700 disabled:opacity-60 disabled:pointer-events-none transition"
          >
            {forwarded ? 'FORWARDED ✓' : 'FORWARD'}
          </button>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-space-sm md:grid-cols-5">
        {META.map((m) => (
          <div key={m.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
            <p className="font-label-caps text-on-surface-variant">{m.k}</p>
            <p className="font-data-mono-md text-on-surface pt-1">{m.v}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-space-md xl:grid-cols-12">
        {/* Left: visual feed + timeline + inventory */}
        <div className="flex flex-col gap-space-md xl:col-span-7">
          <section className="overflow-hidden rounded-sm border border-outline-variant bg-primary-container">
            <div className="relative aspect-video bg-primary">
              <img src={FEED_IMG} alt="CAM-07 incident feed" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
              <DetectionOverlay
                boxes={[
                  { x: '40%', y: '46%', w: '24%', h: '32%', label: 'COLLISION 0.94', color: 'border-error' },
                  { x: '15%', y: '52%', w: '12%', h: '28%', label: 'VEHICLE 0.91', color: 'border-secondary-fixed' },
                  { x: '68%', y: '58%', w: '9%', h: '24%', label: 'PERSON 0.88', color: 'border-secondary-fixed' },
                ]}
              />
              <span className="absolute left-space-sm top-space-sm bg-error px-space-sm py-0.5 font-data-mono-sm text-on-error">
                CAM-07 &middot; LIVE
              </span>
            </div>
            <div className="flex items-center gap-space-sm px-space-md py-space-sm">
              <span className="font-data-mono-sm text-on-primary-container">00:41</span>
              <span className="h-1 flex-1 rounded-full bg-primary"><span className="block h-full w-1/3 rounded-full bg-secondary" /></span>
              <span className="font-data-mono-sm text-on-primary-container">02:00</span>
            </div>
          </section>
          <AIDecisionTrail />
          <section className="grid grid-cols-2 gap-space-sm md:grid-cols-4">
            {ENTITIES.map((e) => (
              <div key={e.k} className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-sm">
                <p className="font-label-caps text-on-surface-variant">{e.k}</p>
                <p className="font-data-mono-md text-on-surface pt-1">{e.v}</p>
              </div>
            ))}
          </section>
          <IncidentDetails
            dossier={{
              id: `INC-${num}`,
              title: 'Traffic accident — multi-vehicle collision',
              severity: 'critical',
              status: 'open',
              cam: 'CAM-07',
              time: '08:42:10Z',
              narrative: 'Multi-vehicle collision at Junction A. Two lanes blocked, EMS-14 and POL-208 assigned.',
            }}
          />
        </div>

        {/* Right: AI + sensors + dispatch */}
        <div className="flex flex-col gap-space-md xl:col-span-5">
          <AIAnalysis />
          <section className="rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md">
            <p className="font-label-caps text-on-surface-variant">CORROBORATION SENSORS</p>
            <ul className="pt-space-sm font-data-mono-md text-on-surface">
              <li className="flex justify-between border-b border-outline-variant py-1"><span>INDUCTION LOOP C-3</span><span>IMPACT + QUEUE</span></li>
              <li className="flex justify-between border-b border-outline-variant py-1"><span>ACOUSTIC ARRAY</span><span>85 DB SPIKE</span></li>
              <li className="flex justify-between py-1"><span>SIGNAL CONTROLLER</span><span>HOLD ALL-RED</span></li>
            </ul>
          </section>
          <EmergencyPanel onDispatch={() => setDispatchOpen(true)} />
        </div>
      </div>
      <DispatchModal open={dispatchOpen} incidentId={`INC-${num}`} onClose={() => setDispatchOpen(false)} />
    </div>
  );
}

export default IncidentDetailsPage;
