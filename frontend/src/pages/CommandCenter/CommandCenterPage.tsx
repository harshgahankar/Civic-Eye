import KPIBar from '../../components/dashboard/KPIBar';
import LiveIncidentRail from '../../components/dashboard/LiveIncidentRail';
import SystemStatus from '../../components/dashboard/SystemStatus';
import IntelligenceMap from '../../components/map/IntelligenceMap';

const AERIAL_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC4bJBHdbCK6ORxpT380TsrWXgSmKIpESzBMV8Rz1GJ47t-0o08TRmA2_OSq4fBrvMN80QZ8RrWwuu0DzbzyiKpW7dyCQb9b1DnloFPET9kbsoGnSm_4udA_TcyAGWaQOEtELbx488rvxFKz9A5Anl6AXNMF8shtfu9xWAfflm20hsLkL3K8hlxZnFEsIDfanSZ_0wCsJhSshSjDL5V3vqMZKxpBCWBcg4UDTu8ngsmGsLyA2u0Aa4m';

export function CommandCenterPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      {/* Editorial masthead */}
      <section aria-label="Command masthead" className="relative overflow-hidden rounded-sm border border-outline-variant bg-primary">
        <img src={AERIAL_IMG} alt="Aerial surveillance grid" className="absolute inset-0 h-full w-full object-cover opacity-40" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/70 to-transparent" />
        {/* REC overlay + reticle */}
        <div className="absolute top-space-sm right-space-md flex items-center gap-space-sm">
          <span className="flex items-center gap-1 font-data-mono-sm text-on-primary">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-error" /> REC
          </span>
          <span className="font-data-mono-sm text-secondary-fixed">GRID NYC-METRO-01</span>
        </div>
        <span aria-hidden className="absolute left-1/2 top-1/2 hidden h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-secondary-fixed/60 md:block" />
        <span aria-hidden className="absolute left-1/2 top-1/2 hidden h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-secondary-fixed/30 md:block" />
        <div className="relative p-space-lg">
          <p className="font-label-caps text-secondary-fixed">TACTICAL SURVEILLANCE DOSSIER</p>
          <h1 className="font-headline-xl text-on-primary pt-space-xs">COMMAND CENTER</h1>
          <p className="font-data-mono-md text-secondary-fixed-dim pt-space-sm">MONITOR&middot;DETECT&middot;RESPOND</p>
        </div>
      </section>

      {/* Metric ribbon */}
      <KPIBar />

      {/* Split display */}
      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-12">
        <div className="lg:col-span-8">
          <IntelligenceMap interactive />
        </div>
        <div className="lg:col-span-4">
          <LiveIncidentRail />
        </div>
      </div>

      <SystemStatus />
    </div>
  );
}

export default CommandCenterPage;
