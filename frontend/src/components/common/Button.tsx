import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: string;
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-container',
  secondary: 'bg-secondary-container text-on-surface hover:bg-secondary-fixed',
  ghost: 'bg-transparent text-on-surface hover:bg-surface-container-high border border-outline-variant',
  danger: 'bg-error text-on-primary hover:opacity-90',
};

export default function Button({ variant = 'primary', icon, children, className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center gap-2 rounded-md px-4 py-2 font-label-caps uppercase transition-colors disabled:opacity-50 ${variants[variant]} ${className}`}
      {...rest}
    >
      {icon && <span className="material-symbols-outlined text-base leading-none">{icon}</span>}
      {children}
    </button>
  );
}
