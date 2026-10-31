
import os
import tempfile
from contextlib import asynccontextmanager

import cv2
import numpy as np
import open_clip
import torch

from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image

MODEL_NAME = "ViT-B-32"
PRETRAINED = "laion2b_s34b_b79k"
FRAME_COUNT = 12

device = "cpu"
model = None
preprocess = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, preprocess

    print(f"Loading {MODEL_NAME} on {device}...")

    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME,
        pretrained=PRETRAINED,
    )

    model = model.to(device)
    model.eval()

    print("TrueAuthor AI model loaded successfully.")
    yield


app = FastAPI(
    title="TrueAuthor Local AI",
    version="1.0.0",
    lifespan=lifespan,
)


def extract_frames(video_path):
    capture = cv2.VideoCapture(video_path)

    if not capture.isOpened():
        raise ValueError("Could not open the video.")

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))

    if total_frames <= 0:
        capture.release()
        raise ValueError("The video has no readable frames.")

    indices = np.linspace(
        0,
        total_frames - 1,
        num=min(FRAME_COUNT, total_frames),
        dtype=int,
    )

    frames = []

    try:
        for index in indices:
            capture.set(cv2.CAP_PROP_POS_FRAMES, int(index))
            success, frame = capture.read()

            if not success:
                continue

            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append((int(index), Image.fromarray(frame)))
    finally:
        capture.release()

    if not frames:
        raise ValueError("Unable to extract video frames.")

    return frames, total_frames


def embed_frames(frames):
    tensors = [preprocess(image) for _, image in frames]
    batch = torch.stack(tensors)

    with torch.inference_mode():
        features = model.encode_image(batch)
        features = features / features.norm(
            dim=-1,
            keepdim=True,
        )

    return features.cpu().numpy()


@app.get("/health")
def health():
    return {
        "status": "ready",
        "model": MODEL_NAME,
        "device": device,
    }


@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    extension = os.path.splitext(file.filename or "")[1].lower()

    allowed = {".mp4", ".mov", ".webm", ".avi", ".mkv"}

    if extension not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Unsupported video format.",
        )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=extension,
            delete=False,
        ) as temp:
            temp_path = temp.name

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                temp.write(chunk)

        frames, total_frames = extract_frames(temp_path)
        embeddings = embed_frames(frames)

        return {
            "filename": file.filename,
            "model": MODEL_NAME,
            "device": device,
            "totalFrames": total_frames,
            "analyzedFrames": len(frames),
            "frames": [
                {
                    "frameIndex": index,
                    "embedding": vector.astype(float).tolist(),
                }
                for (index, _), vector in zip(frames, embeddings)
            ],
        }

    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Video analysis failed: {error}",
        ) from error
    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
