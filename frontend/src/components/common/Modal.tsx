import type { ReactNode } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl bg-surface-container-lowest p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-headline-md text-on-surface">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-surface-container-high">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="font-body-md text-on-surface">{children}</div>
      </div>
    </div>
  );
}
