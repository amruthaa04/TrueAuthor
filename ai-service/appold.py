
import os
from pathlib import Path
from typing import Optional

import numpy as np
import open_clip
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="TrueAuthor AI Similarity Service")

DEVICE = "cpu"

# Existing video/image model
clip_model, _, clip_preprocess = open_clip.create_model_and_transforms(
    "ViT-B-32",
    pretrained="laion2b_s34b_b79k",
    device=DEVICE,
)
clip_model.eval()

# New semantic text model
text_model = SentenceTransformer(
    "sentence-transformers/all-MiniLM-L6-v2",
    device=DEVICE,
)


class TextRequest(BaseModel):
    text: str


class TextPathRequest(BaseModel):
    path: str


def normalize_embedding(embedding):
    embedding = embedding.detach().cpu().numpy().astype(np.float32)
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm
    return embedding.tolist()


def encode_image(image: Image.Image):
    image_tensor = clip_preprocess(image.convert("RGB")).unsqueeze(0)
    with torch.no_grad():
        embedding = clip_model.encode_image(image_tensor)
    return normalize_embedding(embedding[0])


def encode_text(text: str):
    if not text or not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    embedding = text_model.encode(
        text,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return embedding.astype(np.float32).tolist()


def read_local_image(path: str):
    image_path = Path(path).resolve()

    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image file not found.")

    try:
        with Image.open(image_path) as image:
            image.load()
            return image.copy()
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read image: {exc}",
        )


@app.get("/health")
def health():
    return {
        "status": "ready",
        "model": "ViT-B-32 + all-MiniLM-L6-v2",
        "device": DEVICE,
    }


# Existing video endpoint: keep compatible with the Node backend.
@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    suffix = Path(file.filename or "video.mp4").suffix or ".mp4"
    temp_path = None

    try:
        import tempfile

        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded video is empty.")

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp:
            temp.write(content)
            temp_path = temp.name

        return analyze_video_file(temp_path)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# Existing video endpoint: the backend can provide a local upload path.
@app.post("/analyze-video-path")
def analyze_video_path(request: TextPathRequest):
    return analyze_video_file(request.path)


def analyze_video_file(path: str):
    import cv2

    video_path = Path(path).resolve()
    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Video file not found.")

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise HTTPException(status_code=400, detail="Could not open video.")

    embeddings = []
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = capture.get(cv2.CAP_PROP_FPS)

    # Sample up to roughly 12 frames across the video.
    sample_count = min(12, max(1, frame_count))
    positions = (
        np.linspace(0, max(frame_count - 1, 0), sample_count).astype(int)
        if frame_count > 0
        else [0]
    )

    try:
        for position in positions:
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(position))
            ok, frame = capture.read()
            if not ok:
                continue

            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            image = Image.fromarray(frame_rgb)
            image_tensor = clip_preprocess(image).unsqueeze(0)

            with torch.no_grad():
                embedding = clip_model.encode_image(image_tensor)

            embeddings.append(normalize_embedding(embedding[0]))
    finally:
        capture.release()

    if not embeddings:
        raise HTTPException(
            status_code=400,
            detail="No readable frames found in video.",
        )

    return {
        "embeddings": embeddings,
        "frame_count": frame_count,
        "sampled_frames": len(embeddings),
        "fps": fps if fps and np.isfinite(fps) else None,
        "model": "ViT-B-32",
    }


# New: upload an image for AI analysis.
@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        import io

        with Image.open(io.BytesIO(content)) as image:
            image.load()
            embedding = encode_image(image.copy())

        return {"embedding": embedding, "model": "ViT-B-32"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Image analysis failed: {exc}")


# New: analyze an image at a local path.
@app.post("/analyze-image-path")
def analyze_image_path(request: TextPathRequest):
    image = read_local_image(request.path)
    return {"embedding": encode_image(image), "model": "ViT-B-32"}


# New: create a semantic embedding for submitted text.
@app.post("/analyze-text")
def analyze_text(request: TextRequest):
    return {
        "embedding": encode_text(request.text),
        "model": "all-MiniLM-L6-v2",
    }


# New: create a semantic embedding for text read from a local text file.
@app.post("/analyze-text-path")
def analyze_text_path(request: TextPathRequest):
    file_path = Path(request.path).resolve()

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Text file not found.")

    try:
        text = file_path.read_text(encoding="utf-8", errors="replace")
        return {
            "embedding": encode_text(text),
            "model": "all-MiniLM-L6-v2",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Text analysis failed: {exc}")
