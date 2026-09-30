"""
AI/CV module package.

ObjectDetector  — YOLO detect-only wrapper (app/ai/detector.py)
ByteTracker     — YOLO detect+ByteTrack wrapper (app/ai/tracker.py)
InferenceEngine — single-entry-point facade used by the pipeline (app/ai/inference.py)
"""

from app.ai.detector import ObjectDetector
from app.ai.tracker import ByteTracker, TrackedObject
from app.ai.inference import InferenceEngine

__all__ = ["ObjectDetector", "ByteTracker", "TrackedObject", "InferenceEngine"]
