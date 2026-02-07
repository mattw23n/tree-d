# Marigold normals server — Local usage

This folder provides a small FastAPI server implemented in `marigold_server.py` that runs the
Hugging Face `prs-eth/marigold-normals-v1-1` pipeline locally and returns a PNG normal map (base64
data URL).

Prerequisites
- Python 3.11 (or compatible 3.10/3.11 install)
- Recommended: virtualenv / venv
- Network access for downloading model weights from Hugging Face on first run
- Optional (GPU): NVIDIA drivers and CUDA-compatible runtime; install a CUDA-enabled `torch` wheel

Install

From the `backend/` directory:

```bash
python -m venv .venv
source .venv/bin/activate    # use `.\.venv\Scripts\activate` on Windows
pip install --upgrade pip
pip install -r requirements.txt
```

Run (development)

Start the server locally with `uvicorn`:

```bash
uvicorn marigold_server:app --host 127.0.0.1 --port 8000
```

API

- POST `/marigold-normals`
	- Request JSON body fields (Pydantic `MarigoldRequest`):
		- `image_url` (string) — required. Accepts either an HTTP(S) URL or a `data:image/...;base64,` data URI.
		- `num_inference_steps` (int, optional) — requested steps; server enforces a minimum of 20.
		- `seed` (int, optional) — seed for deterministic generation on supported devices.
	- Response (`MarigoldResponse`):
		```json
		{ "normal_map_base64": "data:image/png;base64,..." }
		```
	- Example curl (replace IMAGE_URL):
		```bash
		curl -X POST http://127.0.0.1:8000/marigold-normals \
			-H "Content-Type: application/json" \
			-d '{"image_url":"https://example.com/image.jpg"}'
		```

- GET `/health` — simple health check returning `{ "status": "ok" }`

Implementation notes (from `marigold_server.py`)

- The server lazily loads the `MarigoldNormalsPipeline` on first request; model weights are downloaded
	automatically from Hugging Face the first time the pipeline is created.
- Device selection: code uses CUDA if available (`torch.cuda.is_available()`); dtype is set to `float16`
	for CUDA and `float32` for CPU.
- The server enforces a minimum of 20 inference steps for stability and clamps output values.
- The endpoint supports both `result.prediction` (numpy array) and `result.images` outputs from the
	pipeline. Predictions are normalized, clipped to 0..1, converted to 8-bit and encoded as PNG.
- The server handles `data:` URIs and HTTP(S) URLs for input images.

Error handling and diagnostics

- If image download or parsing fails the endpoint returns HTTP 400 with a helpful message.
- Model loading or inference errors return HTTP 500.
- The server logs prediction statistics (min/max/mean) and warns about NaNs or low-contrast outputs.

GPU notes

- For GPU usage ensure `torch` is installed with the appropriate CUDA support for your GPU and drivers.
- On CUDA the code moves the pipeline to `pipe.device` and uses `torch.Generator(device=pipe.device)`
	when a `seed` is provided.

## Built For

PINUS Hack 2026

## License

MIT