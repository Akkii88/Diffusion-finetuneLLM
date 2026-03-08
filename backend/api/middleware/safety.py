"""Two-layer safety filter: prompt-level + image-level.

Uses HuggingFace Inference API (free) for prompt safety classification.
Get a free token at: https://huggingface.co/settings/tokens
"""
from __future__ import annotations

import asyncio
import os
from pathlib import Path
from typing import Tuple

from PIL import Image

# ---------------------------------------------------------------------------
# Keyword blocklist (prompt-level)
# ---------------------------------------------------------------------------

BLOCKLIST: set[str] = {
    "nude", "naked", "nsfw", "explicit", "pornographic", "sexual",
    "pornography", "genitals", "rape", "child pornography", "cp",
    "violence", "gore", "torture", "murder", "execute", "decapitate",
    "self-harm", "suicide", "bomb", "weapon", "terrorist",
}


class SafetyFilter:
    """Two-layer safety filter for prompts and generated images."""

    def __init__(self) -> None:
        self._hf_safety_checker = None
        self._hf_feature_extractor = None

    # ------------------------------------------------------------------
    # Layer 1: Prompt safety
    # ------------------------------------------------------------------

    async def check_prompt(self, prompt: str) -> Tuple[bool, str]:
        """Return (is_safe, reason). Checks blocklist then HuggingFace safety model."""
        lowered = prompt.lower()

        # Keyword check
        for word in BLOCKLIST:
            if word in lowered:
                return False, f"Prompt contains blocked keyword: '{word}'"

        # Optional HuggingFace API for advanced safety classification
        # Get HuggingFace token from env (optional - works without it with rate limits)
        hf_token = os.getenv("HF_TOKEN", "")
        if hf_token or os.getenv("USE_HF_SAFETY", "true") == "true":
            # If no token provided, still try (will have lower rate limits)
            try:
                is_safe, reason = await self._gemini_classify(prompt, hf_token)
                if not is_safe:
                    return False, reason
            except Exception as exc:
                # If HuggingFace call fails, log and pass (fail-open for availability)
                print(f"[SafetyFilter] HuggingFace check failed: {exc}")

        return True, ""

    async def _gemini_classify(self, prompt: str, api_key: str) -> Tuple[bool, str]:
        """Use HuggingFace Inference API (free) to classify prompt safety."""
        import httpx  # noqa: PLC0415

        # Use HuggingFace's free Inference API with a toxicity detection model
        # Using "martin-ha/toxic-comment-model" which is a well-known toxicity classifier
        model_id = "martin-ha/toxic-comment-model"
        url = f"https://api-inference.huggingface.co/models/{model_id}"
        
        # Headers with optional API key for higher rate limits
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        payload = {
            "inputs": prompt,
            "options": {"wait_for_model": True}
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            # Fallback to alternative model if primary fails
            print(f"[SafetyFilter] Primary safety model failed ({e.response.status_code}), trying fallback...")
            return await self._fallback_hf_classify(prompt, api_key)
        except Exception as exc:
            print(f"[SafetyFilter] HuggingFace API error: {exc}")
            return True, ""  # Fail-open on API errors

        # Parse the response - toxic-comment-model returns [[{"label": "toxic", "score": ...}, ...]]
        if isinstance(data, list) and len(data) > 0:
            results = data[0]
            if isinstance(results, list):
                for item in results:
                    label = item.get("label", "").lower()
                    score = item.get("score", 0.0)
                    # If toxic with high confidence (>0.5), block it
                    if label == "toxic" and score > 0.5:
                        return False, f"HuggingFace classified prompt as toxic (confidence: {score:.2f})"
        
        return True, ""

    async def _fallback_hf_classify(self, prompt: str, api_key: str) -> Tuple[bool, str]:
        """Fallback to alternative HuggingFace model if primary fails."""
        import httpx  # noqa: PLC0415

        # Try another hate speech model as fallback
        model_id = "cardiffnlp/twitter-roberta-base-hate-latest"
        url = f"https://api-inference.huggingface.co/models/{model_id}"
        
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        
        payload = {
            "inputs": prompt,
            "options": {"wait_for_model": True}
        }
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            print(f"[SafetyFilter] Fallback model failed with status {e.response.status_code}. Failing open.")
            return True, ""
        except Exception as exc:
            print(f"[SafetyFilter] Fallback model also failed: {exc}")
            return True, ""  # Fail-open

        # Parse response - returns [[{"label": "nothate" | "hate", "score": ...}]]
        if isinstance(data, list) and len(data) > 0:
            results = data[0]
            if isinstance(results, list):
                for item in results:
                    label = item.get("label", "").lower()
                    score = item.get("score", 0.0)
                    if label == "hate" and score > 0.5:
                        return False, f"HuggingFace classified prompt as hate speech (confidence: {score:.2f})"
        
        return True, ""

    # ------------------------------------------------------------------
    # Layer 2: Image safety
    # ------------------------------------------------------------------

    async def check_image(self, image: Image.Image) -> Tuple[bool, str]:
        """Run HuggingFace safety checker on the generated image."""
        try:
            checker, extractor = self._load_safety_checker()
            import torch  # noqa: PLC0415
            import numpy as np  # noqa: PLC0415

            # Run in thread pool to avoid blocking event loop
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                None, self._run_hf_checker, image, checker, extractor
            )
            has_nsfw = result
            if has_nsfw:
                return False, "Image flagged by HuggingFace safety checker"
            return True, ""
        except Exception as exc:
            print(f"[SafetyFilter] Image check failed (fail-open): {exc}")
            return True, ""

    def _load_safety_checker(self):
        if self._hf_safety_checker is None:
            from diffusers.pipelines.stable_diffusion.safety_checker import (  # noqa: PLC0415
                StableDiffusionSafetyChecker,
            )
            from transformers import AutoFeatureExtractor  # noqa: PLC0415

            model_id = "CompVis/stable-diffusion-safety-checker"
            self._hf_safety_checker = StableDiffusionSafetyChecker.from_pretrained(model_id)
            self._hf_feature_extractor = AutoFeatureExtractor.from_pretrained(model_id)
        return self._hf_safety_checker, self._hf_feature_extractor

    def _run_hf_checker(self, image: Image.Image, checker, extractor) -> bool:
        import numpy as np  # noqa: PLC0415
        import torch  # noqa: PLC0415

        inputs = extractor(images=[image], return_tensors="pt")
        clip_input = inputs["pixel_values"]
        image_np = np.array(image).astype(np.float32) / 255.0
        _, has_nsfw = checker(images=[image_np], clip_input=clip_input)
        return bool(has_nsfw[0])
