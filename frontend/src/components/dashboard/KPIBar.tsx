import KPIItem from './KPIItem';

export function KPIBar() {
  return (
    <section aria-label="Key metrics" className="grid grid-cols-2 md:grid-cols-5 gap-space-sm bg-surface-container-lowest border border-outline-variant rounded-sm p-space-sm">
      <KPIItem label="ACTIVE CAMERAS" value="24" sub="ALL FEEDS NOMINAL" tone="ok" />
      <KPIItem label="OPEN INCIDENTS" value="03" sub="2 HIGH · 1 MEDIUM" />
      <KPIItem label="CRITICAL ALERT" value="01" sub="CAM-07 · TIMES SQ" tone="critical" />
      <KPIItem label="AI CONFIDENCE" value="98.2%" sub="VISION STACK v4" tone="ok" />
      <KPIItem label="PIPELINE LATENCY" value="1.4s" sub="DETECT → DISPATCH" />
    </section>
  );
}

export default KPIBar;
