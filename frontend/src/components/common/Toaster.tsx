import { useEffect } from 'react';
import { useUiStore, type Toast } from '../../store/uiStore';

const tones: Record<Toast['tone'], { bar: string; icon: string }> = {
  info: { bar: 'bg-secondary', icon: 'info' },
  success: { bar: 'bg-emerald-500', icon: 'check_circle' },
  error: { bar: 'bg-error', icon: 'error' },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUiStore((s) => s.dismissToast);
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), 3600);
    return () => clearTimeout(id);
  }, [dismiss, toast.id]);

  return (
    <div role="status" className="pointer-events-auto flex w-[min(360px,calc(100vw-2rem))] items-start gap-2.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-pop anim-scale-in">
      <span className={`mt-0.5 h-8 w-1 shrink-0 rounded-full ${tones[toast.tone].bar}`} />
      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">{tones[toast.tone].icon}</span>
      <p className="min-w-0 flex-1 pt-0.5 font-body-sm font-medium text-on-surface">{toast.message}</p>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss notification"
        className="rounded-lg p-1 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition"
      >
        <span className="material-symbols-outlined text-[18px]">close</span>
      </button>
    </div>
  );
}

export default function Toaster() {
  const toasts = useUiStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
