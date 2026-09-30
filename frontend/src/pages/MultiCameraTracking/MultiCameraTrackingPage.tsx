import TrackingSection from '../../components/tracking/TrackingSection';

export function MultiCameraTrackingPage() {
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="eyebrow">Cross-camera subject trail</p>
        <h1 className="font-headline-xl text-on-surface tracking-tight">Multi-Camera Tracking</h1>
      </header>
      <div className="card overflow-hidden">
        <TrackingSection />
      </div>
    </div>
  );
}

export default MultiCameraTrackingPage;
