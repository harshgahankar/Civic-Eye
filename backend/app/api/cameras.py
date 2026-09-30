"""
Camera CRUD endpoints.

GET    /api/v1/cameras             — list all cameras
GET    /api/v1/cameras/{camera_id} — get single camera
POST   /api/v1/cameras             — register a new camera
DELETE /api/v1/cameras/{camera_id} — remove a camera
"""

from __future__ import annotations

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Camera
from app.schemas.camera import CameraCreate, CameraResponse

router = APIRouter(prefix="/cameras", tags=["cameras"])


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
