# Civic-Eye

**Real-Time Computer Vision for Public Safety**

A 24-hour hackathon project. Civic-Eye processes simulated CCTV feeds to detect traffic accidents, crowd anomalies, unattended baggage, and multi-camera incidents, then generates severity assessments and emergency response recommendations.

## Project Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Backend Foundation (FastAPI + SQLAlchemy) | ✅ Complete |
| 2 | AI/CV Pipeline (YOLOv8 + Tracker) | 🔜 Next |
| 3 | Frontend Dashboard (React) | 🔜 Planned |

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
