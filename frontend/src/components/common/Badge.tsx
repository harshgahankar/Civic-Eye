import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  tone?: 'critical' | 'high' | 'medium' | 'low' | 'neutral' | 'info';
  className?: string;
}

const tones: Record<NonNullable<Props['tone']>, string> = {
  critical: 'bg-error text-on-primary',
  high: 'bg-error-container text-on-surface',
  medium: 'bg-secondary-container text-on-surface',
  low: 'bg-surface-container-high text-on-surface',
  neutral: 'bg-surface-container text-on-surface border border-outline-variant',
  info: 'bg-secondary-fixed text-on-surface',
};

export default function Badge({ children, tone = 'neutral', className = '' }: Props) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-label-caps uppercase ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
