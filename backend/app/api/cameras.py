"""
Camera CRUD endpoints + Step-5 topology and health.

NOTE: static routes (/topology, /health) are registered before
/{camera_id} so FastAPI matches them first.
"""

from __future__ import annotations

import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Camera
from app.schemas.camera import CameraCreate, CameraResponse
from app.services.camera_health import get_health_service

router = APIRouter(prefix="/cameras", tags=["cameras"])


# ── Step-5 schemas ────────────────────────────────────────────────────────────

class NeighborRequest(BaseModel):
    target_camera_id: str = Field(..., min_length=1, max_length=64)
    relationship_type: str = Field("ADJACENT")
    estimated_transition_seconds: Optional[float] = Field(None, ge=0)
    distance: Optional[float] = Field(None, ge=0)
    confidence: Optional[float] = Field(None, ge=0.0, le=1.0)


class NeighborResponse(BaseModel):
    id: int
    source_camera_id: str
    target_camera_id: str
    relationship_type: str
    estimated_transition_seconds: Optional[float]
    distance: Optional[float]
    confidence: Optional[float]

    model_config = {"from_attributes": True}


# ── Step-5 static routes (before /{camera_id}) ────────────────────────────────

@router.get("/topology", summary="Full camera topology graph")
def camera_topology(db: Session = Depends(get_db)) -> dict:
    from app.services.camera_topology import get_topology
    nodes = get_topology(db)
    return {"cameras": {
        cam_id: {
            "camera_id": node.camera_id,
            "location_name": node.location_name,
            "zone": node.zone,
            "neighbors": node.neighbors,
            "estimated_transition_seconds":
                node.estimated_transition_seconds,
        } for cam_id, node in nodes.items()}}


@router.get("/health", summary="Health of all known cameras/sources")
def cameras_health() -> dict:
    service = get_health_service()
    states = service.evaluate_all()
    return {"cameras": [{
        "camera_id": h.camera_id, "status": h.status,
        "last_seen_at": h.last_seen_at, "fps": h.fps,
        "frames_processed": h.frames_processed, "errors": h.errors,
    } for h in states]}


# ── CRUD ──────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[CameraResponse], summary="List cameras")
def list_cameras(db: Session = Depends(get_db)) -> List[Camera]:
    return db.query(Camera).order_by(Camera.created_at.desc()).all()


@router.get(
    "/{camera_id}",
    response_model=CameraResponse,
    summary="Get camera by camera_id",
)
def get_camera(camera_id: str, db: Session = Depends(get_db)) -> Camera:
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "CAMERA_NOT_FOUND",
                "message": f"Camera {camera_id} was not found",
            },
        )
    return camera


@router.post(
    "",
    response_model=CameraResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new camera",
)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)) -> Camera:
    camera = Camera(
        camera_id=str(uuid.uuid4()),
        name=payload.name,
        location=payload.location,
        stream_url=payload.stream_url,
        status=payload.status,
    )
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@router.delete(
    "/{camera_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a camera",
)
def delete_camera(camera_id: str, db: Session = Depends(get_db)) -> Response:
    camera = db.query(Camera).filter(Camera.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error": "CAMERA_NOT_FOUND",
                "message": f"Camera {camera_id} was not found",
            },
        )
    db.delete(camera)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Step-5 per-camera routes ──────────────────────────────────────────────────

@router.get("/{camera_id}/neighbors", response_model=List[NeighborResponse],
            summary="Neighboring cameras")
def camera_neighbors(camera_id: str,
                     db: Session = Depends(get_db)) -> List[NeighborResponse]:
    from app.services.camera_topology import get_neighbors
    try:
        rows = get_neighbors(db, camera_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "INVALID_CAMERA_ID", "message": str(exc)},
        )
    return [NeighborResponse.model_validate(r) for r in rows]


@router.post("/{camera_id}/neighbors", response_model=NeighborResponse,
             status_code=status.HTTP_201_CREATED,
             summary="Add a camera relationship")
def add_camera_neighbor(camera_id: str, payload: NeighborRequest,
                        db: Session = Depends(get_db)) -> NeighborResponse:
    from app.services.camera_topology import add_relationship
    try:
        row = add_relationship(
            db, camera_id, payload.target_camera_id,
            relationship_type=payload.relationship_type,
            estimated_transition_seconds=payload
            .estimated_transition_seconds,
            distance=payload.distance,
            confidence=payload.confidence)
    except ValueError as exc:
        message = str(exc)
        if "already exists" in message:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "RELATIONSHIP_EXISTS", "message": message},
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "INVALID_RELATIONSHIP", "message": message},
        )
    return NeighborResponse.model_validate(row)


@router.get("/{camera_id}/health", summary="Health of one camera/source")
def camera_health(camera_id: str) -> dict:
    service = get_health_service()
    health = service.get(camera_id)
    if health is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": "CAMERA_NOT_FOUND",
                    "message": f"No health data for camera {camera_id}"},
        )
    state = service.evaluate(camera_id)
    return {
        "camera_id": state.camera_id, "status": state.status,
        "last_seen_at": state.last_seen_at, "fps": state.fps,
        "frames_processed": state.frames_processed, "errors": state.errors,
    }
