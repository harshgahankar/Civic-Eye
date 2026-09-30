export function AIConfidence({ value = 98.2 }: { value?: number }) {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-sm p-space-md">
      <div className="flex justify-between items-baseline">
        <p className="font-label-caps text-on-surface-variant">AI CONFIDENCE</p>
        <p className="font-data-mono-lg text-on-surface">{value.toFixed(1)}%</p>
      </div>
      <div className="mt-space-sm h-2 bg-surface-container-high rounded-full overflow-hidden">
        <div className="h-full bg-secondary rounded-full" style={{ width: `${value}%` }} />
      </div>
      <p className="pt-space-xs font-data-mono-sm text-on-surface-variant">THRESHOLD 85% · MARGIN +13.2</p>
    </div>
  );
}

export default AIConfidence;
