"""
app/pipeline/video_reader.py

VideoReader — wraps OpenCV VideoCapture with validation, metadata,
context-manager support, and clean error handling.

Usage:
    with VideoReader("data/videos/sample/test.mp4") as reader:
        print(reader.fps, reader.width, reader.height)
        for frame_idx, frame in reader:
            ...   # frame is a BGR numpy array
"""

from __future__ import annotations

import os
from typing import Iterator, Optional, Tuple

import cv2
import numpy as np

from app.core.logging import get_logger

logger = get_logger(__name__)


class VideoReaderError(RuntimeError):
    """Raised when the VideoReader cannot open or read the video."""


class VideoReader:
    """
    Iterable wrapper around cv2.VideoCapture.

    Parameters
    ----------
    path : str
        Absolute or relative path to the video file.
    frame_skip : int
        Process every (frame_skip + 1)th frame.  0 = every frame.

    Attributes
    ----------
    width        : int
    height       : int
    fps          : float
    frame_count  : int   (-1 if the container doesn't report it)
    frame_number : int   (current frame index, 0-based)
    """

    def __init__(self, path: str, frame_skip: int = 0) -> None:
        if not path:
            raise VideoReaderError("Video path must not be empty.")
        if not os.path.exists(path):
            raise VideoReaderError(f"Video file not found: '{path}'")

        self._path = path
        self._frame_skip = max(0, frame_skip)
        self._cap: Optional[cv2.VideoCapture] = None
        self.frame_number: int = 0

        self._open()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _open(self) -> None:
        cap = cv2.VideoCapture(self._path)
        if not cap.isOpened():
            raise VideoReaderError(
                f"OpenCV could not open video: '{self._path}'. "
                "The file may be corrupt or use an unsupported codec."
            )
        self._cap = cap
        # Validate that at least one frame is readable
        ok, frame = cap.read()
        if not ok or frame is None:
            cap.release()
            self._cap = None
            raise VideoReaderError(
                f"Video opened but no frames could be read: '{self._path}'."
            )
        # Rewind to the beginning
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)

    # ------------------------------------------------------------------
    # Metadata properties
    # ------------------------------------------------------------------

    @property
    def width(self) -> int:
        assert self._cap is not None
        return int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))

    @property
    def height(self) -> int:
        assert self._cap is not None
        return int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    @property
    def fps(self) -> float:
        assert self._cap is not None
        val = self._cap.get(cv2.CAP_PROP_FPS)
        return val if val > 0 else 25.0  # fallback

    @property
    def frame_count(self) -> int:
        """Total frames as reported by the container, or -1 if unknown."""
        assert self._cap is not None
        count = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))
        return count if count > 0 else -1

    @property
    def duration_seconds(self) -> float:
        """Estimated duration in seconds, or -1.0 if unknown."""
        fc = self.frame_count
        if fc > 0 and self.fps > 0:
            return fc / self.fps
        return -1.0

    # ------------------------------------------------------------------
    # Iteration
    # ------------------------------------------------------------------

    def __iter__(self) -> Iterator[Tuple[int, np.ndarray]]:
        """Yield (frame_index, frame_bgr) tuples."""
        assert self._cap is not None, "VideoReader is closed."
        self.frame_number = 0
        raw_idx = 0
        while True:
            ok, frame = self._cap.read()
            if not ok or frame is None:
                break
            if self._frame_skip == 0 or raw_idx % (self._frame_skip + 1) == 0:
                yield self.frame_number, frame
                self.frame_number += 1
            raw_idx += 1

    # ------------------------------------------------------------------
    # Resource management
    # ------------------------------------------------------------------

    def release(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
            logger.debug("VideoReader released: %s", self._path)

    def __enter__(self) -> "VideoReader":
        return self

    def __exit__(self, *_: object) -> None:
        self.release()

    def __repr__(self) -> str:
        return (
            f"VideoReader(path='{self._path}', "
            f"{self.width}x{self.height} @ {self.fps:.1f} fps, "
            f"frames={self.frame_count})"
        )
