# Civic-Eye Backend

Real-Time Computer Vision for Public Safety — Phase 1: Backend Foundation.

## Architecture

```
civic-eye/
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI route handlers
│   │   ├── core/         # Config + logging
│   │   ├── db/           # SQLAlchemy engine, models
│   │   ├── schemas/      # Pydantic request/response schemas
│   │   ├── ai/           # AI/CV modules (Phase 2)
│   │   ├── pipeline/     # Video ingestion pipeline (Phase 2)
│   │   ├── services/     # Business logic services (Phase 2)
│   │   └── main.py       # FastAPI application entry point
│   ├── tests/
│   ├── requirements.txt
│   ├── .env.example
│   └── pytest.ini
├── data/
│   ├── videos/           # Input CCTV footage
│   ├── models/           # AI model weights
│   └── outputs/          # Detection outputs
└── logs/
```

## Setup

### 1. Create and activate a virtual environment

**Windows:**
```powershell
python -m venv .venv
.venv\Scripts\activate
```

**macOS/Linux:**
```bash
python -m venv .venv
source .venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r backend/requirements.txt
```

### 3. Configure environment (optional)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env as needed
```

The application works without a `.env` file — defaults are used.

## Running the Backend

```bash
cd backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

## API Documentation

| URL | Description |
|-----|-------------|
| http://localhost:8000/docs | Swagger UI (interactive) |
| http://localhost:8000/redoc | ReDoc documentation |
| http://localhost:8000/openapi.json | OpenAPI schema |

## Available Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/health | Liveness probe |
| GET | /api/v1/health/db | Database connectivity probe |
| GET | /api/v1/cameras | List all cameras |
| POST | /api/v1/cameras | Register a new camera |
| GET | /api/v1/cameras/{camera_id} | Get camera by ID |
| DELETE | /api/v1/cameras/{camera_id} | Delete a camera |
| GET | /api/v1/incidents | List incidents |
| GET | /api/v1/analytics/summary | System summary counts |

## Running Tests

```bash
cd backend
pytest
```

Run with verbose output:
```bash
pytest -v
```

## Phase 2 — What's Next

- Integrate YOLOv8 / detection pipeline in `app/ai/`
- Video frame ingestion in `app/pipeline/`
- Incident aggregation logic in `app/services/`
- WebSocket endpoint for real-time event streaming
- Alert dispatch (email / webhook)
- Switch SQLite → PostgreSQL for production
