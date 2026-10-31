import os
import tempfile
import threading
from contextlib import asynccontextmanager

import cv2
import librosa
import numpy as np
import open_clip
import torch

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from PIL import Image
from sentence_transformers import SentenceTransformer
from transformers import ClapModel, ClapProcessor


# ============================================================
# CONFIGURATION
# ============================================================

MODEL_NAME = "ViT-B-32"
PRETRAINED = "laion2b_s34b_b79k"

TEXT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
AUDIO_MODEL_NAME = "laion/clap-htsat-unfused"

FRAME_COUNT = 12
DEVICE = "cpu"

AUDIO_SAMPLE_RATE = 48000
AUDIO_SEGMENT_SECONDS = 10
AUDIO_HOP_SECONDS = 5
MAX_AUDIO_DURATION_SECONDS = 1800  # 30 minutes
MAX_AUDIO_SEGMENTS = 360

# Existing OpenCLIP model
model = None
preprocess = None

# Lazy-loaded models
text_model = None
clap_model = None
clap_processor = None

text_model_lock = threading.Lock()
audio_model_lock = threading.Lock()


# ============================================================
# APPLICATION LIFECYCLE
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    global model, preprocess

    print(f"Loading {MODEL_NAME} on {DEVICE}...")

    model, _, preprocess = open_clip.create_model_and_transforms(
        MODEL_NAME,
        pretrained=PRETRAINED,
    )

    model = model.to(DEVICE)
    model.eval()

    print("TrueAuthor image and video AI model loaded successfully.")
    print("Document and audio AI models will load only when requested.")

    yield

    print("TrueAuthor AI service stopped.")


app = FastAPI(
    title="TrueAuthor Local AI",
    version="1.3.0",
    lifespan=lifespan,
)


# ============================================================
# REQUEST MODELS
# ============================================================

class AnalyzePathRequest(BaseModel):
    path: str


class CompareImagesRequest(BaseModel):
    path_a: str
    path_b: str


class AnalyzeTextRequest(BaseModel):
    text: str = Field(min_length=1, max_length=100000)


# ============================================================
# DOCUMENT AI - SENTENCE TRANSFORMERS
# ============================================================

def get_text_model():
    global text_model

    if text_model is None:
        with text_model_lock:
            if text_model is None:
                print(f"Loading document AI model: {TEXT_MODEL_NAME}")
                text_model = SentenceTransformer(
                    TEXT_MODEL_NAME,
                    device=DEVICE,
                )
                print("Document AI model loaded successfully.")

    return text_model


@app.post("/analyze-text")
def analyze_text(request: AnalyzeTextRequest):
    content = request.text.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Document text cannot be empty.",
        )

    try:
        document_model = get_text_model()

        embedding = document_model.encode(
            content,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )

        return {
            "model": TEXT_MODEL_NAME,
            "device": DEVICE,
            "dimensions": int(len(embedding)),
            "embedding": embedding.astype(float).tolist(),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Document AI analysis failed: {error}",
        ) from error


# ============================================================
# AUDIO AI - CLAP
# ============================================================

def get_audio_model():
    global clap_model, clap_processor

    if clap_model is None or clap_processor is None:
        with audio_model_lock:
            if clap_model is None or clap_processor is None:
                print(f"Loading audio AI model: {AUDIO_MODEL_NAME}")

                clap_processor = ClapProcessor.from_pretrained(
                    AUDIO_MODEL_NAME
                )

                clap_model = ClapModel.from_pretrained(
                    AUDIO_MODEL_NAME
                ).to(DEVICE)

                clap_model.eval()

                print("CLAP audio AI model loaded successfully.")

    return clap_model, clap_processor




def embed_audio_segment(audio_segment: np.ndarray):
    audio_model, processor = get_audio_model()

    inputs = processor(
        audio=audio_segment,
        sampling_rate=AUDIO_SAMPLE_RATE,
        return_tensors="pt",
        padding=True,
    )

    inputs = {
        key: value.to(DEVICE) if hasattr(value, "to") else value
        for key, value in inputs.items()
    }

    with torch.inference_mode():
        outputs = audio_model.get_audio_features(**inputs)

        if isinstance(outputs, torch.Tensor):
            features = outputs

        elif getattr(outputs, "audio_embeds", None) is not None:
            features = outputs.audio_embeds

        elif getattr(outputs, "pooler_output", None) is not None:
            # Use the returned pooled features directly.
            # Do not apply audio_projection a second time.
            features = outputs.pooler_output

        else:
            raise ValueError(
                "CLAP did not return usable audio features."
            )

        if features.ndim == 1:
            features = features.unsqueeze(0)

        features = features / features.norm(
            dim=-1,
            keepdim=True
        ).clamp(min=1e-12)

    return features[0].cpu().numpy().astype(float)


def analyze_audio_file(audio_path: str):
    if not os.path.isfile(audio_path):
        raise ValueError(
            "Audio path does not exist on the AI service machine."
        )

    # Load mono audio at CLAP's expected sample rate.
    waveform, sample_rate = librosa.load(
        audio_path,
        sr=AUDIO_SAMPLE_RATE,
        mono=True,
    )

    if waveform.size == 0:
        raise ValueError("The audio file contains no readable audio.")

    duration = len(waveform) / AUDIO_SAMPLE_RATE

    if duration > MAX_AUDIO_DURATION_SECONDS:
        raise ValueError(
            f"Audio is too long. Maximum supported duration is "
            f"{MAX_AUDIO_DURATION_SECONDS // 60} minutes."
        )

    segment_samples = AUDIO_SEGMENT_SECONDS * AUDIO_SAMPLE_RATE
    hop_samples = AUDIO_HOP_SECONDS * AUDIO_SAMPLE_RATE

    if len(waveform) <= segment_samples:
        starts = [0]
    else:
        starts = list(range(0, len(waveform) - segment_samples + 1, hop_samples))

        # Include the final segment so the end of the recording is represented.
        final_start = max(0, len(waveform) - segment_samples)
        if starts[-1] != final_start:
            starts.append(final_start)

    if len(starts) > MAX_AUDIO_SEGMENTS:
        raise ValueError(
            f"Audio creates too many analysis segments "
            f"({len(starts)}). Maximum is {MAX_AUDIO_SEGMENTS}."
        )

    results = []

    for segment_number, start in enumerate(starts):
        end = min(start + segment_samples, len(waveform))
        segment = waveform[start:end]

        # CLAP expects a 10-second audio input. Pad the final short segment.
        if len(segment) < segment_samples:
            segment = np.pad(
                segment,
                (0, segment_samples - len(segment)),
                mode="constant",
            )

        embedding = embed_audio_segment(segment)

        results.append({
            "segmentIndex": segment_number,
            "startSeconds": round(start / AUDIO_SAMPLE_RATE, 3),
            "endSeconds": round(end / AUDIO_SAMPLE_RATE, 3),
            "embedding": embedding.tolist(),
        })

    return {
        "model": AUDIO_MODEL_NAME,
        "device": DEVICE,
        "sampleRate": AUDIO_SAMPLE_RATE,
        "durationSeconds": round(duration, 3),
        "segmentDurationSeconds": AUDIO_SEGMENT_SECONDS,
        "segmentHopSeconds": AUDIO_HOP_SECONDS,
        "segments": results,
    }


@app.post("/analyze-audio-path")
def analyze_audio_path(request: AnalyzePathRequest):
    try:
        return analyze_audio_file(os.path.abspath(request.path))

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Audio analysis failed: {error}",
        ) from error


@app.post("/analyze-audio")
async def analyze_audio(file: UploadFile = File(...)):
    filename = file.filename or "audio.wav"
    extension = os.path.splitext(filename)[1].lower()

    allowed = {
        ".wav", ".mp3", ".m4a", ".aac", ".flac",
        ".ogg", ".opus", ".wma", ".aiff", ".aif",
    }

    if extension not in allowed:
        raise HTTPException(
            status_code=400,
            detail="Unsupported audio format.",
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

        return analyze_audio_file(temp_path)

    except HTTPException:
        raise

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Audio analysis failed: {error}",
        ) from error

    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# VIDEO FRAME EXTRACTION - EXISTING FUNCTIONALITY
# ============================================================

def extract_frames(video_path: str):
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

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frames.append((int(index), Image.fromarray(rgb)))

    finally:
        capture.release()

    if not frames:
        raise ValueError("Unable to extract video frames.")

    return frames, total_frames


def embed_frames(frames):
    tensors = [preprocess(image) for _, image in frames]
    batch = torch.stack(tensors).to(DEVICE)

    with torch.inference_mode():
        features = model.encode_image(batch)
        features = features / features.norm(dim=-1, keepdim=True)

    return features.cpu().numpy()


def analyze_path(video_path: str):
    if not os.path.isfile(video_path):
        raise ValueError(
            "Video path does not exist on the AI service machine."
        )

    frames, total_frames = extract_frames(video_path)
    embeddings = embed_frames(frames)

    return {
        "model": MODEL_NAME,
        "device": DEVICE,
        "totalFrames": total_frames,
        "analyzedFrames": len(frames),
        "frames": [
            {
                "frameIndex": frame_index,
                "embedding": vector.astype(float).tolist(),
            }
            for (frame_index, _), vector in zip(frames, embeddings)
        ],
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():
    return {
        "status": "ready",
        "model": MODEL_NAME,
        "device": DEVICE,
        "documentModel": TEXT_MODEL_NAME,
        "documentModelLoaded": text_model is not None,
        "audioModel": AUDIO_MODEL_NAME,
        "audioModelLoaded": (
            clap_model is not None and clap_processor is not None
        ),
    }


# ============================================================
# IMAGE ANALYSIS - EXISTING OPENCLIP FUNCTIONALITY
# ============================================================

@app.post("/analyze-image-path")
def analyze_image_path(request: AnalyzePathRequest):
    image_path = os.path.abspath(request.path)

    if not os.path.isfile(image_path):
        raise HTTPException(
            status_code=400,
            detail="Image path does not exist on the AI service machine.",
        )

    try:
        with Image.open(image_path) as source:
            image = source.convert("RGB")
            tensor = preprocess(image).unsqueeze(0).to(DEVICE)

        with torch.inference_mode():
            features = model.encode_image(tensor)
            features = features / features.norm(dim=-1, keepdim=True)

        return {
            "model": MODEL_NAME,
            "device": DEVICE,
            "embedding": (
                features[0].cpu().numpy().astype(float).tolist()
            ),
        }

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Image analysis failed: {error}",
        ) from error


@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    suffix = (
        os.path.splitext(file.filename or "image.png")[1].lower()
        or ".png"
    )

    temp_path = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix,
            delete=False,
        ) as temp:
            temp_path = temp.name

            while True:
                chunk = await file.read(1024 * 1024)

                if not chunk:
                    break

                temp.write(chunk)

        return analyze_image_path(
            AnalyzePathRequest(path=temp_path)
        )

    finally:
        await file.close()

        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


# ============================================================
# IMAGE FEATURE EXTRACTION - EXISTING ORB FUNCTIONALITY
# ============================================================

def extract_orb_features(image_path: str):
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)

    if image is None:
        raise ValueError("Could not read image.")

    orb = cv2.ORB_create(
        nfeatures=2500,
        scaleFactor=1.2,
        nlevels=8,
        edgeThreshold=15,
        fastThreshold=10,
    )

    keypoints, descriptors = orb.detectAndCompute(image, None)

    return keypoints, descriptors


def compare_image_features(image_path_a: str, image_path_b: str):
    keypoints_a, descriptors_a = extract_orb_features(image_path_a)
    keypoints_b, descriptors_b = extract_orb_features(image_path_b)

    empty = {
        "featureScore": 0.0,
        "goodMatches": 0,
        "inlierMatches": 0,
        "inlierRatio": 0.0,
        "verifiedCopy": False,
    }

    if (
        descriptors_a is None
        or descriptors_b is None
        or len(keypoints_a) < 8
        or len(keypoints_b) < 8
    ):
        return empty

    matcher = cv2.BFMatcher(cv2.NORM_HAMMING)
    pairs = matcher.knnMatch(descriptors_a, descriptors_b, k=2)

    good_matches = [
        first
        for pair in pairs if len(pair) == 2
        for first, second in [pair]
        if first.distance < 0.72 * second.distance
    ]

    if len(good_matches) < 8:
        result = dict(empty)
        result["goodMatches"] = len(good_matches)
        return result

    points_a = np.float32([
        keypoints_a[m.queryIdx].pt for m in good_matches
    ]).reshape(-1, 1, 2)

    points_b = np.float32([
        keypoints_b[m.trainIdx].pt for m in good_matches
    ]).reshape(-1, 1, 2)

    _, mask = cv2.findHomography(
        points_a,
        points_b,
        cv2.RANSAC,
        4.0,
    )

    inlier_count = int(mask.ravel().sum()) if mask is not None else 0
    inlier_ratio = inlier_count / len(good_matches)

    feature_score = (
        min(100.0, inlier_count * 2.0)
        * min(1.0, inlier_ratio / 0.7)
    )

    return {
        "featureScore": round(feature_score, 2),
        "goodMatches": len(good_matches),
        "inlierMatches": inlier_count,
        "inlierRatio": round(inlier_ratio, 4),
        "verifiedCopy": (
            inlier_count >= 15 and inlier_ratio >= 0.45
        ),
    }


@app.post("/compare-images")
def compare_images(request: CompareImagesRequest):
    path_a = os.path.abspath(request.path_a)
    path_b = os.path.abspath(request.path_b)

    if not os.path.isfile(path_a) or not os.path.isfile(path_b):
        raise HTTPException(
            status_code=400,
            detail=(
                "One or both image paths do not exist "
                "on the AI service machine."
            ),
        )

    try:
        return compare_image_features(path_a, path_b)

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Image comparison failed: {error}",
        ) from error


# ============================================================
# VIDEO ANALYSIS - EXISTING OPENCLIP FUNCTIONALITY
# ============================================================

@app.post("/analyze-video-path")
def analyze_video_path(request: AnalyzePathRequest):
    try:
        return analyze_path(os.path.abspath(request.path))

    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Video analysis failed: {error}",
        ) from error


@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    filename = file.filename or "video"
    extension = os.path.splitext(filename)[1].lower()

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

        return analyze_path(temp_path)

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
