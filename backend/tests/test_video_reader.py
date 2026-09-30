"""
tests/test_video_reader.py

Tests for VideoReader — both error handling and normal operation.
"""

from __future__ import annotations

import os
import tempfile

import cv2
import numpy as np
import pytest

from app.pipeline.video_reader import VideoReader, VideoReaderError

# Path to the sample video created during setup
SAMPLE_VIDEO = os.path.join(
    os.path.dirname(__file__), "..", "..", "data", "videos", "sample", "test.mp4"
)


def _make_temp_video(frames: int = 10, w: int = 320, h: int = 240, fps: float = 15.0) -> str:
    """Create a minimal MP4 in a temp file; return its path."""
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.close()
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(tmp.name, fourcc, fps, (w, h))
    for i in range(frames):
        frame = np.full((h, w, 3), i * 2, dtype=np.uint8)
        writer.write(frame)
    writer.release()
    return tmp.name


# ── Error handling tests ──────────────────────────────────────────────────────

class TestVideoReaderErrors:
    def test_missing_file_raises(self) -> None:
        with pytest.raises(VideoReaderError, match="not found"):
            VideoReader("/nonexistent/path/video.mp4")

    def test_empty_path_raises(self) -> None:
        with pytest.raises(VideoReaderError, match="empty"):
            VideoReader("")

    def test_non_video_file_raises(self) -> None:
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as f:
            f.write(b"not a video")
            tmp_path = f.name
        try:
            with pytest.raises(VideoReaderError):
                VideoReader(tmp_path)
        finally:
            os.unlink(tmp_path)


# ── Metadata tests ────────────────────────────────────────────────────────────

class TestVideoReaderMetadata:
    @pytest.fixture(scope="class")
    def video_path(self) -> str:
        path = _make_temp_video(frames=30, w=320, h=240, fps=15.0)
        yield path
        try:
            os.unlink(path)
        except Exception:
            pass

    def test_opens_successfully(self, video_path: str) -> None:
        reader = VideoReader(video_path)
        assert reader is not None
        reader.release()

    def test_context_manager(self, video_path: str) -> None:
        with VideoReader(video_path) as reader:
            assert reader.width == 320
            assert reader.height == 240

    def test_width_height(self, video_path: str) -> None:
        with VideoReader(video_path) as reader:
            assert reader.width == 320
            assert reader.height == 240

    def test_fps(self, video_path: str) -> None:
        with VideoReader(video_path) as reader:
            assert reader.fps > 0

    def test_frame_count(self, video_path: str) -> None:
        with VideoReader(video_path) as reader:
            # May be -1 if container doesn't report it
            assert reader.frame_count != 0

    def test_repr(self, video_path: str) -> None:
        with VideoReader(video_path) as reader:
            r = repr(reader)
            assert "VideoReader" in r


# ── Frame iteration tests ─────────────────────────────────────────────────────

class TestVideoReaderIteration:
    @pytest.fixture(scope="class")
    def video_path(self) -> str:
        path = _make_temp_video(frames=20, w=160, h=120, fps=10.0)
        yield path
        try:
            os.unlink(path)
        except Exception:
            pass

    def test_iterates_frames(self, video_path: str) -> None:
        count = 0
        with VideoReader(video_path) as reader:
            for idx, frame in reader:
                assert isinstance(frame, np.ndarray)
                assert frame.shape[0] == 120
                assert frame.shape[1] == 160
                assert frame.shape[2] == 3
                count += 1
        assert count > 0

    def test_frame_numbers_sequential(self, video_path: str) -> None:
        indices: list[int] = []
        with VideoReader(video_path) as reader:
            for idx, _ in reader:
                indices.append(idx)
        assert indices == list(range(len(indices)))

    def test_frame_skip(self, video_path: str) -> None:
        all_count = sum(1 for _ in VideoReader(video_path))
        skip_count = sum(1 for _ in VideoReader(video_path, frame_skip=1))
        # With skip=1, roughly half the frames
        assert skip_count <= all_count
        assert skip_count > 0


# ── Sample video test (uses real test.mp4) ────────────────────────────────────

class TestSampleVideo:
    def test_sample_video_readable(self) -> None:
        if not os.path.exists(SAMPLE_VIDEO):
            pytest.skip("Sample video not found — run setup first.")
        with VideoReader(SAMPLE_VIDEO) as reader:
            assert reader.width == 640
            assert reader.height == 480
            first_frame = None
            for _, frame in reader:
                first_frame = frame
                break
            assert first_frame is not None
            assert first_frame.shape == (480, 640, 3)
