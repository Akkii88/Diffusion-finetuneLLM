"""FID + CLIP-score evaluation for base vs fine-tuned model comparison."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
import torch
from PIL import Image
from tqdm import tqdm


# ---------------------------------------------------------------------------
# CLIP Score
# ---------------------------------------------------------------------------

def compute_clip_score(image: Image.Image, prompt: str) -> float:
    """Compute CLIP cosine similarity score for a single image-prompt pair."""
    import open_clip  # noqa: PLC0415

    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
    )
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)

    with torch.no_grad():
        img_tensor = preprocess(image).unsqueeze(0).to(device)
        text_tokens = tokenizer([prompt]).to(device)

        image_features = model.encode_image(img_tensor)
        text_features = model.encode_text(text_tokens)

        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        similarity = (image_features @ text_features.T).item()

    return float(similarity)


def compute_clip_score_batch(
    images: List[Image.Image], prompts: List[str]
) -> float:
    """Compute average CLIP score across a batch."""
    import open_clip  # noqa: PLC0415

    assert len(images) == len(prompts), "images and prompts must match"

    model, _, preprocess = open_clip.create_model_and_transforms(
        "ViT-B-32", pretrained="openai"
    )
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    model.eval()
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model = model.to(device)

    scores = []
    batch_size = 32
    for i in range(0, len(images), batch_size):
        batch_imgs = images[i: i + batch_size]
        batch_prompts = prompts[i: i + batch_size]

        with torch.no_grad():
            img_tensors = torch.stack([preprocess(img) for img in batch_imgs]).to(device)
            text_tokens = tokenizer(batch_prompts).to(device)

            img_features = model.encode_image(img_tensors)
            txt_features = model.encode_text(text_tokens)
            img_features = img_features / img_features.norm(dim=-1, keepdim=True)
            txt_features = txt_features / txt_features.norm(dim=-1, keepdim=True)

            sims = (img_features * txt_features).sum(dim=-1)
            scores.extend(sims.cpu().tolist())

    return float(np.mean(scores))


# ---------------------------------------------------------------------------
# Inception features for FID
# ---------------------------------------------------------------------------

def _get_inception_features(images: List[Image.Image], batch_size: int = 32) -> np.ndarray:
    """Extract Inception v3 features from a list of PIL images."""
    import torchvision.models as models  # noqa: PLC0415
    import torchvision.transforms as T  # noqa: PLC0415

    device = "cuda" if torch.cuda.is_available() else "cpu"
    inception = models.inception_v3(pretrained=True, transform_input=False)
    inception.fc = torch.nn.Identity()  # Remove final FC — use pool5 features
    inception.eval().to(device)

    transform = T.Compose([
        T.Resize((299, 299)),
        T.ToTensor(),
        T.Normalize([0.5, 0.5, 0.5], [0.5, 0.5, 0.5]),
    ])

    all_features: list[np.ndarray] = []
    for i in tqdm(range(0, len(images), batch_size), desc="Extracting features"):
        batch = images[i: i + batch_size]
        tensors = torch.stack([transform(img.convert("RGB")) for img in batch]).to(device)
        with torch.no_grad():
            feats = inception(tensors)
        all_features.append(feats.cpu().numpy())

    return np.concatenate(all_features, axis=0)


# ---------------------------------------------------------------------------
# FID computation
# ---------------------------------------------------------------------------

def compute_fid(real_features: np.ndarray, gen_features: np.ndarray) -> float:
    """Compute FID from pre-extracted Inception feature arrays."""
    from scipy import linalg  # noqa: PLC0415

    mu_real = real_features.mean(axis=0)
    mu_gen = gen_features.mean(axis=0)
    sigma_real = np.cov(real_features, rowvar=False)
    sigma_gen = np.cov(gen_features, rowvar=False)

    diff = mu_real - mu_gen
    covmean, _ = linalg.sqrtm(sigma_real @ sigma_gen, disp=False)
    if np.iscomplexobj(covmean):
        covmean = covmean.real

    fid = float(diff @ diff + np.trace(sigma_real + sigma_gen - 2.0 * covmean))
    return round(fid, 4)


# ---------------------------------------------------------------------------
# Full evaluation pipeline
# ---------------------------------------------------------------------------

def evaluate(
    real_image_dir: str,
    eval_prompts_file: str,
    base_model: str = "runwayml/stable-diffusion-v1-5",
    finetuned_model_path: Optional[str] = None,
    num_eval_images: int = 500,
    output_path: str = "./evaluation_results.json",
) -> dict:
    """
    Run full FID + CLIP evaluation comparing base model vs fine-tuned.

    Returns dict with all metric scores.
    """
    from ml.inference import InferencePipeline  # noqa: PLC0415

    # Load evaluation prompts
    prompts_path = Path(eval_prompts_file)
    if prompts_path.exists():
        eval_prompts = [line.strip() for line in prompts_path.read_text().splitlines() if line.strip()]
    else:
        eval_prompts = ["a beautiful painting in domain-specific style"] * 10
    eval_prompts = (eval_prompts * (num_eval_images // len(eval_prompts) + 1))[:num_eval_images]

    # --- Real images (from dataset) ---
    real_dir = Path(real_image_dir)
    # Support multiple extensions - glob doesn't handle brace expansion
    real_images = []
    for ext in ['*.jpg', '*.jpeg', '*.JPG', '*.JPEG', '*.png', '*.PNG']:
        real_images.extend(list(real_dir.glob(ext)))
    real_images = sorted(real_images)[:num_eval_images]
    real_images = [
        Image.open(p).convert("RGB")
        for p in real_images
    ]
    print(f"Loaded {len(real_images)} real images")
    real_features = _get_inception_features(real_images)

    # --- Base model ---
    print("Evaluating BASE model...")
    base_pipe = InferencePipeline(model_path="", base_model=base_model, device="cpu")
    base_pipe.load()
    base_images = [
        base_pipe.generate(prompt=p)["image"]
        for p in tqdm(eval_prompts, desc="Base model inference")
    ]
    base_features = _get_inception_features(base_images)
    fid_base = compute_fid(real_features, base_features)
    clip_base = compute_clip_score_batch(base_images, eval_prompts)
    del base_pipe

    # --- Fine-tuned model ---
    print("Evaluating FINE-TUNED model...")
    ft_pipe = InferencePipeline(
        model_path=finetuned_model_path or "./models/lora_weights",
        base_model=base_model,
        device="cpu",
    )
    ft_pipe.load()
    ft_images = [
        ft_pipe.generate(prompt=p)["image"]
        for p in tqdm(eval_prompts, desc="Fine-tuned inference")
    ]
    ft_features = _get_inception_features(ft_images)
    fid_ft = compute_fid(real_features, ft_features)
    clip_ft = compute_clip_score_batch(ft_images, eval_prompts)
    del ft_pipe

    results = {
        "fid_base": fid_base,
        "fid_finetuned": fid_ft,
        "clip_score_base": round(clip_base, 4),
        "clip_score_finetuned": round(clip_ft, 4),
        "num_eval_images": num_eval_images,
        "eval_timestamp": datetime.now(timezone.utc).isoformat(),
    }

    with open(output_path, "w") as f:
        json.dump(results, f, indent=2)
    print(f"Saved evaluation results to {output_path}")
    print(results)
    return results


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--real-image-dir", required=True)
    parser.add_argument("--eval-prompts-file", required=True)
    parser.add_argument("--finetuned-model-path", default="./models/lora_weights")
    parser.add_argument("--num-eval-images", type=int, default=500)
    parser.add_argument("--output", default="./evaluation_results.json")
    args = parser.parse_args()

    evaluate(
        real_image_dir=args.real_image_dir,
        eval_prompts_file=args.eval_prompts_file,
        finetuned_model_path=args.finetuned_model_path,
        num_eval_images=args.num_eval_images,
        output_path=args.output,
    )
