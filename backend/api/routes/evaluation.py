"""Evaluation API endpoints — run FID/CLIP evaluation and get results."""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Optional

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# Global evaluation state
_evaluation_status = {"status": "idle", "progress": 0, "message": ""}
_evaluation_lock = threading.Lock()


class EvaluationRequest(BaseModel):
    """Request to start evaluation."""
    num_images: Optional[int] = 50  # Number of images to generate for evaluation


class EvaluationStatusResponse(BaseModel):
    """Response with evaluation status."""
    status: str  # idle, running, completed, failed
    progress: int
    message: str
    results: Optional[dict] = None


def _run_evaluation_background(
    num_images: int,
) -> None:
    """Background function to run evaluation."""
    global _evaluation_status
    
    try:
        from ml.evaluate import evaluate
        from omegaconf import OmegaConf
        
        _evaluation_status = {"status": "running", "progress": 0, "message": "Loading config..."}
        
        # Load config
        backend_dir = Path(__file__).parent.parent.parent
        config_path = backend_dir / "configs" / "training_config.yaml"
        
        if config_path.exists():
            cfg = OmegaConf.load(config_path)
        else:
            cfg = OmegaConf.create({})
        
        # Get paths
        dataset_path = cfg.get("dataset", {}).get("dataset_path", "./data/domain_images")
        if not Path(dataset_path).is_absolute():
            dataset_path = str(backend_dir / dataset_path)
        
        eval_prompts_file = cfg.get("evaluation", {}).get("eval_prompts_file", "./data/eval_prompts.txt")
        if not Path(eval_prompts_file).is_absolute():
            eval_prompts_file = str(backend_dir / eval_prompts_file)
        
        output_path = cfg.get("evaluation", {}).get("results_output", "./evaluation_results.json")
        if not Path(output_path).is_absolute():
            output_path = str(backend_dir / output_path)
        
        model_path = os.getenv("MODEL_PATH", str(backend_dir / "models" / "lora_weights"))
        base_model = os.getenv("BASE_MODEL", "runwayml/stable-diffusion-v1-5")
        
        _evaluation_status = {"status": "running", "progress": 10, "message": "Running FID/CLIP evaluation..."}
        
        # Run evaluation
        results = evaluate(
            real_image_dir=dataset_path,
            eval_prompts_file=eval_prompts_file,
            finetuned_model_path=model_path,
            base_model=base_model,
            num_eval_images=num_images,
            output_path=output_path,
        )
        
        _evaluation_status = {"status": "completed", "progress": 100, "message": "Evaluation complete!", "results": results}
        
    except Exception as e:
        _evaluation_status = {"status": "failed", "progress": 0, "message": f"Error: {str(e)}"}


@router.post("/start", response_model=EvaluationStatusResponse)
async def start_evaluation(request: EvaluationRequest) -> EvaluationStatusResponse:
    """Start a new evaluation run."""
    global _evaluation_status
    
    with _evaluation_lock:
        if _evaluation_status["status"] == "running":
            return EvaluationStatusResponse(
                status="running",
                progress=_evaluation_status["progress"],
                message="Evaluation already in progress"
            )
    
    # Start evaluation in background
    thread = threading.Thread(target=_run_evaluation_background, args=(request.num_images,))
    thread.daemon = True
    thread.start()
    
    return EvaluationStatusResponse(
        status="starting",
        progress=0,
        message="Evaluation started..."
    )


@router.get("/status", response_model=EvaluationStatusResponse)
async def get_evaluation_status() -> EvaluationStatusResponse:
    """Get current evaluation status."""
    global _evaluation_status
    
    results = None
    if _evaluation_status.get("status") == "completed":
        # Try to load from file
        backend_dir = Path(__file__).parent.parent.parent
        output_path = backend_dir / "evaluation_results.json"
        if output_path.exists():
            with open(output_path) as f:
                results = json.load(f)
    
    return EvaluationStatusResponse(
        status=_evaluation_status.get("status", "idle"),
        progress=_evaluation_status.get("progress", 0),
        message=_evaluation_status.get("message", ""),
        results=results
    )
