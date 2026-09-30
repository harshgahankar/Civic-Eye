import ResourceStatus from '../../components/emergency/ResourceStatus';
import ResponseUnit from '../../components/emergency/ResponseUnit';
import { mockUnits } from '../../data/mockResources';

export function ResourcesPage() {
  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <p className="font-label-caps text-on-surface-variant">FLEET LEDGER &middot; READINESS</p>
        <h1 className="font-headline-xl text-on-surface">RESOURCES</h1>
      </header>
      <ResourceStatus />
      <section className="overflow-x-auto rounded-sm border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-left">
          <thead>
            <tr className="font-label-caps text-on-surface-variant">
              <th className="px-space-sm py-space-xs">UNIT</th>
              <th className="px-space-sm py-space-xs">TYPE</th>
              <th className="px-space-sm py-space-xs">ETA</th>
              <th className="px-space-sm py-space-xs">STATUS</th>
            </tr>
          </thead>
          <tbody>
            {mockUnits.map((u) => (
              <ResponseUnit key={u.id} unit={{ id: u.id, type: u.type, status: u.status.toUpperCase(), eta: u.eta.toUpperCase() }} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export default ResourcesPage;
