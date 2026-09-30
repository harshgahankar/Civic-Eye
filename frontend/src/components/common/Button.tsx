import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-secondary text-on-secondary hover:bg-blue-700 shadow-card active:scale-[0.98]',
  secondary: 'bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary-container active:scale-[0.98]',
  ghost: 'bg-surface-container-lowest text-on-surface border border-outline-variant hover:border-secondary hover:text-secondary shadow-card active:scale-[0.98]',
  danger: 'bg-error text-on-error hover:bg-red-700 shadow-card active:scale-[0.98]',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[11px]',
  md: 'px-4 py-2 text-[12px]',
  lg: 'px-5 py-2.5 text-[13px]',
};

export default function Button({ variant = 'primary', size = 'md', icon, children, className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-label-caps uppercase tracking-wider transition-all focus-visible:outline-2 disabled:opacity-50 disabled:pointer-events-none ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {icon && <span className="material-symbols-outlined text-[16px] leading-none">{icon}</span>}
      {children}
    </button>
  );
}
