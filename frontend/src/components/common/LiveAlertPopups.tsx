import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useUiStore, type LiveAlert } from '../../store/uiStore';

const AUTO_DISMISS_MS = 25000;

function AlertCard({ alert }: { alert: LiveAlert }) {
  const navigate = useNavigate();
  const dismissAlert = useUiStore((s) => s.dismissAlert);

  useEffect(() => {
    const t = setTimeout(() => dismissAlert(alert.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [dismissAlert, alert.id]);

  const accident = alert.incidentType === 'ACCIDENT';
  return (
    <div
      role="alert"
      className={`pointer-events-auto w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-2xl border-2 bg-surface-container-lowest shadow-pop anim-scale-in ${
        accident ? 'border-error' : 'border-amber-500'
      }`}
    >
      <div className={`flex items-center gap-2 px-4 py-2 font-label-caps text-on-error ${accident ? 'bg-error' : 'bg-amber-500'}`}>
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute h-full w-full rounded-full bg-white animate-ping opacity-75" />
          <span className="h-2.5 w-2.5 rounded-full bg-white" />
        </span>
        <span className={accident ? '' : 'text-black'}>
          {accident ? 'VEHICLE COLLISION' : 'UNATTENDED BAGGAGE'}
        </span>
        <span className={`ml-auto rounded-md px-1.5 py-0.5 ${accident ? 'bg-white/20 text-white' : 'bg-black/15 text-black'}`}>
          {alert.severity.toUpperCase()}
        </span>
      </div>
      <div className="px-4 py-3">
        <p className="font-headline-md text-on-surface">{alert.title}</p>
        <p className="pt-1 font-data-mono-sm text-on-surface-variant">
          {alert.cameraId}
          {alert.confidence !== null ? ` · CONF ${alert.confidence.toFixed(1)}%` : ''}
          {' · '}
          {new Date(alert.at).toLocaleTimeString()}
        </p>
        <div className="flex gap-2 pt-3">
          <button
            type="button"
            onClick={() => {
              dismissAlert(alert.id);
              navigate(`/incidents/${alert.id}`);
            }}
            className={`flex-1 rounded-lg px-3 py-2 font-label-caps text-white transition ${
              accident ? 'bg-error hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            VIEW DETAILS
          </button>
          <button
            type="button"
            onClick={() => dismissAlert(alert.id)}
            className="rounded-lg border border-outline-variant px-3 py-2 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveAlertPopups() {
  const alerts = useUiStore((s) => s.alerts);
  if (alerts.length === 0) return null;
  // Above map/cards and modals (z-60), below toasts (z-70).
  return createPortal(
    <div aria-live="assertive" className="pointer-events-none fixed left-1/2 top-4 z-[65] flex -translate-x-1/2 flex-col items-center gap-2">
      {alerts.map((a) => (
        <AlertCard key={a.id} alert={a} />
      ))}
    </div>,
    document.body,
  );
}
