import KPIBar from '../../components/dashboard/KPIBar';
import LiveIncidentRail from '../../components/dashboard/LiveIncidentRail';
import SystemStatus from '../../components/dashboard/SystemStatus';
import MumbaiLiveMap from '../../components/map/MumbaiLiveMap';

const AERIAL_IMG =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC4bJBHdbCK6ORxpT380TsrWXgSmKIpESzBMV8Rz1GJ47t-0o08TRmA2_OSq4fBrvMN80QZ8RrWwuu0DzbzyiKpW7dyCQb9b1DnloFPET9kbsoGnSm_4udA_TcyAGWaQOEtELbx488rvxFKz9A5Anl6AXNMF8shtfu9xWAfflm20hsLkL3K8hlxZnFEsIDfanSZ_0wCsJhSshSjDL5V3vqMZKxpBCWBcg4UDTu8ngsmGsLyA2u0Aa4m';

export function CommandCenterPage() {
  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <section aria-label="Command masthead" className="relative overflow-hidden rounded-2xl bg-primary-container shadow-pop">
        <img src={AERIAL_IMG} alt="Aerial surveillance grid" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f172a] via-[#0f172a]/85 to-[#0f172a]/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/60 via-transparent to-transparent" />
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur px-2.5 py-1 font-data-mono-sm text-white border border-white/15">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" /> REC
          </span>
          <span className="hidden sm:inline rounded-full bg-white/10 backdrop-blur px-2.5 py-1 font-data-mono-sm text-blue-200 border border-white/15">GRID NYC-METRO-01</span>
        </div>
        <div className="relative p-6 sm:p-8 lg:p-10 max-w-2xl">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-secondary/15 border border-secondary/30 px-2.5 py-1 font-label-caps text-blue-200">
            TACTICAL SURVEILLANCE DOSSIER
          </p>
          <h1 className="pt-3 font-headline-xl text-white tracking-tight">Command Center</h1>
          <p className="pt-2 font-body-lg text-slate-300">City-wide incident overview — live cameras, geospatial intel and response status at a glance.</p>
          <p className="pt-3 font-data-mono-md tracking-widest text-blue-300">MONITOR · DETECT · RESPOND</p>
        </div>
      </section>

      {/* Metric ribbon */}
      <KPIBar />

      {/* Split display */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8 min-w-0">
          <MumbaiLiveMap interactive />
        </div>
        <div className="lg:col-span-4 min-w-0">
          <LiveIncidentRail />
        </div>
      </div>

      <SystemStatus />
    </div>
  );
}

export default CommandCenterPage;
