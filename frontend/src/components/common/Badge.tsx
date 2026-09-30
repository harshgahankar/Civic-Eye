import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'neutral' | 'info' | 'success';
  className?: string;
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  low: 'bg-slate-100 text-slate-600 border-slate-200',
  neutral: 'bg-surface-container-low text-on-surface-variant border-outline-variant',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const dots: Record<NonNullable<Props['tone']>, string> = {
  critical: 'bg-error',
  high: 'bg-orange-500',
  medium: 'bg-secondary',
  low: 'bg-slate-400',
  neutral: 'bg-slate-400',
  info: 'bg-secondary',
  success: 'bg-emerald-500',
};

export default function Badge({ children, tone = 'neutral', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-label-caps uppercase ${tones[tone]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dots[tone]}`} />
      {children}
    </span>
  );
}
