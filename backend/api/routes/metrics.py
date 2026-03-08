"""GET /metrics endpoint — training run metrics and generation stats."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional

import yaml
from fastapi import APIRouter
from pydantic import BaseModel
from supabase import create_client

router = APIRouter()


class TrainingLogPoint(BaseModel):
    step: int
    train_loss: float
    val_loss: Optional[float] = None
    smoothed_loss: Optional[float] = None
    learning_rate: Optional[float] = None
    grad_norm: Optional[float] = None
    step_time_ms: Optional[float] = None
    epoch: Optional[int] = None


class MetricsResponse(BaseModel):
    # Training run
    run_name: Optional[str] = None
    status: str = "not_started"
    total_steps: Optional[int] = None
    current_step: Optional[int] = None
    final_loss: Optional[float] = None
    learning_rate: Optional[float] = None
    lora_rank: Optional[int] = None
    fid_score: Optional[float] = None
    clip_score: Optional[float] = None
    config: Optional[dict] = None

    # Gallery stats
    total_generated: int = 0
    avg_clip_score: Optional[float] = None
    avg_generation_time_ms: Optional[float] = None
    human_approved_count: int = 0

    # Log history
    training_log: List[TrainingLogPoint] = []


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


@router.get("", response_model=MetricsResponse)
async def get_metrics() -> MetricsResponse:
    """Return training metrics and generation statistics."""
    supabase = _get_supabase()
    metrics = MetricsResponse()

    # --- Always read training_log.json first (primary source) ---
    backend_dir = Path(__file__).parent.parent.parent
    model_path = os.getenv("MODEL_PATH", str(backend_dir / "models" / "lora_weights"))
    
    # If it's a relative path, resolve from backend directory
    log_path = Path(model_path)
    if not log_path.is_absolute():
        log_path = backend_dir / model_path
    log_path = log_path / "training_log.json"
    
    if log_path.exists():
        try:
            with open(log_path) as f:
                raw_log = json.load(f)
            metrics.training_log = [TrainingLogPoint(**entry) for entry in raw_log]
            if metrics.training_log:
                metrics.current_step = metrics.training_log[-1].step
                metrics.final_loss = metrics.training_log[-1].train_loss
                metrics.total_steps = metrics.training_log[-1].step
                metrics.status = "completed"  # If log exists, training completed
                metrics.learning_rate = metrics.training_log[-1].learning_rate
                # Get run name from config if available
                config_path = backend_dir / "configs" / "training_config.yaml"
                if config_path.exists():
                    try:
                        import yaml
                        with open(config_path) as cf:
                            config_data = yaml.safe_load(cf)
                            metrics.run_name = config_data.get("run_name", "LoRA Fine-tuning")
                            metrics.lora_rank = config_data.get("lora", {}).get("rank", 16)
                    except:
                        pass
        except Exception as e:
            print(f"Could not read training_log.json: {e}")

    # --- Try to get additional data from Supabase (run_name, config, etc.) ---
    try:
        run_res = (
            supabase.table("training_runs")
            .select("*")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if run_res.data:
            run = run_res.data[0]
            # Only override if not already set from local file
            if not metrics.run_name:
                metrics.run_name = run.get("run_name")
            if not metrics.lora_rank:
                metrics.lora_rank = run.get("lora_rank")
            metrics.status = run.get("status", metrics.status)
            metrics.fid_score = run.get("fid_score")
            metrics.clip_score = run.get("clip_score")
            if not metrics.config:
                metrics.config = run.get("config")
    except Exception as e:
        print(f"Could not fetch from Supabase: {e}")

    # --- Gallery aggregates ---
    try:
        gen_res = supabase.table("generations").select("clip_score, generation_time_ms, human_rating").execute()
        rows = gen_res.data or []
    except Exception as e:
        print(f"Connection error fetching gallery aggregates: {e}")
        rows = []

    metrics.total_generated = len(rows)
    if rows:
        clip_scores = [r["clip_score"] for r in rows if r.get("clip_score") is not None]
        gen_times = [r["generation_time_ms"] for r in rows if r.get("generation_time_ms") is not None]
        metrics.avg_clip_score = round(sum(clip_scores) / len(clip_scores), 4) if clip_scores else None
        metrics.avg_generation_time_ms = round(sum(gen_times) / len(gen_times), 1) if gen_times else None
        metrics.human_approved_count = sum(1 for r in rows if r.get("human_rating") == 1)

    # Also try to load from local evaluation_results.json if available
    eval_path = Path(model_path).parent / "evaluation_results.json"
    if eval_path.exists() and metrics.fid_score is None:
        with open(eval_path) as f:
            eval_data = json.load(f)
        metrics.fid_score = eval_data.get("fid_finetuned")
        if metrics.clip_score is None:
            metrics.clip_score = eval_data.get("clip_score_finetuned")

    return metrics.model_dump()
