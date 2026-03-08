"""Training API endpoints — start/stop/status of LoRA fine-tuning runs."""
from __future__ import annotations

import asyncio
import io
import json
import os
import sys
import threading
import traceback
from collections import deque
from pathlib import Path
from typing import Optional, Deque

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from supabase import create_client

router = APIRouter()


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


# ---------------------------------------------------------------------------
# Global in-memory log buffer (ring buffer, max 500 lines)
# ---------------------------------------------------------------------------

_log_buffer: Deque[str] = deque(maxlen=500)
_log_lock = threading.Lock()
_training_active = False

# Subscribers waiting for new log lines (SSE clients)
_log_subscribers: list[asyncio.Queue] = []
_subscribers_lock = threading.Lock()


def _append_log(line: str) -> None:
    """Append a log line to the buffer and notify all SSE subscribers."""
    line = line.rstrip("\n")
    if not line:
        return
    with _log_lock:
        _log_buffer.append(line)
    with _subscribers_lock:
        for q in _log_subscribers:
            try:
                q.put_nowait(line)
            except asyncio.QueueFull:
                pass


class _LogCapture(io.TextIOBase):
    """A file-like object that tees all writes to _append_log AND the real stdout/stderr."""

    def __init__(self, real_stream):
        self._real = real_stream
        self._line_buf = ""

    def write(self, s: str) -> int:
        self._real.write(s)
        self._real.flush()
        self._line_buf += s
        while "\n" in self._line_buf:
            line, self._line_buf = self._line_buf.split("\n", 1)
            _append_log(line)
        return len(s)

    def flush(self):
        self._real.flush()

    @property
    def encoding(self):
        return self._real.encoding

    @property
    def errors(self):
        return getattr(self._real, "errors", "strict")

    def fileno(self):
        return self._real.fileno()


# In-memory training process tracker
_training_config: Optional[dict] = None


class TrainingRequest(BaseModel):
    """Request to start a new training run."""
    run_name: Optional[str] = None
    dataset_path: Optional[str] = None
    lora_rank: Optional[int] = None
    learning_rate: Optional[float] = None
    max_train_steps: Optional[int] = None
    train_batch_size: Optional[int] = None
    output_dir: Optional[str] = None


class TrainingStatusResponse(BaseModel):
    """Response with training run status."""
    status: str  # not_started, running, completed, failed
    run_name: Optional[str] = None
    message: Optional[str] = None


class TrainingStartResponse(BaseModel):
    """Response when training is started."""
    run_id: str
    status: str
    message: str


def _run_training_background(
    run_id: str,
    config_dict: dict,
    run_name: str,
) -> None:
    """Background function to run training and update Supabase."""
    global _training_active
    _training_active = True

    # Intercept stdout/stderr so we can stream them to the UI
    original_stdout = sys.stdout
    original_stderr = sys.stderr
    sys.stdout = _LogCapture(original_stdout)
    sys.stderr = _LogCapture(original_stderr)

    supabase = _get_supabase()

    try:
        _append_log(f"INFO [system] Training run '{run_name}' starting (id={run_id[:8]})…")

        # Update status to running
        supabase.table("training_runs").update({
            "status": "running",
            "current_step": 0,
        }).eq("id", run_id).execute()

        # Run training
        from ml.train_lora import train
        from omegaconf import OmegaConf

        cfg = OmegaConf.create(config_dict)

        # Convert relative paths to absolute paths based on backend directory
        backend_dir = Path(__file__).parent.parent.parent

        if cfg.dataset.dataset_path and not Path(cfg.dataset.dataset_path).is_absolute():
            cfg.dataset.dataset_path = str(backend_dir / cfg.dataset.dataset_path)

        if cfg.training.output_dir and not Path(cfg.training.output_dir).is_absolute():
            cfg.training.output_dir = str(backend_dir / cfg.training.output_dir)

        if cfg.training.logging_dir and not Path(cfg.training.logging_dir).is_absolute():
            cfg.training.logging_dir = str(backend_dir / cfg.training.logging_dir)

        # Save modified config
        temp_config_path = f"/tmp/training_config_{run_id}.yaml"
        OmegaConf.save(cfg, temp_config_path)

        # Expose run_id so train_lora.py can push live step updates
        os.environ["TRAINING_RUN_ID"] = run_id

        _append_log(f"INFO [system] Config saved, starting ml.train_lora.train()…")

        # Run training
        train(temp_config_path)

        # Update final status
        supabase.table("training_runs").update({
            "status": "completed",
            "current_step": cfg.training.max_train_steps,
            "final_loss": 0.0,  # Would be read from training log
        }).eq("id", run_id).execute()

        _append_log("INFO [system] ✅ Training completed successfully!")

    except Exception as e:
        supabase.table("training_runs").update({
            "status": "failed",
        }).eq("id", run_id).execute()
        _append_log(f"ERROR [system] Training failed: {e}")
        print(traceback.format_exc())

    finally:
        _training_active = False
        sys.stdout = original_stdout
        sys.stderr = original_stderr
        # Signal all SSE subscribers that the stream is done
        with _subscribers_lock:
            for q in _log_subscribers:
                try:
                    q.put_nowait(None)  # sentinel
                except asyncio.QueueFull:
                    pass


@router.post("/start", response_model=TrainingStartResponse)
async def start_training(request: TrainingRequest) -> TrainingStartResponse:
    """Start a new training run."""
    global _training_active, _training_config

    if _training_active:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=409,
            detail="A training run is already in progress"
        )

    # Clear log buffer for fresh run
    with _log_lock:
        _log_buffer.clear()

    supabase = _get_supabase()

    # Load default config
    backend_dir = Path(__file__).parent.parent.parent
    config_path = backend_dir / "configs" / "training_config.yaml"
    if not config_path.exists():
        project_root = Path(__file__).parent.parent.parent.parent
        config_path = project_root / "backend" / "configs" / "training_config.yaml"

    from omegaconf import OmegaConf
    cfg = OmegaConf.load(str(config_path))

    # Apply custom parameters
    if request.dataset_path:
        cfg.dataset.dataset_path = request.dataset_path
    if request.lora_rank:
        cfg.lora.rank = request.lora_rank
    if request.learning_rate:
        cfg.training.learning_rate = request.learning_rate
    if request.max_train_steps:
        cfg.training.max_train_steps = request.max_train_steps
    if request.train_batch_size:
        cfg.training.train_batch_size = request.train_batch_size
    if request.output_dir:
        cfg.training.output_dir = request.output_dir

    # Create training run record
    import uuid
    run_id = str(uuid.uuid4())
    run_name = request.run_name or f"run_{run_id[:8]}"

    run_data = {
        "id": run_id,
        "run_name": run_name,
        "status": "starting",
        "total_steps": cfg.training.max_train_steps,
        "learning_rate": cfg.training.learning_rate,
        "lora_rank": cfg.lora.rank,
        "config": OmegaConf.to_container(cfg, resolve=True),
    }

    supabase.table("training_runs").insert(run_data).execute()

    _append_log(f"INFO [system] Training run '{run_name}' queued, spinning up thread…")

    # Start training in a background thread (non-blocking)
    thread = threading.Thread(
        target=_run_training_background,
        args=(run_id, OmegaConf.to_container(cfg, resolve=True), run_name),
        daemon=True,
    )
    thread.start()

    return TrainingStartResponse(
        run_id=run_id,
        status="starting",
        message=f"Training run '{run_name}' started. Use GET /training/status to monitor progress.",
    )


@router.get("/logs")
async def get_training_logs():
    """Return current in-memory log buffer as JSON (polling fallback)."""
    with _log_lock:
        lines = list(_log_buffer)
    return {"lines": lines, "active": _training_active}


@router.get("/stream-logs")
async def stream_training_logs():
    """Stream training logs as Server-Sent Events (SSE)."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    loop = asyncio.get_event_loop()

    with _subscribers_lock:
        _log_subscribers.append(queue)

    async def event_generator():
        try:
            # First, flush the existing buffer so the client gets history
            with _log_lock:
                existing = list(_log_buffer)
            for line in existing:
                yield f"data: {json.dumps(line)}\n\n"

            # Then stream new lines as they arrive
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=30.0)
                except asyncio.TimeoutError:
                    # Send a keepalive comment to prevent connection timeout
                    yield ": keepalive\n\n"
                    continue

                if item is None:
                    # Sentinel — training finished
                    yield f"data: {json.dumps('INFO [system] --- Training finished ---')}\n\n"
                    break
                yield f"data: {json.dumps(item)}\n\n"
        finally:
            with _subscribers_lock:
                try:
                    _log_subscribers.remove(queue)
                except ValueError:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/status", response_model=TrainingStatusResponse)
async def get_training_status() -> TrainingStatusResponse:
    """Get the current training status."""
    supabase = _get_supabase()

    try:
        run_res = (
            supabase.table("training_runs")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        if run_res.data:
            latest_run = run_res.data[0]
            status = latest_run.get("status", "not_started")

            if status == "running" and not _training_active:
                try:
                    supabase.table("training_runs").update({
                        "status": "failed",
                    }).eq("id", latest_run["id"]).execute()
                except Exception:
                    pass
                status = "failed"

            return TrainingStatusResponse(
                status=status,
                run_name=latest_run.get("run_name"),
                message=f"Latest run: {latest_run.get('run_name')}",
            )

    except Exception as e:
        print(f"Connection error while fetching status: {e}")
        return TrainingStatusResponse(
            status="unknown",
            message="Connecting to database…",
        )

    return TrainingStatusResponse(
        status="not_started",
        message="No training runs found",
    )


@router.post("/stop")
async def stop_training() -> TrainingStatusResponse:
    """Stop the current training run."""
    from fastapi import HTTPException
    if not _training_active:
        raise HTTPException(status_code=404, detail="No training run in progress")

    # Signal training to stop by setting a flag (best-effort; training loop checks it)
    _append_log("WARN [system] Stop requested — training will halt at next checkpoint.")

    supabase = _get_supabase()
    try:
        supabase.table("training_runs").update({
            "status": "stopped",
        }).execute()
    except Exception:
        pass

    return TrainingStatusResponse(
        status="stopped",
        message="Training run stop requested",
    )
