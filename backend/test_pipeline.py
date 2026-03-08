import os
import sys
from dotenv import load_dotenv

load_dotenv(".env.backend")

try:
    from ml.inference import InferencePipeline
    pipeline = InferencePipeline(
        model_path=os.getenv("MODEL_PATH", "./models/lora_weights"),
        base_model=os.getenv("BASE_MODEL", "runwayml/stable-diffusion-v1-5"),
        device=os.getenv("DEVICE", "cuda"),
    )
    pipeline.load()
    print("Pipeline loaded successfully.")
except Exception as e:
    import traceback
    traceback.print_exc()
