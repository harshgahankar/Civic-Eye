export function AIAnalysis() {
  return (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <p className="font-label-caps text-on-surface-variant">INFERENCE ENGINE</p>
      <h3 className="font-headline-md text-on-surface">Abandoned luggage · conf 98.2%</h3>
      <p className="font-body-md text-on-surface pt-space-xs">
        YOLOv8 detection fused with multi-frame tracker. Owner separation &gt;90s triggers critical.
        Secondary check: crowd density nominal, no occlusion conflict.
      </p>
      <div className="flex gap-space-sm pt-space-sm">
        <span className="font-data-mono-sm bg-primary-fixed text-on-primary-fixed px-space-sm py-1 rounded-sm">MODEL v4.2</span>
        <span className="font-data-mono-sm bg-secondary-fixed text-on-secondary-fixed px-space-sm py-1 rounded-sm">FUSION OK</span>
      </div>
    </section>
  );
}

export default AIAnalysis;
