import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { backend, type BackendIncidentSummary, type BackendJob } from '../../services/backend';
import { useUiStore } from '../../store/uiStore';

export interface UploadModalProps {
  open: boolean;
  onClose?: () => void;
}

/**
 * Upload → processing → preview + download.
 *
 * Honest boundaries (backend has no file-upload endpoint):
 * - Upload: the video file must already sit where the backend can read it
 *   (drop it into backend/data/videos/sample, or any server-side path);
 *   the modal starts the job by path and polls it live.
 * - Preview/download: streamed from the finished job via
 *   GET /api/v1/processing/{job_id}/video (backend transcodes outputs to
 *   browser-playable H.264).
 */
export function UploadModal({ open, onClose }: UploadModalProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [serverPath, setServerPath] = useState('../data/videos/sample/');
  const [cameraId, setCameraId] = useState('CAM-UPLOAD');
  const [job, setJob] = useState<BackendJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [accidents, setAccidents] = useState<BackendIncidentSummary[]>([]);
  const alertedFor = useRef<string | null>(null);

  const typeLabel = (t: string) =>
    t === 'ACCIDENT' ? 'ACCIDENT'
    : t === 'UNATTENDED_BAGGAGE' ? 'UNATTENDED BAG'
    : t === 'CROWD_ANOMALY' ? 'CROWD ANOMALY'
    : t.replace(/_/g, ' ');

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

  // Incident alert: when a job completes, check its incidents once. Any
  // accident, unattended bag, or crowd anomaly raises an alert toast and
  // flags the video for Emergency.
  useEffect(() => {
    if (!open || !job || job.status !== 'COMPLETED' || alertedFor.current === job.job_id) return;
    alertedFor.current = job.job_id;
    backend.jobIncidents(job.job_id)
      .then((rows) => {
        const hits = rows.filter((r) => r.status !== 'FALSE_ALARM');
        setAccidents(hits);
        if (hits.length > 0) {
          const kinds = [...new Set(hits.map((h) => typeLabel(h.incident_type)))].join(' · ');
          const critical = hits.some((h) => h.severity?.toLowerCase() === 'critical');
          pushToast(
            `${critical ? 'CRITICAL INCIDENT' : 'INCIDENT'} DETECTED in ${job.job_id} — ${hits.length} flagged (${kinds}, ${job.camera_id}). Video flagged in Emergency.`,
            'error',
          );
        }
      })
      .catch(() => {});
  }, [open, job, pushToast]);

  if (!open) return null;

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    setFileName(f.name);
    setFileSize(`${(f.size / 1048576).toFixed(1)} MB`);
    setServerPath((p) => (p.endsWith('/') || p === '' ? `${p}${f.name}` : p));
    setJob(null);
    setVideoError('');
    setAccidents([]);
  };

  const startJob = async () => {
    if (!serverPath.trim()) {
      pushToast('Enter the server-side video path first.', 'error');
      return;
    }
    setStarting(true);
    setVideoError('');
    setAccidents([]);
    try {
      const started = await backend.startJob(serverPath.trim(), cameraId.trim() || 'CAM-UPLOAD');
      const first = await backend.job(started.job_id);
      setJob(first);
      pushToast(`Job ${started.job_id} started.`, 'success');
    } catch {
      pushToast('Could not start job — is the backend running and the path valid?', 'error');
    } finally {
      setStarting(false);
    }
  };

  const done = job?.status === 'COMPLETED';
  const failed = job?.status === 'FAILED';
  const previewUrl = done && job ? backend.jobVideoUrl(job.job_id) : null;
  const downloadUrl = done && job ? backend.jobDownloadUrl(job.job_id) : null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-primary/60 backdrop-blur-sm p-4 anim-fade-up" onClick={onClose} role="dialog" aria-modal="true" aria-label="Upload video">
      <div
        className="w-full max-w-[520px] rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 shadow-pop anim-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-label-caps text-on-surface">UPLOAD VIDEO</h2>

        <div className="pt-4">
            <label className="block rounded-xl border border-dashed border-outline-variant bg-surface-container-low px-4 py-5 text-center transition hover:border-secondary">
              <span className="material-symbols-outlined text-[28px] text-secondary">upload</span>
              <span className="block pt-1 font-body-md font-medium text-on-surface">
                {fileName || 'Choose a video file'}
              </span>
              <span className="block font-data-mono-sm text-on-surface-variant">
                {fileSize || 'mp4 / avi — must already exist on the server (see below)'}
              </span>
              <input
                type="file"
                accept="video/*,.avi"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </label>
            <p className="pt-2 font-data-mono-sm text-on-surface-variant">
              Server path (relative to <span className="font-semibold">backend/</span>) — or copy the file into{' '}
              <span className="font-semibold">data/videos/sample/</span> first:
            </p>
            <input
              value={serverPath}
              onChange={(e) => { setServerPath(e.target.value); setJob(null); setVideoError(''); setAccidents([]); }}
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
              <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container-low p-4">
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
                      <div role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-error bg-error/10 px-3 py-2.5">
                        <span className="material-symbols-outlined text-[20px] text-error">warning</span>
                        <p className="font-body-sm font-medium text-on-surface">
                          INCIDENT DETECTED — {[...new Set(accidents.map((a) => typeLabel(a.incident_type)))].join(' · ')} · {accidents.length} flagged ({accidents.map((a) => a.incident_id).join(', ')}).
                          This video is flagged and listed in Emergency.
                        </p>
                      </div>
                    )}
                    <div className="relative mt-3 overflow-hidden rounded-xl bg-primary">
                      {accidents.length > 0 && (
                        <span className="absolute left-2 top-2 z-10 rounded-md bg-error px-1.5 py-0.5 font-data-mono-sm text-on-error">
                          INCIDENT FLAGGED · {job.job_id}
                        </span>
                      )}
                      {!videoError ? (
                        <video
                          key={job.job_id}
                          src={previewUrl}
                          className="aspect-video h-full w-full object-cover"
                          autoPlay
                          loop
                          muted
                          playsInline
                          controls
                          preload="metadata"
                          onError={() => setVideoError('Preview failed to load — the output file may be missing or still being written. Try DOWNLOAD below.')}
                        />
                      ) : (
                        <p className="px-4 py-6 text-center font-body-sm text-error">{videoError}</p>
                      )}
                    </div>
                    <a
                      href={downloadUrl}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-label-caps text-white hover:bg-emerald-700 transition"
                    >
                      <span className="material-symbols-outlined text-[16px]">file_download</span>
                      DOWNLOAD TRACKED VIDEO
                    </a>
                    {accidents.length > 0 && (
                      <Link
                        to="/emergency"
                        onClick={() => onClose?.()}
                        className="mt-3 ml-2 inline-flex items-center gap-1.5 rounded-lg bg-error px-4 py-2 font-label-caps text-on-error hover:bg-red-700 transition"
                      >
                        <span className="material-symbols-outlined text-[16px]">emergency</span>
                        VIEW IN EMERGENCY
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg border border-outline-variant px-4 py-2 font-label-caps text-on-surface-variant hover:border-on-surface-variant transition"
        >
          CLOSE
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default UploadModal;
