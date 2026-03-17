"""Inference pipeline wrapper — loads fine-tuned SD + LoRA and generates images."""
from __future__ import annotations

import random
from pathlib import Path
from typing import Any, Dict, Optional

import torch
from PIL import Image


class InferencePipeline:
    """Singleton-style diffusion inference wrapper."""

    def __init__(self, model_path: str, base_model: str, device: str = "cuda") -> None:
        self.model_path = Path(model_path)
        self.base_model = base_model
        self.device = device if torch.cuda.is_available() else "cpu"
        self._pipe: Any = None
        self._lora_loaded = False

    def load(self) -> None:
        """Load base model + LoRA weights into memory."""
        from diffusers import (  # noqa: PLC0415
            DDIMScheduler,
            DDPMScheduler,
            DPMSolverMultistepScheduler,
            StableDiffusionPipeline,
        )
        from peft import PeftModel  # noqa: PLC0415

        print(f"Loading base model: {self.base_model}")
        pipe = StableDiffusionPipeline.from_pretrained(
            self.base_model,
            torch_dtype=torch.float16 if self.device == "cuda" else torch.float32,
            safety_checker=None,
        )

        # Load LoRA weights if they exist using PEFT
        if self.model_path.exists() and any(self.model_path.iterdir()):
            try:
                print(f"Loading LoRA weights from: {self.model_path}")
                # Use PEFT to load LoRA weights (properly handles PEFT-trained adapters)
                pipe.unet = PeftModel.from_pretrained(
                    pipe.unet,
                    str(self.model_path),
                    adapter_name="default",
                )
                print("✅ LoRA weights loaded successfully via PEFT")
            except Exception as e:
                print(f"⚠️  Failed to load LoRA weights: {e}")
                print("   Falling back to base model inference.")

        pipe = pipe.to(self.device)

        if self.device == "cuda":
            try:
                pipe.enable_xformers_memory_efficient_attention()
            except Exception:
                pass
        pipe.enable_attention_slicing()

        self._pipe = pipe
        self._lora_loaded = True

    def set_lora_enabled(self, enabled: bool) -> None:
        """Enable or disable LoRA weights."""
        if self._pipe is None:
            return
        if not hasattr(self._pipe, 'unet') or not hasattr(self._pipe.unet, 'peft_config'):
            return  # No LoRA loaded
        
        if enabled:
            try:
                self._pipe.unet.set_adapter("default")
                self._lora_loaded = True
            except Exception as e:
                print(f"Failed to enable LoRA: {e}")
        else:
            try:
                self._pipe.unet.disable_adapters()
                self._lora_loaded = False
            except Exception as e:
                print(f"Failed to disable LoRA: {e}")
        print(f"Pipeline ready on {self.device}")

    def _set_scheduler(self, scheduler_name: str) -> None:
        """Swap scheduler on the loaded pipeline."""
        from diffusers import (  # noqa: PLC0415
            DDIMScheduler,
            DDPMScheduler,
            DPMSolverMultistepScheduler,
        )

        cfg = self._pipe.scheduler.config
        schedulers = {
            "ddim": DDIMScheduler.from_config(cfg),
            "ddpm": DDPMScheduler.from_config(cfg),
            "dpm++": DPMSolverMultistepScheduler.from_config(cfg),
        }
        self._pipe.scheduler = schedulers.get(scheduler_name, schedulers["ddim"])

    def generate(
        self,
        prompt: str,
        negative_prompt: str = "",
        num_inference_steps: int = 20,
        guidance_scale: float = 7.5,
        seed: int = -1,
        scheduler: str = "ddim",
        width: int = 512,
        height: int = 512,
    ) -> Dict[str, Any]:
        """Generate an image and return dict with PIL image + metadata."""
        if self._pipe is None:
            raise RuntimeError("Pipeline not loaded. Call load() first.")

        self._set_scheduler(scheduler)

        # Seed handling
        seed_used = seed if seed >= 0 else random.randint(0, 2**32 - 1)
        generator = torch.Generator(device=self.device).manual_seed(seed_used)

        with torch.inference_mode():
            output = self._pipe(
                prompt=prompt,
                negative_prompt=negative_prompt or None,
                num_inference_steps=num_inference_steps,
                guidance_scale=guidance_scale,
                generator=generator,
                width=width,
                height=height,
            )

        image: Image.Image = output.images[0]
        return {"image": image, "seed_used": seed_used}
