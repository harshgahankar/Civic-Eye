import CCTVCard, { type CameraFeed } from './CCTVCard';

export interface CCTVGridProps {
  cameras: CameraFeed[];
}

export function CCTVGrid({ cameras }: CCTVGridProps) {
  if (cameras.length === 0) {
    return (
      <p className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 text-center font-body-sm text-on-surface-variant">
        No camera feeds available.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
      {cameras.map((c) => (
        <CCTVCard key={c.id} camera={c} />
      ))}
    </div>
  );
}

export default CCTVGrid;
