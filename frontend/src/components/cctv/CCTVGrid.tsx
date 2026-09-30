import CCTVCard, { type CameraFeed } from './CCTVCard';
import DetectionOverlay from './DetectionOverlay';

const PLACEHOLDER = 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=640&q=60&auto=format&fit=crop';

export interface CCTVGridProps {
  cameras?: CameraFeed[];
}

export function CCTVGrid({ cameras }: CCTVGridProps) {
  const feeds: CameraFeed[] = cameras ?? [
    { id: 'CAM-07', name: 'Times Sq', src: PLACEHOLDER, fps: 30, live: true },
    { id: 'CAM-12', name: 'Herald Sq', src: PLACEHOLDER, fps: 30, live: true },
    { id: 'CAM-03', name: 'Penn Stn', src: PLACEHOLDER, fps: 25, live: true },
    { id: 'CAM-21', name: 'Union Sq', src: PLACEHOLDER, fps: 30, live: false },
  ];
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
      {feeds.map((c, i) => (
        <CCTVCard key={c.id} camera={c} overlay={i === 0 ? <DetectionOverlay /> : undefined} />
      ))}
    </div>
  );
}

export default CCTVGrid;
