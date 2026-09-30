from app.schemas.camera import CameraCreate, CameraResponse, CameraUpdate
from app.schemas.detection import DetectionSchema
from app.schemas.event import EventCreate, EventResponse
from app.schemas.incident import IncidentCreate, IncidentResponse
from app.schemas.alert import AlertCreate, AlertResponse

__all__ = [
    "CameraCreate",
    "CameraUpdate",
    "CameraResponse",
    "DetectionSchema",
    "EventCreate",
    "EventResponse",
    "IncidentCreate",
    "IncidentResponse",
    "AlertCreate",
    "AlertResponse",
]
