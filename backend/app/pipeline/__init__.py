"""
Processing pipeline package.

VideoReader      — OpenCV video ingestion (app/pipeline/video_reader.py)
FrameProcessor   — per-frame detect+track → DetectionEvent (app/pipeline/frame_processor.py)
PipelineManager  — end-to-end video processing (app/pipeline/pipeline_manager.py)
"""

from app.pipeline.video_reader import VideoReader, VideoReaderError
from app.pipeline.frame_processor import FrameProcessor
from app.pipeline.pipeline_manager import PipelineManager, PipelineResult

__all__ = [
    "VideoReader",
    "VideoReaderError",
    "FrameProcessor",
    "PipelineManager",
    "PipelineResult",
]
