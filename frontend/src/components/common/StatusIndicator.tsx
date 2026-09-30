interface Props {
  status: 'online' | 'offline' | 'maintenance' | 'active' | 'idle';
  label?: string;
}

const dot: Record<Props['status'], string> = {
  online: 'bg-emerald-500',
  active: 'bg-emerald-500',
  offline: 'bg-error',
  maintenance: 'bg-amber-500',
  idle: 'bg-slate-300',
};

export default function StatusIndicator({ status, label }: Props) {
  const live = status === 'online' || status === 'active';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-low border border-outline-variant px-2 py-0.5 font-data-mono-sm font-medium text-on-surface-variant">
      <span className="relative flex h-2 w-2">
        {live && <span className={`absolute h-full w-full rounded-full ${dot[status]} animate-ping opacity-50`} />}
        <span className={`h-2 w-2 rounded-full ${dot[status]}`} aria-hidden="true" />
      </span>
      {label ?? status.toUpperCase()}
    </span>
  );
}
