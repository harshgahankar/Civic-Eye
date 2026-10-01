import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { backend, type BackendIncidentSummary, type BackendJob, type JobExplanation } from '../../services/backend';
import { useUiStore } from '../../store/uiStore';

export interface UploadModalProps {
  open: boolean;
  onClose?: () => void;
}

/**
 * Upload → processing → preview + download + explanation.
 *
 * Two ways to start a job:
 * - Pick a file: bytes are POSTed to /processing/upload (no server path
 *   needed — the judge-friendly path) and the job starts immediately.
 * - Server path (advanced fallback): the file already sits where the
 *   backend can read it; the modal starts the job by path and polls it.
 * Preview/download stream the finished job's H.264 output; the verdict
 * panel explains why the video flagged (or why not).
 */
export function UploadModal({ open, onClose }: UploadModalProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [serverPath, setServerPath] = useState('../data/videos/sample/');
  const [cameraId, setCameraId] = useState('CAM-UPLOAD');
  const [job, setJob] = useState<BackendJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [accidents, setAccidents] = useState<BackendIncidentSummary[]>([]);
  const [explanation, setExplanation] = useState<JobExplanation | null>(null);
  const alertedFor = useRef<string | null>(null);

  const typeLabel = (t: string) =>
    t === 'ACCIDENT' ? 'ACCIDENT'
    : t === 'UNATTENDED_BAGGAGE' ? 'UNATTENDED BAG'
    : t === 'CROWD_ANOMALY' ? 'CROWD ANOMALY'
    : t.replace(/_/g, ' ');

  /** Short human labels for evidence signal chips (raw enum names wrap badly). */
  const signalLabel = (t: string) =>
    t === 'POSSIBLE_COLLISION' ? 'Collision'
    : t === 'TRAJECTORY_ANOMALY' ? 'Trajectory'
    : t === 'RAPID_SLOWDOWN' ? 'Slowdown'
    : t === 'SUDDEN_STOP' ? 'Sudden stop'
    : t === 'STATIONARY_OBJECT' ? 'Stationary'
    : t === 'CROWD_MOVEMENT_ANOMALY' ? 'Crowd'
    : t.toLowerCase().replace(/_/g, ' ');

  const statusChipClass = (s: string) =>
    s === 'CONFIRMED' || s === 'DISPATCHED'
      ? 'bg-error/15 text-error'
      : s === 'FALSE_ALARM'
        ? 'border border-outline-variant text-on-surface-variant'
        : 'bg-amber-500/15 text-amber-700';

  const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Job polling while running.
  useEffect(() => {
    if (!open || !job || job.status === 'COMPLETED' || job.status === 'FAILED') return;
    const timer = setInterval(() => {
      backend.job(job.job_id)
        .then((j) => setJob(j))
        .catch(() => {});
    }, 2000);
    return () => clearInterval(timer);
  }, [open, job?.job_id, job?.status]);

  // Incident alert + verdict: when a job completes, fetch confirmed hits
  // for flagging plus the full explanation (including rejected candidates)
  // so clean videos show "why not flagged" instead of silence.
  useEffect(() => {
    if (!open || !job || job.status !== 'COMPLETED' || alertedFor.current === job.job_id) return;
    alertedFor.current = job.job_id;
    backend.jobExplanation(job.job_id).then(setExplanation).catch(() => {});
    backend.jobIncidents(job.job_id)
      .then((rows) => {
        const hits = rows.filter((r) => r.status === 'CONFIRMED' || r.status === 'DISPATCHED');
        setAccidents(hits);
        if (hits.length > 0) {
          const kinds = [...new Set(hits.map((h) => typeLabel(h.incident_type)))].join(' · ');
          const critical = hits.some((h) => h.severity?.toLowerCase() === 'critical');
          pushToast(
            `${critical ? 'CRITICAL INCIDENT' : 'INCIDENT'} CONFIRMED in ${job.job_id} — ${hits.length} (${kinds}, ${job.camera_id}). Video flagged in Emergency.`,
            'error',
          );
        }
      })
      .catch(() => {});
  }, [open, job, pushToast]);

  if (!open) return null;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    setFileObj(f);
    setFileName(f.name);
    setFileSize(`${(f.size / 1048576).toFixed(1)} MB`);
    setServerPath((p) => (p.endsWith('/') || p === '' ? `${p}${f.name}` : p));
    setJob(null);
    setVideoError('');
    setRetryCount(0);
    setAccidents([]);
    setExplanation(null);
  };

  const startJob = async () => {
    setStarting(true);
    setVideoError('');
    setRetryCount(0);
    setAccidents([]);
    setExplanation(null);
    // Never let the button stick on STARTING…: any step hanging >20s
    // surfaces as an error toast instead of silence.
    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} timed out — is the backend still running? Check its terminal.`)), ms),
        ),
      ]);
    try {
      // Preferred: upload the picked bytes (no server path needed).
      // Fallback: start by server-side path when no file was picked.
      const started = fileObj
        ? await backend.uploadFile(fileObj, cameraId.trim() || 'CAM-UPLOAD')
        : await (async () => {
            if (!serverPath.trim()) {
              pushToast('Pick a file or enter the server-side video path.', 'error');
              throw new Error('no-source');
            }
            return withTimeout(
              backend.startJob(serverPath.trim(), cameraId.trim() || 'CAM-UPLOAD'),
              20_000,
              'Start-processing request',
            );
          })();
      const first = await withTimeout(backend.job(started.job_id), 20_000, 'Job-status request');
      setJob(first);
      pushToast(`Job ${started.job_id} started.`, 'success');
    } catch (e) {
      if (e instanceof Error && e.message === 'no-source') {
        /* toast already shown */
      } else if (e instanceof Error) {
        pushToast(e.message, 'error');
      } else {
        pushToast('Could not start job — is the backend running?', 'error');
      }
    } finally {
      setStarting(false);
    }
  };

  const done = job?.status === 'COMPLETED';
  const failed = job?.status === 'FAILED';
  // Durable /videos/{filename} URL when the job reports an output_path
  // (survives backend restarts); falls back to the volatile job URL.
  const basePreviewUrl = done && job ? backend.bestJobVideoUrl(job) : null;
  const previewUrl = basePreviewUrl
    ? `${basePreviewUrl}${basePreviewUrl.includes('?') ? '&' : '?'}retry=${retryCount}`
    : null;
  const downloadUrl = done && job ? backend.bestJobDownloadUrl(job) : null;
  const confirmedIds = [...new Set(accidents.map((a) => a.incident_id))];
  const confirmedCount = confirmedIds.length;
  const confirmedKinds = [...new Set(accidents.map((a) => typeLabel(a.incident_type)))].join(' · ');
  const topSeverity = accidents
    .map((a) => String(a.severity ?? 'low'))
    .sort((x, y) => (SEVERITY_RANK[y.toLowerCase()] ?? 0) - (SEVERITY_RANK[x.toLowerCase()] ?? 0))[0] ?? 'low';

  const handleVideoError = async () => {
    // Ask the backend why the stream failed so the message is actionable
    // (409 = still transcoding → auto-retry; 404 = file gone/restarted).
    if (basePreviewUrl) {
      try {
        const res = await fetch(basePreviewUrl, { method: 'HEAD' });
        if (res.status === 409 && retryCount < 3) {
          const wait = (retryCount + 1) * 3000;
          setVideoError(`Finishing video export… retrying in ${wait / 1000}s (attempt ${retryCount + 1}/3).`);
          setTimeout(() => {
            setVideoError('');
            setRetryCount((n) => n + 1);
          }, wait);
          return;
        }
        if (res.status === 404) {
          setVideoError('Output file not found on the server (backend may have restarted). Re-run processing, then use DOWNLOAD.');
          return;
        }
      } catch {
        /* offline backend — fall through to generic message */
      }
    }
    if (retryCount < 2) {
      setRetryCount((n) => n + 1);
      return;
    }
    setVideoError('Preview failed to load — this browser cannot play the file yet. Try DOWNLOAD below, or press RETRY. If it persists, the output may still be transcoding to H.264.');
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary/60 backdrop-blur-sm p-4 anim-fade-up" onClick={onClose} role="dialog" aria-modal="true" aria-label="Upload video">
      <div
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-pop anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <h2 className="font-label-caps text-on-surface">UPLOAD VIDEO</h2>

        <div className="pt-4">
            <label className="block rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-5 text-center transition hover:border-secondary">
              <span className="material-symbols-outlined text-[28px] text-secondary">upload</span>
              <span className="block pt-1 font-body-md font-medium text-on-surface">
                {fileName || 'Choose a video file'}
              </span>
              <span className="block font-data-mono-sm text-on-surface-variant">
                {fileSize || 'mp4 / avi / mov — uploads straight to the backend'}
              </span>
              <input
                type="file"
                accept="video/*,.avi"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
            <p className="pt-2 font-data-mono-sm text-on-surface-variant">
              {fileObj
                ? 'Ready to upload — or clear the file to use a server path instead.'
                : 'No file picked — paste a server path instead (advanced, relative to backend/):'}
            </p>
            <input
              value={serverPath}
              onChange={(e) => { setServerPath(e.target.value); setFileObj(null); setJob(null); setVideoError(''); setRetryCount(0); setAccidents([]); setExplanation(null); }}
              spellCheck={false}
              className="mt-1.5 w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 font-data-mono-md text-on-surface focus:border-secondary focus:outline-none"
            />
            <label className="block pt-3">
              <span className="mb-1.5 block font-label-caps text-on-surface-variant">CAMERA ID</span>
              <input
                value={cameraId}
                onChange={(e) => setCameraId(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2.5 font-data-mono-md text-on-surface focus:border-secondary focus:outline-none"
              />
            </label>
            <button
              type="button"
              onClick={startJob}
              disabled={starting}
              className="mt-4 w-full rounded-lg bg-secondary px-4 py-2.5 font-label-caps text-on-primary hover:bg-blue-700 active:scale-[0.98] transition disabled:opacity-50"
            >
              {starting ? 'STARTING…' : job ? 'RESTART PROCESSING' : 'START PROCESSING'}
            </button>

            {job && (
              <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container-low p-3">
                <p className="font-data-mono-md text-on-surface">
                  {job.job_id} · <span className="font-semibold">{job.status}</span>
                </p>
                <p className="pt-1 font-data-mono-sm text-on-surface-variant">
                  {job.frames_processed} frames · {job.detections_count} detections ·{' '}
                  {job.behavior_events_count} behavior events · {job.confirmed_incidents_count} confirmed
                </p>
                {job.status === 'RUNNING' || job.status === 'QUEUED' ? (
                  <p className="pt-1 font-data-mono-sm text-secondary">Processing… {job.average_fps.toFixed(1)} fps</p>
                ) : null}
                {failed && (
                  <p className="pt-1 font-data-mono-sm text-error">{job.error ?? 'Job failed.'}</p>
                )}
                {done && previewUrl && downloadUrl && job && (
                  <>
                    {accidents.length > 0 && (
                      <div role="alert" className="mt-2 rounded-xl border border-error bg-error/10 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="material-symbols-outlined text-[20px] text-error">warning</span>
                          <p className="font-body-sm font-bold text-on-surface">
                            {confirmedCount} INCIDENT{confirmedCount === 1 ? '' : 'S'} CONFIRMED — {confirmedKinds}
                          </p>
                          <span className="ml-auto rounded-md bg-error px-1.5 py-0.5 font-label-caps text-on-error">
                            {topSeverity.toUpperCase()}
                          </span>
                        </div>
                        <p className="pt-1 font-data-mono-sm text-on-surface-variant">
                          {confirmedIds.join(' · ')}
                        </p>
                        <p className="pt-0.5 font-body-sm text-on-surface-variant">
                          Flagged in Emergency — open the dossier below or dispatch from the Emergency queue.
                        </p>
                      </div>
                    )}
                    {explanation && (
                      <div className="mt-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2">
                        <p className="font-label-caps text-on-surface-variant">WHY THIS VERDICT</p>
                        <p className="pt-1 font-body-sm text-on-surface">{explanation.verdict}</p>
                        <ul className="mt-1.5 flex flex-col gap-1.5">
                          {explanation.candidates.slice(0, 2).map((c) => (
                            <li key={c.incident_id} className="rounded-lg bg-surface-container-low px-2.5 py-2">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-data-mono-sm font-bold text-on-surface">{c.incident_id}</span>
                                <span className="rounded-md bg-secondary/15 px-1.5 py-0.5 font-label-caps text-secondary">
                                  {typeLabel(c.incident_type)}
                                </span>
                                <span className={`rounded-md px-1.5 py-0.5 font-label-caps ${statusChipClass(c.status)}`}>
                                  {c.status.replace(/_/g, ' ')}
                                </span>
                                <span className="ml-auto font-data-mono-sm font-bold text-on-surface">
                                  {Math.round((c.confidence ?? 0) * 100)}%
                                </span>
                              </div>
                              {Object.keys(c.signal_counts).length > 0 && (
                                <div className="flex flex-wrap gap-1 pt-1.5">
                                  {Object.entries(c.signal_counts).map(([sig, n]) => (
                                    <span key={sig} className="rounded-md border border-outline-variant px-1.5 py-0.5 font-data-mono-sm text-on-surface-variant">
                                      {signalLabel(sig)} ×{n}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="pt-1 font-data-mono-sm text-on-surface-variant">
                                {c.span_seconds}s span · peak IoU {c.peak_overlap} · jolt {c.peak_jolt}
                              </p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="relative mt-2 overflow-hidden rounded-xl bg-primary">
                      {accidents.length > 0 && (
                        <span className="absolute left-2 top-2 z-10 rounded-md bg-error px-1.5 py-0.5 font-data-mono-sm text-on-error">
                          INCIDENT FLAGGED · {job.job_id}
                        </span>
                      )}
                      {!videoError ? (
                        <video
                          key={`${job.job_id}-${retryCount}`}
                          src={previewUrl}
                          className="aspect-video h-full w-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls
                          preload="metadata"
                          onError={handleVideoError}
                        />
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <p className="font-body-sm text-error">{videoError}</p>
                          <button
                            type="button"
                            onClick={() => { setVideoError(''); setRetryCount((n) => n + 1); }}
                            className="mt-3 rounded-lg border border-outline-variant px-4 py-1.5 font-label-caps text-on-surface hover:border-secondary hover:text-secondary transition"
                          >
                            RETRY PREVIEW
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                    <a
                      href={downloadUrl}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-label-caps text-white hover:bg-emerald-700 transition"
                    >
                      <span className="material-symbols-outlined text-[16px]">file_download</span>
                      DOWNLOAD TRACKED VIDEO
                    </a>
                    {accidents.length > 0 && (
                      <Link
                        to="/emergency"
                        onClick={() => onClose?.()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-error px-4 py-2 font-label-caps text-on-error hover:bg-red-700 transition"
                      >
                        <span className="material-symbols-outlined text-[16px]">emergency</span>
                        VIEW IN EMERGENCY
                      </Link>
                    )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
        <div className="border-t border-outline-variant bg-surface-container-lowest px-5 py-3">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg border border-outline-variant px-4 py-2 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition"
        >
          CLOSE
        </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default UploadModal;
