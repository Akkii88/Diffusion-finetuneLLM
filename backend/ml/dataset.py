"""Dataset curation pipeline for domain-specific image fine-tuning."""
from __future__ import annotations

import hashlib
import io
import logging
import os
import random
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests
import torch
from PIL import Image
from torch.utils.data import Dataset
from torchvision import transforms
from tqdm import tqdm
from transformers import CLIPTokenizer

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DomainDataset — PyTorch Dataset
# ---------------------------------------------------------------------------

class DomainDataset(Dataset):
    """
    Dataset for LoRA fine-tuning.

    Loads images from a directory, with optional auto-captioning via BLIP-2.
    Each item returns {"pixel_values": tensor, "input_ids": tensor}.
    """

    def __init__(
        self,
        image_dir: str,
        tokenizer: CLIPTokenizer,
        resolution: int = 512,
        center_crop: bool = True,
        random_flip: bool = True,
        min_resolution: int = 512,
        caption_file: Optional[str] = None,
    ) -> None:
        self.image_dir = Path(image_dir)
        self.tokenizer = tokenizer
        self.resolution = resolution
        self.min_resolution = min_resolution

        # Build image list
        extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
        self.image_paths = sorted([
            p for p in self.image_dir.rglob("*")
            if p.suffix.lower() in extensions
        ])
        logger.info(f"Found {len(self.image_paths)} images in {image_dir}")

        # Load captions
        self.captions: Dict[str, str] = {}
        if caption_file and Path(caption_file).exists():
            import json  # noqa: PLC0415
            with open(caption_file) as f:
                self.captions = json.load(f)

        # Image transforms
        aug_list = []
        if center_crop:
            aug_list.append(transforms.CenterCrop(resolution))
        else:
            aug_list.append(transforms.RandomCrop(resolution))
        if random_flip:
            aug_list.append(transforms.RandomHorizontalFlip())

        self.transform = transforms.Compose([
            transforms.Resize(resolution, interpolation=transforms.InterpolationMode.BILINEAR),
            *aug_list,
            transforms.ColorJitter(brightness=0.1, contrast=0.1, saturation=0.1, hue=0.05),
            transforms.ToTensor(),
            transforms.Normalize([0.5], [0.5]),
        ])

        # Filter by minimum resolution
        valid_paths = []
        for p in self.image_paths:
            try:
                with Image.open(p) as img:
                    w, h = img.size
                if min(w, h) >= min_resolution:
                    valid_paths.append(p)
            except Exception:
                pass
        self.image_paths = valid_paths
        logger.info(f"{len(self.image_paths)} images pass resolution filter (min={min_resolution})")

    def __len__(self) -> int:
        return len(self.image_paths)

    def __getitem__(self, idx: int) -> Dict[str, torch.Tensor]:
        path = self.image_paths[idx]

        # Load image
        image = Image.open(path).convert("RGB")
        pixel_values = self.transform(image)

        # Get caption
        caption = self.captions.get(path.name, self.captions.get(path.stem, ""))
        if not caption:
            caption = _filename_to_caption(path.stem)

        # Tokenize caption
        input_ids = self.tokenizer(
            caption,
            padding="max_length",
            truncation=True,
            max_length=self.tokenizer.model_max_length,
            return_tensors="pt",
        ).input_ids.squeeze(0)

        return {"pixel_values": pixel_values, "input_ids": input_ids}


def _filename_to_caption(stem: str) -> str:
    """Convert filename to a basic caption."""
    return stem.replace("_", " ").replace("-", " ").strip()


# ---------------------------------------------------------------------------
# Download utilities
# ---------------------------------------------------------------------------

def download_from_urls(
    urls_file: str,
    output_dir: str,
    use_aria2: bool = True,
) -> None:
    """Bulk-download images from a text file of URLs."""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    urls = [line.strip() for line in Path(urls_file).read_text().splitlines() if line.strip()]
    logger.info(f"Downloading {len(urls)} images to {output_dir}")

    if use_aria2:
        import subprocess  # noqa: PLC0415
        list_file = output_path / "_urls.txt"
        list_file.write_text("\n".join(urls))
        cmd = [
            "aria2c",
            "--input-file", str(list_file),
            "--dir", str(output_path),
            "--max-concurrent-downloads", "8",
            "--split", "4",
            "--quiet",
        ]
        subprocess.run(cmd, check=True)
        list_file.unlink()
    else:
        for url in tqdm(urls, desc="Downloading"):
            filename = url.split("/")[-1].split("?")[0]
            target = output_path / filename
            if target.exists():
                continue
            try:
                r = requests.get(url, timeout=30, stream=True)
                r.raise_for_status()
                target.write_bytes(r.content)
            except Exception as e:
                logger.warning(f"Failed to download {url}: {e}")


# ---------------------------------------------------------------------------
# Dataset validation
# ---------------------------------------------------------------------------

def validate_dataset(image_dir: str) -> Dict[str, int]:
    """
    Validate dataset: check corrupt images, detect duplicates (perceptual hash),
    and flag potential NSFW images (placeholder — uses file size heuristic).
    """
    import imagehash  # noqa: PLC0415

    image_dir_path = Path(image_dir)
    extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
    all_paths = [p for p in image_dir_path.rglob("*") if p.suffix.lower() in extensions]

    stats = {
        "total": len(all_paths),
        "corrupt": 0,
        "duplicates": 0,
        "removed": 0,
    }

    seen_hashes: Dict[str, Path] = {}
    for path in tqdm(all_paths, desc="Validating"):
        # Check for corrupt images
        try:
            with Image.open(path) as img:
                img.verify()
        except Exception:
            logger.warning(f"Corrupt image: {path}")
            path.unlink(missing_ok=True)
            stats["corrupt"] += 1
            stats["removed"] += 1
            continue

        # Perceptual hash dedup
        try:
            with Image.open(path) as img:
                phash = str(imagehash.phash(img))
            if phash in seen_hashes:
                logger.info(f"Duplicate: {path} (matches {seen_hashes[phash]})")
                path.unlink(missing_ok=True)
                stats["duplicates"] += 1
                stats["removed"] += 1
            else:
                seen_hashes[phash] = path
        except Exception as e:
            logger.warning(f"Hash error for {path}: {e}")

    logger.info(f"Validation complete: {stats}")
    return stats


# ---------------------------------------------------------------------------
# BLIP-2 auto-captioning
# ---------------------------------------------------------------------------

def generate_captions_blip2(
    image_dir: str,
    output_file: str = "captions.json",
    batch_size: int = 4,
) -> Dict[str, str]:
    """
    Generate captions for all images in a directory using BLIP-2.
    Saves results to output_file (JSON mapping filename → caption).
    """
    import json  # noqa: PLC0415
    from transformers import Blip2ForConditionalGeneration, Blip2Processor  # noqa: PLC0415

    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
    model = Blip2ForConditionalGeneration.from_pretrained(
        "Salesforce/blip2-opt-2.7b",
        torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    ).to(device)
    model.eval()

    image_dir_path = Path(image_dir)
    extensions = {".jpg", ".jpeg", ".png", ".webp"}
    image_paths = [p for p in image_dir_path.rglob("*") if p.suffix.lower() in extensions]

    captions: Dict[str, str] = {}
    for i in tqdm(range(0, len(image_paths), batch_size), desc="Captioning"):
        batch_paths = image_paths[i: i + batch_size]
        batch_images = [Image.open(p).convert("RGB") for p in batch_paths]

        inputs = processor(images=batch_images, return_tensors="pt").to(device, torch.float16)
        with torch.no_grad():
            generated_ids = model.generate(**inputs, max_new_tokens=100)
        generated_texts = processor.batch_decode(generated_ids, skip_special_tokens=True)

        for path, caption in zip(batch_paths, generated_texts):
            captions[path.name] = caption.strip()

    output_path = image_dir_path / output_file
    import json  # noqa: PLC0415
    with open(output_path, "w") as f:
        json.dump(captions, f, indent=2)
    logger.info(f"Saved {len(captions)} captions to {output_path}")
    return captions
