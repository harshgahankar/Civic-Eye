"""Upload flag timing: mid-video confirms stay silent, completion raises them.

Contract:
  - pipeline_manager tags file-job incident envelopes with origin=upload,
    live camera_stream paths publish untagged (instant popups preserved);
  - UPLOAD_JOB_COMPLETED is a known HIGH-priority bus event carrying the
    confirmed flag payloads that the dashboard pops up;
  - _broadcast_upload_completion dedupes repeat emissions and stays
    silent when nothing confirmed.
"""
from __future__ import annotations

from types import SimpleNamespace

from app.api.processing import _broadcast_upload_completion
from app.events import event_types
from app.events.publisher import publish_incident_detail


def _incident(iid: str, status: str = "CONFIRMED"):
    return SimpleNamespace(
        incident_id=iid,
        incident_type="ACCIDENT",
        camera_id="CAM-UPLOAD",
        severity="HIGH",
        confidence=0.82,
        status=status,
        track_ids=[2, 12],
    )


class TestUploadCompletionContract:
    def test_event_type_registered_high_priority(self) -> None:
        assert event_types.is_known(event_types.UPLOAD_JOB_COMPLETED)
        assert event_types.priority_of(event_types.UPLOAD_JOB_COMPLETED) == "HIGH"

    def test_publish_merges_origin_extra(self) -> None:
        from app.events.event_bus import EventBus

        local = EventBus()
        got: list = []
        local.subscribe(got.append)
        inc = _incident("INC-TAG")
        publish_incident_detail(
            local, event_types.INCIDENT_CONFIRMED, inc,
            extra={"origin": "upload", "job_id": "JOB-1"})
        assert len(got) == 1
        payload = got[0].payload
        assert payload["origin"] == "upload"
        assert payload["job_id"] == "JOB-1"
        assert payload["incident_type"] == "ACCIDENT"
        # Untouched incident, default path has no origin key.
        local2 = EventBus()
        got2: list = []
        local2.subscribe(got2.append)
        publish_incident_detail(local2, event_types.INCIDENT_CONFIRMED, inc)
        assert "origin" not in got2[0].payload

    def test_broadcast_dedupes_and_skips_empty(self) -> None:
        from app.events.event_bus import EventBus

        import app.api.processing as proc

        local = EventBus()
        got: list = []
        local.subscribe(got.append)
        # Swap the default bus seen by the helper via monkeypatch-style swap.
        import app.events as events_pkg

        real = events_pkg.get_default_bus
        events_pkg.get_default_bus = lambda: local  # type: ignore[assignment]
        try:
            job = SimpleNamespace(job_id="JOB-9", camera_id="CAM-UPLOAD")
            # Repeat emissions of the same incident → one entry.
            proc._broadcast_upload_completion(
                job, [_incident("INC-A"), _incident("INC-A"),
                      _incident("INC-B")])
            assert len(got) == 1
            payload = got[0].payload
            assert payload["job_id"] == "JOB-9"
            assert payload["confirmed_count"] == 2
            ids = [i["incident_id"] for i in payload["incidents"]]
            assert ids == ["INC-A", "INC-B"]
            assert got[0].event_type == event_types.UPLOAD_JOB_COMPLETED

            # Nothing confirmed → silent.
            got.clear()
            proc._broadcast_upload_completion(
                job, [_incident("INC-X", status="FALSE_ALARM")])
            assert got == []
        finally:
            events_pkg.get_default_bus = real  # type: ignore[assignment]
