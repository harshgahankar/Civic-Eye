export interface KPIItemProps {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'critical' | 'ok';
}

const toneClass: Record<NonNullable<KPIItemProps['tone']>, string> = {
  default: 'text-on-surface',
  critical: 'text-error',
  ok: 'text-emerald-700',
};

export function KPIItem({ label, value, sub, tone = 'default' }: KPIItemProps) {
  return (
    <div className="px-space-md py-space-sm border-l-2 border-secondary-fixed">
      <p className="font-label-caps text-on-surface-variant">{label}</p>
      <p className={`font-headline-md ${toneClass[tone]}`}>{value}</p>
      {sub && <p className="font-data-mono-sm text-on-surface-variant">{sub}</p>}
    </div>
  );
}

export default KPIItem;
