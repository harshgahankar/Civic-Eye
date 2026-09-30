import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell, { AuthBrandMark } from './AuthShell';
import Button from '../../components/common/Button';
import { AUTHORIZED_ID_HINT, verifyAuthorizedId } from '../../services/authService';
import { loadConsoleSettings } from '../../utils/settings';
import { useAuth } from '../../hooks/useAuth';

const ROLES = ['Watch Commander', 'Field Officer', 'Dispatcher', 'Analyst', 'Administrator'];

function Field({
  label,
  children,
  hint,
  error,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-label-caps text-on-surface-variant">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block font-data-mono-sm font-medium text-error">{error}</span>
      ) : (
        hint && <span className="mt-1 block font-data-mono-sm text-on-surface-variant">{hint}</span>
      )}
    </label>
  );
}

const inputCls =
  'w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-on-surface placeholder:text-on-surface-variant/50 transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20';

type IdState = 'idle' | 'checking' | 'valid' | 'invalid';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, authError, clearError } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    role: ROLES[0],
    password: '',
    confirm: '',
    authorizedId: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [idState, setIdState] = useState<IdState>('idle');
  const [idMsg, setIdMsg] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: '' }));
  };

  const checkId = async () => {
    if (!form.authorizedId.trim()) {
      setIdState('idle');
      setIdMsg('');
      return;
    }
    setIdState('checking');
    const res = await verifyAuthorizedId(form.authorizedId);
    setIdState(res.ok ? 'valid' : 'invalid');
    setIdMsg(res.message);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const er: Record<string, string> = {};
    if (form.name.trim().length < 2) er.name = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) er.email = 'Enter a valid email address.';
    if (form.phone.replace(/\D/g, '').length < 7) er.phone = 'Enter a valid phone number.';
    if (form.organization.trim().length < 2) er.organization = 'Enter your organization.';
    if (form.password.length < 8) er.password = 'Password must be at least 8 characters.';
    if (form.confirm !== form.password) er.confirm = 'Passwords do not match.';
    if (!form.authorizedId.trim()) er.authorizedId = 'Authorized ID is mandatory.';
    else if (idState !== 'valid') {
      const res = await verifyAuthorizedId(form.authorizedId);
      setIdState(res.ok ? 'valid' : 'invalid');
      setIdMsg(res.message);
      if (!res.ok) er.authorizedId = res.message;
    }
    setErrors(er);
    if (Object.keys(er).length > 0) return;
    setBusy(true);
    try {
      const { confirm: _c, ...payload } = form;
      await register(payload);
      navigate(loadConsoleSettings().landing, { replace: true });
    } catch {
      /* error already in store */
    } finally {
      setBusy(false);
    }
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
        <p className="eyebrow pt-1">OPERATOR REGISTRATION</p>
        <h1 className="section-title pt-1 text-[26px]">Request access</h1>
        <p className="pt-1 font-body-md text-on-surface-variant">
          Verified operators only. Your Authorized ID is checked before activation.
        </p>

        {authError && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 font-body-sm font-medium text-red-700">
            {authError}
          </p>
        )}

        <form onSubmit={submit} className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2" noValidate>
          <Field label="FULL NAME" error={errors.name}>
            <input value={form.name} onChange={set('name')} required autoComplete="name" placeholder="Aarav Sharma" className={inputCls} />
          </Field>
          <Field label="EMAIL" error={errors.email}>
            <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="operator@civiceye.gov" className={inputCls} />
          </Field>
          <Field label="PHONE" error={errors.phone}>
            <input type="tel" value={form.phone} onChange={set('phone')} required autoComplete="tel" placeholder="+91-98200-12345" className={inputCls} />
          </Field>
          <Field label="ORGANIZATION" error={errors.organization}>
            <input value={form.organization} onChange={set('organization')} required autoComplete="organization" placeholder="Metro Command" className={inputCls} />
          </Field>
          <Field label="ROLE">
            <select value={form.role} onChange={set('role')} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field
            label="AUTHORIZED ID *"
            hint={AUTHORIZED_ID_HINT}
            error={errors.authorizedId}
          >
            <span className="relative block">
              <input
                value={form.authorizedId}
                onChange={set('authorizedId')}
                onBlur={checkId}
                required
                autoComplete="off"
                spellCheck={false}
                placeholder="CIVIC-XXXXXX"
                className={`${inputCls} pr-11 font-data-mono-md uppercase placeholder:normal-case`}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5" aria-live="polite">
                {idState === 'checking' && <span className="material-symbols-outlined text-[20px] text-on-surface-variant animate-spin">progress_activity</span>}
                {idState === 'valid' && <span className="material-symbols-outlined text-[20px] text-emerald-600">verified</span>}
                {idState === 'invalid' && <span className="material-symbols-outlined text-[20px] text-error">error</span>}
              </span>
            </span>
            {idState !== 'idle' && !errors.authorizedId && (
              <span className={`mt-1 block font-data-mono-sm font-medium ${idState === 'valid' ? 'text-emerald-600' : idState === 'invalid' ? 'text-error' : 'text-on-surface-variant'}`}>
                {idState === 'checking' ? 'Verifying ID…' : idMsg}
              </span>
            )}
          </Field>
          <Field label="PASSWORD" error={errors.password}>
            <span className="relative block">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                required
                autoComplete="new-password"
                placeholder="Min. 8 characters"
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
          <Field label="CONFIRM PASSWORD" error={errors.confirm}>
            <input
              type={showPw ? 'text' : 'password'}
              value={form.confirm}
              onChange={set('confirm')}
              required
              autoComplete="new-password"
              placeholder="Repeat password"
              className={inputCls}
            />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" icon="how_to_reg" disabled={busy} className="w-full py-3">
              {busy ? 'VERIFYING & CREATING…' : 'REGISTER & ENTER CONSOLE'}
            </Button>
          </div>
        </form>

        <p className="border-t border-outline-variant pt-4 mt-5 text-center font-body-sm text-on-surface-variant">
          Already verified?{' '}
          <Link to="/login" className="font-semibold text-secondary hover:text-blue-800 transition">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

export default RegisterPage;
