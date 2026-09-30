import { useState } from 'react';

export function SettingsPage() {
  const [retention, setRetention] = useState('90 DAYS');
  const [autoDispatch, setAutoDispatch] = useState(true);
  const [threshold, setThreshold] = useState(85);

  return (
    <div className="flex flex-col gap-space-lg">
      <header>
        <p className="font-label-caps text-on-surface-variant">CONSOLE PREFERENCES</p>
        <h1 className="font-headline-xl text-on-surface">SETTINGS</h1>
      </header>
      <form className="flex max-w-xl flex-col gap-space-md rounded-sm border border-outline-variant bg-surface-container-lowest p-space-md" onSubmit={(e) => e.preventDefault()}>
        <label className="flex items-center justify-between gap-space-md font-data-mono-md text-on-surface">
          FOOTAGE RETENTION
          <select value={retention} onChange={(e) => setRetention(e.target.value)} className="rounded-sm border border-outline bg-surface-container-low px-space-sm py-1">
            <option>30 DAYS</option>
            <option>90 DAYS</option>
            <option>1 YEAR</option>
          </select>
        </label>
        <label className="flex items-center justify-between gap-space-md font-data-mono-md text-on-surface">
          AUTO-DISPATCH ON CRITICAL
          <input type="checkbox" checked={autoDispatch} onChange={(e) => setAutoDispatch(e.target.checked)} />
        </label>
        <label className="flex items-center justify-between gap-space-md font-data-mono-md text-on-surface">
          AI CONFIDENCE THRESHOLD · {threshold}%
          <input type="range" min={50} max={99} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
        </label>
        <button className="font-label-caps self-start bg-secondary px-space-md py-2 text-on-primary rounded-sm">SAVE</button>
      </form>
    </div>
  );
}

export default SettingsPage;
