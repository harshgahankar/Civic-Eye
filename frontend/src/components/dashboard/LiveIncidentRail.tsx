import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import { useUiStore } from '../../store/uiStore';

interface RailIncident {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  cam: string;
  time: string;
  conf: string;
  status: string;
}

const ITEMS: RailIncident[] = [
  { id: 'INC-2401', title: 'Unattended baggage — Times Sq', severity: 'critical', cam: 'CAM-07', time: '14:02:11Z', conf: '94.2%', status: 'DISPATCHED · EMS/NYPD' },
  { id: 'INC-2400', title: 'Crowd surge — Herald Sq', severity: 'high', cam: 'CAM-12', time: '13:58:44Z', conf: '87.1%', status: 'ACTIVE MONITORING' },
  { id: 'INC-2399', title: 'Loitering cluster — Penn Stn', severity: 'medium', cam: 'CAM-03', time: '13:51:02Z', conf: '91.3%', status: 'VERIFICATION PENDING' },
];

const sev: Record<RailIncident['severity'], { dot: string; ring: string }> = {
  critical: { dot: 'bg-error', ring: 'border-l-error' },
  high: { dot: 'bg-amber-500', ring: 'border-l-amber-500' },
  medium: { dot: 'bg-secondary', ring: 'border-l-secondary' },
};

export function LiveIncidentRail() {
  const navigate = useNavigate();
  const pushToast = useUiStore((s) => s.pushToast);
  const [acked, setAcked] = useState<Set<string>>(new Set());
  const [quickId, setQuickId] = useState<string | null>(null);
  const quick = ITEMS.find((i) => i.id === quickId) ?? null;

  const ack = (id: string) => {
    setAcked((p) => new Set(p).add(id));
    pushToast(`${id} acknowledged by watch command.`, 'success');
  };

  return (
    <section aria-label="Live dossier stream" className="card card-pad flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 pb-3">
        <div>
          <p className="eyebrow">Live queue</p>
          <h3 className="section-title text-[22px]">Dossier Stream</h3>
        </div>
        <Link to="/emergency" className="rounded-lg px-2.5 py-1.5 font-label-caps text-secondary hover:bg-blue-50 transition">
          VIEW ALL →
        </Link>
      </div>
      <ul className="flex flex-1 flex-col gap-2.5">
        {ITEMS.map((i) => {
          const done = acked.has(i.id);
          return (
            <li
              key={i.id}
              className={`rounded-xl border border-outline-variant border-l-4 ${sev[i.severity].ring} bg-surface p-3 transition-all hover:shadow-card hover:-translate-y-px ${done ? 'opacity-70' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${sev[i.severity].dot}`} />
                <p className="font-data-mono-md font-semibold text-on-surface">{i.id} · {i.cam}</p>
                <span className="ml-auto font-data-mono-sm text-on-surface-variant">{i.time}</span>
              </div>
              <p className="py-1.5 font-body-md font-medium text-on-surface">{i.title}</p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    pushToast(`${i.id} intercept opened — nearest unit paged.`, 'info');
                    navigate(`/incidents/${i.id}`);
                  }}
                  className="rounded-lg bg-error px-2.5 py-1 font-label-caps text-on-error hover:bg-red-700 transition"
                >
                  INTERCEPT
                </button>
                <button
                  type="button"
                  onClick={() => setQuickId(i.id)}
                  className="rounded-lg border border-secondary/40 px-2.5 py-1 font-label-caps text-secondary hover:bg-blue-50 transition"
                >
                  DETAILS
                </button>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => ack(i.id)}
                  className="rounded-lg border border-outline-variant px-2.5 py-1 font-label-caps text-on-surface-variant hover:border-on-surface-variant disabled:opacity-50 disabled:pointer-events-none transition"
                >
                  {done ? '✓ ACKED' : 'ACK'}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={quick !== null} title={quick ? `${quick.id} · QUICK LOOK` : ''} onClose={() => setQuickId(null)}>
        {quick && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={quick.severity}>{quick.severity}</Badge>
              <span className="font-data-mono-sm text-on-surface-variant">{quick.cam} · {quick.time}</span>
            </div>
            <p className="font-headline-md text-on-surface">{quick.title}</p>
            <dl className="grid grid-cols-2 gap-2 rounded-xl bg-surface-container-low p-3 font-data-mono-sm">
              <div>
                <dt className="font-label-caps text-on-surface-variant">AI CONFIDENCE</dt>
                <dd className="font-semibold text-on-surface">{quick.conf}</dd>
              </div>
              <div>
                <dt className="font-label-caps text-on-surface-variant">STATUS</dt>
                <dd className="font-semibold text-on-surface">{quick.status}</dd>
              </div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuickId(null);
                  pushToast(`${quick.id} intercept opened — nearest unit paged.`, 'info');
                  navigate(`/incidents/${quick.id}`);
                }}
                className="flex-1 rounded-lg bg-error px-3 py-2 font-label-caps text-on-error hover:bg-red-700 transition"
              >
                INTERCEPT FULL DOSSIER
              </button>
              <button
                type="button"
                onClick={() => {
                  ack(quick.id);
                  setQuickId(null);
                }}
                disabled={acked.has(quick.id)}
                className="rounded-lg border border-outline-variant px-3 py-2 font-label-caps text-on-surface-variant hover:border-on-surface-variant disabled:opacity-50 transition"
              >
                {acked.has(quick.id) ? '✓ ACKED' : 'ACKNOWLEDGE'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

export default LiveIncidentRail;
