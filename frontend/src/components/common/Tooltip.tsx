import type { ReactNode } from 'react';

interface Props {
  tip: string;
  children: ReactNode;
}

export default function Tooltip({ tip, children }: Props) {
  return (
    <span className="group relative inline-flex items-center">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-2 py-1 font-data-mono-sm text-on-primary opacity-0 transition-opacity group-hover:opacity-100">
        {tip}
      </span>
    </span>
  );
}
