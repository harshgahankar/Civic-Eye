import KPIItem from './KPIItem';

export function KPIBar() {
  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <KPIItem label="ACTIVE CAMERAS" value="24" sub="All feeds nominal" tone="ok" icon="videocam" trend="▲ 100%" />
      <KPIItem label="OPEN INCIDENTS" value="03" sub="2 high · 1 medium" icon="warning" />
      <KPIItem label="CRITICAL ALERT" value="01" sub="CAM-07 · Times Sq" tone="critical" icon="priority_high" />
      <KPIItem label="AI CONFIDENCE" value="98.2%" sub="Vision stack v4" tone="ok" icon="psychology" trend="▲ 0.4%" />
      <KPIItem label="PIPELINE LATENCY" value="1.4s" sub="Detect → dispatch" icon="bolt" trend="▼ 0.2s" />
    </section>
  );
}

export default KPIBar;
