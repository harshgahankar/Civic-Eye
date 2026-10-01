# Civic-Eye Backend

Real-Time Computer Vision for Public Safety — FastAPI + YOLO11 + ByteTrack.

## What it does

```
VideoReader → FrameProcessor (class filter, track-age gating)
  → BehaviorEngine (sudden-stop, rapid-slowdown, trajectory, stationary,
                    collision, crowd)
  → IncidentEngine (temporal verify → assess → suppress → confirm)
  → annotated H.264 video + events/behavior/incidents JSONL + SQLite rows
  → EventBus → WebSocket → dashboard
```

Incident types: `ACCIDENT` (collision + speed collapse/slowdown/jolt-swerve),
`UNATTENDED_BAGGAGE` (stationary bag, owner away), `CROWD_ANOMALY`.
Lifecycle: `DETECTED → VERIFYING → CONFIRMED → DISPATCHED → RESOLVED`
(`VERIFYING → FALSE_ALARM` on expiry / end-of-video). Confidence is a
deterministic [0, 1] score blend — never a calibrated probability.

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt  # run from the repo root
# optional: Copy-Item backend/.env.example backend/.env
```

## Running

```powershell
cd backend
uvicorn app.main:app --reload
```

API at `http://localhost:8000` — docs at `/docs`, health at
`/api/v1/health`. No `.env` needed; defaults live in
`app/core/config.py`.

## Key endpoints (`/api/v1`)

| Method | Path | Description |
|--------|------|-------------|
| POST | /processing/video | Start job from a server-side video path |
| POST | /processing/upload | Upload a video file (≤200 MB) + start a job |
| GET | /processing/{job_id} | Job status (poll while RUNNING) |
| GET | /processing/{job_id}/video | Tracked MP4 preview (H.264, `?download=true` to save) |
| GET | /processing/videos/{filename} | Durable video URL (survives restarts) |
| GET | /processing/{job_id}/incidents | CONFIRMED/DISPATCHED hits for a job |
| GET | /processing/{job_id}/explanation | Verdict + per-candidate evidence (why flagged / why not) |
| POST/GET | /processing/camera/start, /stop, /status, /snapshot, /stream | Live webcam/RTSP |
| GET | /incidents, /incidents/active, /incidents/{id}(/evidence, /history) | Incidents |
| POST | /incidents/{id}/dispatch, /incidents/{id}/resolve | Lifecycle (409 on invalid transition) |
| GET | /dashboard/snapshot, /events/recent | Dashboard data |
| WS | /ws | Live envelopes (`INCIDENT_CONFIRMED`, …) |

## Testing

```powershell
cd backend
pytest            # 280+ tests incl. car3 crash regression
pytest tests/intelligence/test_car3_regression.py -q
```

`test_car3_regression.py` locks the real-car3 evidence shape (repeated
collision + kinematic jolt + trajectory swerve over ~3 s must CONFIRM;
overlap + swerve with no jolt must still reject).

## Notes

- Outputs go to `data/videos/outputs/` (gitignored); uploads land in
  `data/videos/uploads/` (gitignored, 200 MB cap, `.mp4/.avi/.mov/.mkv`).
- OpenCV writes `mp4v`, which browsers can't play — the pipeline
  transcodes to H.264 via `imageio-ffmpeg` (see `requirements.txt`).
- In-memory job registry: job status is lost on restart, but
  `/processing/videos/{filename}` URLs and SQLite incidents survive.
