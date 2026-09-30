# Civic-Eye

**Real-Time Computer Vision for Public Safety**

A 24-hour hackathon project. Civic-Eye processes simulated CCTV feeds to detect traffic accidents, crowd anomalies, unattended baggage, and multi-camera incidents, then generates severity assessments and emergency response recommendations.

## Project Status

| Step | Description | Status |
|------|-------------|--------|
| 1 | Backend Foundation (FastAPI + SQLAlchemy) | ✅ Complete |
| 2 | AI/CV Pipeline (YOLO + ByteTrack) | ✅ Complete |
| 3 | Behavioral Intelligence Engine | ✅ Complete |
| 4 | Incident Intelligence Engine | ✅ Complete |
| 5 | Multi-Camera Correlation + Real-Time Event Bus | ✅ Complete |
| 6 | Frontend Dashboard (React) | 🔜 Planned |

## Architecture (Step 4)

```
YOLO
 ↓
ByteTrack
 ↓
Behavior Engine
 ↓
Temporal Verification
 ↓
Incident Intelligence
 ↓
False Alarm Suppression
 ↓
Severity
 ↓
Response Recommendation
 ↓
Incident Database
```

## Incident Intelligence (Step 4)

**Incident types:** `ACCIDENT`, `UNATTENDED_BAGGAGE`, `CROWD_ANOMALY` (extensible via `IncidentType`).

**Lifecycle:** `DETECTED → VERIFYING → CONFIRMED → DISPATCHED → RESOLVED`, with `VERIFYING → FALSE_ALARM` as the alternative. Invalid transitions are rejected with HTTP 409.

**Confidence:** deterministic weighted blend of evidence scores + temporal persistence + cross-signal agreement bonus, clamped to [0, 1]. It is a *confidence score*, never a calibrated probability. Speeds are pixel-space (no camera calibration; no km/h claims).

**False-alarm rules** (each suppression carries a reason code, evidence is never silently dropped):
- `single_frame_anomaly` — one evidence item can never confirm
- `low_confidence_no_support` — weak signal with no corroboration
- `proximity_without_corroboration` — vehicle closeness alone is not a collision
- `transient_crowd_spike` — crowd spike lasting < 1 s
- `owner_nearby` — stationary bag with its owner close is not unattended
- `cooldown_duplicate_suppressed` — same tracks re-triggering within cooldown update the existing incident

**Severity:** `LOW / MEDIUM / HIGH / CRITICAL` from confidence, involved tracks, evidence count/persistence, crowd size and ROI (thresholds in `.env`: `SEVERITY_HIGH_THRESHOLD`, `SEVERITY_CRITICAL_THRESHOLD`).

**Response recommendations** are advisory only — the system never claims emergency services were contacted.

**API endpoints** (`/api/v1/incidents`):
- `GET /` — list with `camera_id`, `incident_type`, `severity`, `status` filters + `limit`/`offset` pagination
- `GET /active` — DETECTED / VERIFYING / CONFIRMED / DISPATCHED
- `GET /{id}` — full detail (evidence, reasons, recommendation)
- `GET /{id}/evidence`, `GET /{id}/history`
- `POST /{id}/dispatch`, `POST /{id}/resolve`

**Pipeline outputs** per job (`data/outputs/{job_id}/`): `events.jsonl`, `behavior_events.jsonl`, `incidents.jsonl` (only on incident state changes — no fake incidents), plus the annotated video and SQLite rows (`incidents`, `incident_evidence`, `incident_status_history`).

## Real-Time + Multi-Camera (Step 5)

```
Camera
 ↓
Detection
 ↓
Behavior
 ↓
Incident Intelligence
 ↓
Event Bus
 ├── Database
 ├── Multi-Camera Fusion
 └── WebSocket
        ↓
   Command Center
```

**Event bus** (`app/events/`): in-process, thread-safe `EventBus` with typed envelopes (`event_id, event_type, timestamp, source, camera_id, incident_id, payload, priority, schema_version`), bounded history (`MAX_EVENT_HISTORY=1000`), isolated subscribers. Event types: `INCIDENT_CREATED/UPDATED/CONFIRMED/DISPATCHED/RESOLVED/FALSE_ALARM/MERGED`, `BEHAVIOR_EVENT_CREATED`, `CAMERA_ONLINE/OFFLINE/HEALTH_CHANGED`, `SYSTEM_STATUS_CHANGED`. (Per-detection bus events are deliberately skipped — volume.)

**WebSocket** `WS /api/v1/ws`: hello → optional `{"action":"subscribe","camera_ids":[],"incident_types":[],"severities":[],"event_types":[]}` (empty = all) → live envelopes; `{"action":"ping"}` → `PONG`. Slow clients drop oldest (bounded queue); broken sockets are removed without affecting others; the pipeline never awaits the socket layer.

**Camera topology** (`app/services/camera_topology.py`): logical IDs, no GPS required. Relationships `ADJACENT | OVERLAPPING | SEQUENTIAL` with `estimated_transition_seconds`, persisted in `camera_relationships`. Endpoints: `GET /cameras/topology`, `GET/POST /cameras/{id}/neighbors` (self-links, bad types and duplicates rejected).

**Correlation** (`app/intelligence/multi_camera.py`): `correlation = 0.30·temporal + 0.25·topology + 0.15·type + 0.10·zone + 0.10·classes + 0.10·evidence`, threshold `MULTI_CAMERA_CORRELATION_THRESHOLD=0.70`, window `MULTI_CAMERA_TIME_WINDOW_SECONDS=15`. Above threshold → unified `IncidentGroup` (`GRP-…`) linking both originals (evidence preserved) + `INCIDENT_MERGED` event + chronological `timeline` built from real evidence. Cross-camera correlation is evidence-based candidate association, not guaranteed physical identity tracking.

**Health** (`app/services/camera_health.py`): `ONLINE / DEGRADED / OFFLINE` from frame flow + fps (`CAMERA_OFFLINE_TIMEOUT_SECONDS=10`, `CAMERA_DEGRADED_FPS_THRESHOLD=5`); for video files this reports pipeline/source health. Endpoints: `GET /cameras/health`, `GET /cameras/{id}/health`.

**Dashboard**: `GET /dashboard/snapshot` (active/critical/high counts, camera states, recent incidents, timestamp), `GET /events/recent` (`limit, event_type, camera_id, severity` filters over the bounded bus history).

**Example incident JSON:**
```json
{
    "incident_id": "INC-000001",
    "camera_id": "CAM-02",
    "incident_type": "ACCIDENT",
    "status": "CONFIRMED",
    "severity": "HIGH",
    "confidence": 0.94,
    "first_detected_at": 21.42,
    "last_updated_at": 24.10,
    "track_ids": [17, 19],
    "evidence": [
        {"type": "POSSIBLE_COLLISION", "confidence": 0.91, "timestamp": 21.42},
        {"type": "SUDDEN_STOP", "confidence": 0.88, "timestamp": 21.67}
    ],
    "reasons": ["vehicle trajectory convergence", "rapid deceleration"],
    "recommended_action": "Dispatch traffic response team",
    "metadata": {}
}
```

## Quick Start

```powershell
# Windows
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
cd backend
uvicorn app.main:app --reload
```

See [backend/README.md](backend/README.md) for full setup and API documentation.
