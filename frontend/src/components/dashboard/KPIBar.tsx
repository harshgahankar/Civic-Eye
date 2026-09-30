import { useEffect, useState } from 'react';
import KPIItem from './KPIItem';
import { backend, type BackendSnapshot } from '../../services/backend';

export function KPIBar() {
  const [snap, setSnap] = useState<BackendSnapshot | null>(null);

  useEffect(() => {
    let live = true;
    const poll = () => {
      backend.snapshot().then((s) => { if (live) setSnap(s); }).catch(() => {});
    };
    poll();
    const timer = setInterval(poll, 15000);
    return () => { live = false; clearInterval(timer); };
  }, []);

  if (!snap) {
    return (
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPIItem label="ACTIVE INCIDENTS" value="—" sub="connecting to backend…" icon="warning" />
        <KPIItem label="CRITICAL" value="—" sub="connecting to backend…" tone="critical" icon="priority_high" />
        <KPIItem label="HIGH" value="—" sub="connecting to backend…" icon="warning" />
        <KPIItem label="CAMERAS ONLINE" value="—" sub="connecting to backend…" tone="ok" icon="videocam" />
        <KPIItem label="CAMERAS OFFLINE" value="—" sub="connecting to backend…" icon="bolt" />
      </section>
    );
  }

  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KPIItem label="ACTIVE INCIDENTS" value={String(snap.active_incidents)} sub="detected · verifying · confirmed" icon="warning" />
      <KPIItem label="CRITICAL" value={String(snap.critical_incidents)} sub="live count" tone="critical" icon="priority_high" />
      <KPIItem label="HIGH" value={String(snap.high_incidents)} sub="live count" icon="warning" />
      <KPIItem label="CAMERAS ONLINE" value={String(snap.cameras_online)} sub="health service" tone="ok" icon="videocam" />
      <KPIItem label="CAMERAS OFFLINE" value={String(snap.cameras_offline)} sub="health service" icon="bolt" />
    </section>
  );
}

export default KPIBar;
