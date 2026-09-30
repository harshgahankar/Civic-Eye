export interface CCTVPlayerProps {
  src: string;
  label?: string;
}

export function CCTVPlayer({ src, label = 'REPLAY' }: CCTVPlayerProps) {
  return (
    <div className="bg-primary-container border border-outline/20 rounded-sm overflow-hidden">
      <p className="font-label-caps text-on-primary-container px-space-sm pt-space-sm">{label}</p>
      <div className="relative aspect-video">
        <img src={src} alt="CCTV replay" className="absolute inset-0 w-full h-full object-cover" />
      </div>
      <div className="px-space-sm pb-space-sm">
        <input type="range" aria-label="scrub" defaultValue={32} className="w-full accent-secondary" />
        <div className="flex justify-between font-data-mono-sm text-on-primary-container">
          <span>14:01:02</span>
          <span>14:02:11</span>
        </div>
      </div>
    </div>
  );
}

export default CCTVPlayer;
