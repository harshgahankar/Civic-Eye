interface Props {
  status: 'online' | 'offline' | 'maintenance' | 'active' | 'idle';
  label?: string;
}

const dot: Record<Props['status'], string> = {
  online: 'bg-green-600',
  active: 'bg-green-600',
  offline: 'bg-error',
  maintenance: 'bg-amber-500',
  idle: 'bg-outline-variant',
};

export default function StatusIndicator({ status, label }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5 font-data-mono-sm text-on-surface">
      <span className={`h-2 w-2 rounded-full ${dot[status]}`} aria-hidden="true" />
      {label ?? status.toUpperCase()}
    </span>
  );
}
