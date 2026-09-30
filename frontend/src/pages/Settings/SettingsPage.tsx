import { useState, type FormEvent } from 'react';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { loadConsoleSettings, saveConsoleSettings, type ConsoleSettings } from '../../utils/settings';

const TABS = [
  { id: 'profile', label: 'Profile', icon: 'person' },
  { id: 'preferences', label: 'Preferences', icon: 'tune' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications_active' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const LANDINGS = [
  { to: '/command-center', label: 'Command Center' },
  { to: '/cameras', label: 'Live Cameras' },
  { to: '/emergency', label: 'Emergency Alerts' },
  { to: '/analytics', label: 'Analytics' },
];

const inputCls =
  'w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 font-body-md text-on-surface placeholder:text-on-surface-variant/50 transition focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary/20';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="font-data-mono-md font-medium text-on-surface">{label}</span>
      <span className="w-full sm:max-w-[280px]">{children}</span>
    </label>
  );
}

/* ------------------------------- Profile ------------------------------ */

function ProfileTab() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const logout = useAuthStore((s) => s.logout);
  const pushToast = useUiStore((s) => s.pushToast);

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [org, setOrg] = useState(user?.organization ?? '');
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  if (!user) return null;
  const initials = user.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const dirty = name.trim() !== user.name || phone.trim() !== user.phone || org.trim() !== user.organization;

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile({ name, phone, organization: org });
      pushToast('Profile updated.', 'success');
    } catch (e2) {
      pushToast(e2 instanceof Error ? e2.message : 'Could not update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (pw.next !== pw.confirm) {
      setPwMsg({ ok: false, text: 'New passwords do not match.' });
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ ok: true, text: 'Password changed successfully.' });
      pushToast('Password changed.', 'success');
    } catch (e2) {
      setPwMsg({ ok: false, text: e2 instanceof Error ? e2.message : 'Could not change password.' });
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="card card-pad">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-secondary to-blue-800 font-headline-md text-white shadow-card">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="section-title text-[20px]">{user.name}</h2>
            <p className="font-body-sm text-on-surface-variant">{user.email}</p>
          </div>
          <Badge tone="info">{user.role}</Badge>
        </div>
        <form onSubmit={saveProfile} className="grid grid-cols-1 gap-4 pt-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">FULL NAME</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">PHONE</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required type="tel" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">EMAIL (SIGN-IN ID)</span>
            <input value={user.email} disabled className={`${inputCls} opacity-60`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">ORGANIZATION</span>
            <input value={org} onChange={(e) => setOrg(e.target.value)} required className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">ROLE (ASSIGNED)</span>
            <input value={user.role} disabled className={`${inputCls} opacity-60`} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">AUTHORIZED ID (VERIFIED)</span>
            <input value={user.authorizedId} disabled className={`${inputCls} font-data-mono-md opacity-60`} />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" icon="save" disabled={!dirty || saving}>
              {saving ? 'SAVING…' : 'SAVE PROFILE'}
            </Button>
          </div>
        </form>
      </section>

      <section className="card card-pad">
        <h2 className="section-title text-[20px]">Change password</h2>
        <form onSubmit={savePassword} className="grid grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">CURRENT</span>
            <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required autoComplete="current-password" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">NEW (8+ CHARS)</span>
            <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required autoComplete="new-password" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block font-label-caps text-on-surface-variant">CONFIRM NEW</span>
            <input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required autoComplete="new-password" className={inputCls} />
          </label>
        </form>
        {pwMsg && (
          <p role={pwMsg.ok ? 'status' : 'alert'} className={`mt-3 rounded-xl border px-3.5 py-2.5 font-body-sm ${pwMsg.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>
            {pwMsg.text}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 pt-4">
          <Button type="button" variant="secondary" disabled={pwBusy} onClick={() => savePassword({ preventDefault: () => undefined } as FormEvent)}>
            {pwBusy ? 'UPDATING…' : 'UPDATE PASSWORD'}
          </Button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 font-label-caps text-error hover:bg-red-50 transition"
          >
            <span className="material-symbols-outlined text-[16px]">logout</span>
            SIGN OUT EVERYWHERE
          </button>
        </div>
      </section>
    </div>
  );
}

/* ----------------------------- Preferences ---------------------------- */

function PreferencesTab() {
  const [s, setS] = useState<ConsoleSettings>(loadConsoleSettings);
  const [base] = useState<ConsoleSettings>(loadConsoleSettings);
  const pushToast = useUiStore((st) => st.pushToast);
  const dirty = JSON.stringify(s) !== JSON.stringify(base);

  const save = () => {
    saveConsoleSettings(s);
    pushToast('Console preferences saved.', 'success');
  };

  return (
    <section className="card card-pad flex flex-col gap-5">
      <Row label="FOOTAGE RETENTION">
        <select value={s.retention} onChange={(e) => setS({ ...s, retention: e.target.value })} className={inputCls}>
          <option>30 DAYS</option>
          <option>90 DAYS</option>
          <option>1 YEAR</option>
        </select>
      </Row>
      <Row label="DEFAULT LANDING SCREEN">
        <select value={s.landing} onChange={(e) => setS({ ...s, landing: e.target.value })} className={inputCls}>
          {LANDINGS.map((l) => (
            <option key={l.to} value={l.to}>{l.label}</option>
          ))}
        </select>
      </Row>
      <Row label="AUTO-DISPATCH ON CRITICAL">
        <input type="checkbox" checked={s.autoDispatch} onChange={(e) => setS({ ...s, autoDispatch: e.target.checked })} className="h-5 w-5 accent-[#2563eb]" aria-label="Auto-dispatch on critical" />
      </Row>
      <div>
        <Row label={`AI CONFIDENCE THRESHOLD · ${s.threshold}%`}>
          <input type="range" min={50} max={99} value={s.threshold} aria-label="AI confidence threshold" onChange={(e) => setS({ ...s, threshold: Number(e.target.value) })} className="w-full accent-[#2563eb]" />
        </Row>
        <p className="pt-1 font-data-mono-sm text-on-surface-variant">Detections below this confidence stay in review instead of paging units.</p>
      </div>
      <div className="flex items-center gap-3 border-t border-outline-variant pt-4">
        <Button icon="save" disabled={!dirty} onClick={save}>SAVE PREFERENCES</Button>
        {!dirty && <span className="font-data-mono-sm text-on-surface-variant">ALL CHANGES SAVED ✓</span>}
      </div>
    </section>
  );
}

/* ----------------------------- Notifications -------------------------- */

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    setTimeout(() => ctx.close(), 300);
  } catch {
    /* audio unavailable */
  }
}

function NotificationsTab() {
  const [s, setS] = useState<ConsoleSettings>(loadConsoleSettings);
  const [perm, setPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'));
  const pushToast = useUiStore((st) => st.pushToast);

  const persist = (next: ConsoleSettings) => {
    setS(next);
    saveConsoleSettings(next);
  };

  const toggleBrowser = async (on: boolean) => {
    if (on && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      const res = await Notification.requestPermission();
      setPerm(res);
      if (res !== 'granted') {
        pushToast('Browser notifications were blocked by the browser.', 'error');
        return;
      }
    }
    persist({ ...s, notifyEnabled: on });
    pushToast(on ? 'Browser notifications enabled.' : 'Browser notifications muted.', 'success');
  };

  const sendTest = () => {
    if (s.notifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('CivicEye — test alert', { body: 'CRITICAL drill · CAM-07 Junction A · conf 94.2%' });
    } else {
      pushToast('Enable browser notifications first.', 'error');
    }
    if (s.soundEnabled) beep();
  };

  return (
    <section className="card card-pad flex flex-col gap-5">
      <Row label="BROWSER ALERTS">
        <span className="flex items-center gap-3">
          <input type="checkbox" checked={s.notifyEnabled} onChange={(e) => toggleBrowser(e.target.checked)} className="h-5 w-5 accent-[#2563eb]" aria-label="Browser alerts" />
          <span className="font-data-mono-sm text-on-surface-variant">
            {perm === 'granted' ? 'PERMISSION GRANTED' : perm === 'denied' ? 'BLOCKED IN BROWSER' : 'NOT REQUESTED'}
          </span>
        </span>
      </Row>
      <Row label="CRITICAL ALERTS ONLY">
        <input type="checkbox" checked={s.criticalOnly} onChange={(e) => persist({ ...s, criticalOnly: e.target.checked })} className="h-5 w-5 accent-[#2563eb]" aria-label="Critical alerts only" />
      </Row>
      <Row label="ALERT SOUND">
        <span className="flex items-center gap-3">
          <input type="checkbox" checked={s.soundEnabled} onChange={(e) => persist({ ...s, soundEnabled: e.target.checked })} className="h-5 w-5 accent-[#2563eb]" aria-label="Alert sound" />
          <button type="button" onClick={beep} className="font-label-caps text-secondary hover:text-blue-800 transition">PLAY TEST TONE</button>
        </span>
      </Row>
      <Row label="DAILY EMAIL DIGEST">
        <input type="checkbox" checked={s.emailDigest} onChange={(e) => persist({ ...s, emailDigest: e.target.checked })} className="h-5 w-5 accent-[#2563eb]" aria-label="Daily email digest" />
      </Row>
      <div className="border-t border-outline-variant pt-4">
        <Button icon="notifications_active" variant="secondary" onClick={sendTest}>SEND TEST ALERT</Button>
      </div>
    </section>
  );
}

/* --------------------------------- Page ------------------------------- */

export function SettingsPage() {
  const [tab, setTab] = useState<TabId>('profile');

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="eyebrow">Console preferences</p>
        <h1 className="font-headline-xl text-on-surface tracking-tight">Settings</h1>
      </header>
      <div className="flex gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-card w-fit" role="tablist" aria-label="Settings sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 font-label-caps transition ${
              tab === t.id ? 'bg-primary-container text-white shadow-card' : 'text-on-surface-variant hover:bg-surface-container-low'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
            {t.label.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'profile' && <ProfileTab />}
      {tab === 'preferences' && <PreferencesTab />}
      {tab === 'notifications' && <NotificationsTab />}
    </div>
  );
}

export default SettingsPage;
