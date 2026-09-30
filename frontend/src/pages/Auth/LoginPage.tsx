import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { AuthBrandMark } from './AuthShell';
import Button from '../../components/common/Button';
import { requestPasswordReset } from '../../services/authService';
import { loadConsoleSettings } from '../../utils/settings';
import { useAuth } from '../../hooks/useAuth';

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-label-caps text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="mt-1 block font-data-mono-sm text-on-surface-variant">{hint}</span>}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-on-surface placeholder:text-on-surface-variant/50 transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, authError, clearError } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setBusy(true);
    try {
      await login({ identifier, password, remember });
      navigate(loadConsoleSettings().landing, { replace: true });
    } catch {
      /* error already in store */
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e: FormEvent) => {
    e.preventDefault();
    setResetMsg(null);
    const res = await requestPasswordReset(identifier);
    setResetMsg(res.message);
  };

  return (
    <AuthShell>
      <div className="card card-pad sm:p-7">
        <div className="flex items-center gap-3 lg:hidden">
          <AuthBrandMark />
          <div>
            <p className="font-headline-md text-on-surface">CIVICEYE</p>
            <p className="font-label-caps text-on-surface-variant">PUBLIC SAFETY INTEL</p>
          </div>
        </div>
        <p className="eyebrow pt-1">OPERATOR SIGN-IN</p>
        <h1 className="section-title pt-1 text-[26px]">Welcome back</h1>
        <p className="pt-1 font-body-md text-on-surface-variant">
          Sign in with your authorized operator credentials.
        </p>

        {authError && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 font-body-sm font-medium text-red-700">
            {authError}
          </p>
        )}

        {!forgot ? (
          <form onSubmit={submit} className="flex flex-col gap-4 pt-5">
            <Field label="EMAIL / USERNAME">
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                placeholder="operator@civiceye.gov"
                className={inputCls}
              />
            </Field>
            <Field label="PASSWORD">
              <span className="relative block">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition"
                >
                  <span className="material-symbols-outlined text-[20px]">{showPw ? 'visibility_off' : 'visibility'}</span>
                </button>
              </span>
            </Field>
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2 font-body-sm text-on-surface-variant">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2563eb]"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgot(true);
                  setResetMsg(null);
                }}
                className="font-label-caps text-secondary hover:text-blue-800 transition"
              >
                FORGOT PASSWORD?
              </button>
            </div>
            <Button type="submit" icon="login" disabled={busy} className="w-full py-3">
              {busy ? 'VERIFYING…' : 'LOGIN TO CONSOLE'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setIdentifier('demo@civiceye.gov');
                setPassword('CivicEye@123');
              }}
              className="rounded-xl border border-dashed border-outline-variant px-3 py-2 font-data-mono-sm text-on-surface-variant hover:border-secondary hover:text-secondary transition"
            >
              FILL DEMO CREDENTIALS
            </button>
          </form>
        ) : (
          <form onSubmit={sendReset} className="flex flex-col gap-4 pt-5">
            <Field label="ACCOUNT EMAIL" hint="We'll send reset instructions to this address.">
              <input
                type="email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoComplete="email"
                placeholder="operator@civiceye.gov"
                className={inputCls}
              />
            </Field>
            {resetMsg && (
              <p role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 font-body-sm text-blue-800">
                {resetMsg}
              </p>
            )}
            <Button type="submit" icon="mail" className="w-full py-3">
              SEND RESET LINK
            </Button>
            <button
              type="button"
              onClick={() => {
                setForgot(false);
                setResetMsg(null);
              }}
              className="font-label-caps text-on-surface-variant hover:text-secondary transition"
            >
              ← BACK TO LOGIN
            </button>
          </form>
        )}

        <p className="border-t border-outline-variant pt-4 mt-5 text-center font-body-sm text-on-surface-variant">
          No operator account?{' '}
          <Link to="/register" className="font-semibold text-secondary hover:text-blue-800 transition">
            Request access
          </Link>
        </p>
      </div>
      <p className="pt-4 text-center font-data-mono-sm text-on-surface-variant">
        PROTECTED CONSOLE · AUTHORIZED OPERATORS ONLY
      </p>
    </AuthShell>
  );
}

export default LoginPage;
