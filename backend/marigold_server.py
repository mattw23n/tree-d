"""
Simple local API server for Marigold Normals.

This runs the Hugging Face model `prs-eth/marigold-normals-v1-1` locally
using the diffusers `MarigoldNormalsPipeline` and exposes a single HTTP
endpoint that returns a normal map as a PNG (base64-encoded).

Usage (from the `python/` directory):

  1) Create and activate a virtualenv (recommended).
  2) Install dependencies:
       pip install -r requirements.txt
  3) Run the server:
       uvicorn marigold_server:app --host 127.0.0.1 --port 8000

  4) Call from your app (or curl):
       POST http://127.0.0.1:8000/marigold-normals
       JSON body: { "image_url": "https://..." }

The response will be:

  {
    "normal_map_base64": "data:image/png;base64,..."
  }

You can then plug that data URL directly into a Three.js texture loader
or into your existing `/api/ai-normal-map` route instead of Hugging Face.
"""

import io
import base64
from typing import Optional

import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

import torch
import numpy as np
from diffusers import MarigoldNormalsPipeline

_PIPELINE = None


class MarigoldRequest(BaseModel):
  image_url: str
  # Optional: future extension for strength/steps, etc.
  num_inference_steps: Optional[int] = 30
  seed: Optional[int] = None


class MarigoldResponse(BaseModel):
  normal_map_base64: str


app = FastAPI(title="Marigold Normals Local API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@torch.no_grad()
def _load_pipeline() -> MarigoldNormalsPipeline:
  """
  Lazily load the Marigold normals pipeline.
  """
  global _PIPELINE
  if _PIPELINE is not None:
    return _PIPELINE

  try:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipe = MarigoldNormalsPipeline.from_pretrained(
      "prs-eth/marigold-normals-v1-1",
      torch_dtype=torch.float16 if device == "cuda" else torch.float32,
    )
    pipe = pipe.to(device)
    _PIPELINE = pipe
    return _PIPELINE
  except Exception as e:
    print(f"Error loading pipeline: {e}")
    raise


def _fetch_image_from_url(url: str) -> Image.Image:
  """Download an image and return a PIL.Image."""
  try:
    if url.startswith("data:image"):
      # Handle Base64 Data URI
      _, encoded = url.split(",", 1)
      image_data = base64.b64decode(encoded)
      img = Image.open(io.BytesIO(image_data)).convert("RGB")
    else:
      # Handle Standard HTTP URLs
      resp = requests.get(url, timeout=15)
      resp.raise_for_status()
      img = Image.open(io.BytesIO(resp.content)).convert("RGB")
  except Exception as e:
    raise HTTPException(status_code=400, detail=f"Failed to load/parse image: {e}")

  return img


@app.post("/marigold-normals", response_model=MarigoldResponse)
@torch.no_grad()
def marigold_normals(req: MarigoldRequest) -> MarigoldResponse:
  """
  Run Marigold normals on the given image URL and return a PNG normal map
  as a data URL (base64-encoded).
  """
  img = _fetch_image_from_url(req.image_url)

  try:
    pipe = _load_pipeline()
  except Exception as e:
    raise HTTPException(status_code=500, detail=f"Failed to load model: {e}")

  try:
    generator = None
    if req.seed is not None:
      generator = torch.Generator(device=pipe.device).manual_seed(req.seed)

    # User requested 20 steps (Recommended).
    # Since we are running on GPU (RTX 4070), this will be fast.
    # Enforce min=20 even if client requests less (e.g. 10)
    steps = max(req.num_inference_steps or 20, 20)
    print(f"Running inference with {steps} steps (enforced min=20)...")

    result = pipe(
      img,
      num_inference_steps=steps,
      generator=generator,
    )
  except Exception as e:  # noqa: BLE001
    raise HTTPException(status_code=500, detail=f"Model inference failed: {e}")

  normal_img = None
  
  if hasattr(result, "prediction"):
    # Convert numpy prediction to PIL Image
    pred = result.prediction[0] # Expecting (H, W, 3)

    # Sanity check shape
    if pred.ndim == 3 and pred.shape[0] == 3:
         # Helper to fix potential NCHW output (though usually it is NHWC)
         pred = np.transpose(pred, (1, 2, 0))

    # Handle NaNs which occur during model divergence
    if np.isnan(pred).any():
        print("Warning: Prediction contains NaNs. Replacing with 0.")
        pred = np.nan_to_num(pred, nan=0.0)

    # Debug: Log prediction stats
    p_min, p_max, p_mean = pred.min(), pred.max(), pred.mean()
    print(f"Prediction stats - Min: {p_min:.4f}, Max: {p_max:.4f}, Mean: {p_mean:.4f}")
    
    # 1. Normalize based on actual data range to fix "washed out" or "white" images
    # 2. But only if the data has meaningful variance. If it's just noise, return flat blue.
    range_span = p_max - p_min
    if range_span > 0.1: # Threshold: if range is too small, it's likely failed noise
        pred = (pred - p_min) / range_span
    else:
        print("Warning: Low contrast prediction detected (failure). Returning flat normal map.")
        # Return flat normal map color (128, 128, 255) in 0-1 space -> (0.5, 0.5, 1.0)
        pred = np.ones_like(pred) * np.array([0.5, 0.5, 1.0])

    pred = np.clip(pred, 0.0, 1.0)
    pred = (pred * 255).astype(np.uint8)
    normal_img = Image.fromarray(pred)
  elif getattr(result, "images", None):
    normal_img = result.images[0]

  if normal_img is None:
    raise HTTPException(status_code=500, detail="Model returned no images or prediction")

  # Encode as PNG base64 data URL
  buf = io.BytesIO()
  normal_img.save(buf, format="PNG")
  png_bytes = buf.getvalue()
  b64 = base64.b64encode(png_bytes).decode("ascii")
  data_url = f"data:image/png;base64,{b64}"

  return MarigoldResponse(normal_map_base64=data_url)


@app.get("/health")
def health() -> dict:
  return {"status": "ok"}
