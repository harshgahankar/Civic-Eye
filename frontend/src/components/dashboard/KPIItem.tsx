export interface KPIItemProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'critical' | 'ok';
  icon?: string;
  trend?: string;
}

const toneValue: Record<NonNullable<KPIItemProps['tone']>, string> = {
  default: 'text-on-surface',
  critical: 'text-error',
  ok: 'text-emerald-600',
};

const toneIcon: Record<NonNullable<KPIItemProps['tone']>, string> = {
  default: 'bg-blue-50 text-secondary',
  critical: 'bg-red-50 text-error',
  ok: 'bg-emerald-50 text-emerald-600',
};

export function KPIItem({ label, value, sub, tone = 'default', icon = 'monitoring', trend }: KPIItemProps) {
  return (
    <div className="group rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-card transition-all hover:shadow-pop hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-2">
        <p className="font-label-caps text-on-surface-variant">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneIcon[tone]}`}>
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
      </div>
      <p className={`mt-1 font-headline-md tracking-tight ${toneValue[tone]}`}>{value}</p>
      <div className="mt-1 flex items-center gap-1.5">
        {trend && <span className="font-data-mono-sm font-semibold text-emerald-600">{trend}</span>}
        {sub && <p className="truncate font-data-mono-sm text-on-surface-variant">{sub}</p>}
      </div>
    </div>
  );
}

export default KPIItem;
