"""Brief2Reel — LTX-Video Inference Microservice for Azure Container Apps GPU.

Exposes REST API endpoints:
  - GET  /health   -> Check GPU status and pipeline readiness
  - POST /generate -> Generate 10s portrait reel (720x1280 @ 24fps) and upload to Azure Blob Storage
"""

import os
import time
import uuid
import logging
from typing import Optional
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from azure.storage.blob import BlobServiceClient

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("brief2reel-inference")

# Environment Variables
MODEL_NAME = os.getenv("MODEL_NAME", "Lightricks/LTX-Video")
API_KEY = os.getenv("API_KEY", "")
AZURE_STORAGE_CONNECTION_STRING = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
AZURE_STORAGE_CONTAINER = os.getenv("AZURE_STORAGE_CONTAINER", "generated-videos")

# Global pipeline instance
pipe = None
blob_service_client = None


def load_pipeline():
    global pipe
    if pipe is not None:
        return pipe

    logger.info(f"Loading pipeline for {MODEL_NAME}...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if device == "cuda" else torch.float32

    try:
        from diffusers import LTXPipeline
        pipe = LTXPipeline.from_pretrained(
            MODEL_NAME,
            torch_dtype=dtype,
        )
        if device == "cuda":
            pipe.to("cuda")
            logger.info("Pipeline loaded on CUDA (GPU acceleration active)")
        else:
            logger.warning("CUDA not available! Pipeline running on CPU.")
    except Exception as e:
        logger.error(f"Failed to load pipeline: {e}")
        raise e

    return pipe


@asynccontextmanager
async def lifespan(app: FastAPI):
    global blob_service_client
    logger.info("Starting Brief2Reel Inference Microservice...")
    if AZURE_STORAGE_CONNECTION_STRING:
        try:
            blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING)
            logger.info("Azure Blob Storage client initialized successfully.")
        except Exception as e:
            logger.warning(f"Could not initialize Blob Storage client: {e}")
    # Load model on startup
    try:
        load_pipeline()
    except Exception as e:
        logger.error(f"Startup model load warning: {e}")
    yield
    logger.info("Shutting down Brief2Reel Inference Microservice.")


app = FastAPI(
    title="Brief2Reel Video Inference Microservice",
    description="High-performance AI video generation microservice running LTX-Video on Azure Serverless GPU",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_key(authorization: Optional[str] = Header(None)):
    """Authenticate incoming requests using Bearer API token."""
    if not API_KEY:
        # If API_KEY is not configured, permit requests in dev mode
        return True
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Use 'Bearer <key>'",
        )
    token = parts[1]
    if token != API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API key",
        )
    return True


class VideoGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Visual scene description for the reel")
    negative_prompt: Optional[str] = Field("blurry, low quality, distorted, artifacts", description="Negative prompt")
    idempotency_key: Optional[str] = Field(None, description="Unique client idempotency key")
    width: int = Field(720, description="Video width in pixels (portrait 720p)")
    height: int = Field(1280, description="Video height in pixels (portrait 720p)")
    fps: int = Field(24, description="Frames per second")
    num_frames: int = Field(241, description="Total frame count (241 frames @ 24fps = 10s)")
    duration_seconds: int = Field(10, description="Duration in seconds")
    num_steps: int = Field(30, description="Diffusion inference steps")
    guidance_scale: float = Field(3.0, description="Classifier-free guidance scale")
    seed: int = Field(-1, description="Random seed (-1 for dynamic)")


class VideoGenerationResponse(BaseModel):
    job_id: str
    status: str
    video_url: str
    blob_name: str
    duration_seconds: int
    fps: int
    num_frames: int
    generation_time_ms: int
    model: str


@app.get("/health")
def health_check():
    """Health check endpoint for Azure Container Apps liveness probe."""
    gpu_available = torch.cuda.is_available()
    gpu_name = torch.cuda.get_device_name(0) if gpu_available else "None"
    return {
        "status": "healthy",
        "service": "brief2reel-video-inference",
        "model": MODEL_NAME,
        "gpu_available": gpu_available,
        "gpu_device": gpu_name,
        "pipeline_loaded": pipe is not None,
    }


@app.post("/generate", response_model=VideoGenerationResponse, dependencies=[Depends(verify_api_key)])
async def generate_video_endpoint(req: VideoGenerationRequest):
    """Generate a video and upload it to Azure Blob Storage."""
    start_time = time.time()
    job_id = req.idempotency_key or str(uuid.uuid4())
    logger.info(f"Starting video generation job {job_id} | Prompt: {req.prompt[:60]}...")

    pipeline = load_pipeline()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    # Set random seed
    actual_seed = req.seed if req.seed >= 0 else int.from_bytes(os.urandom(4), "big") % (2**32)
    generator = torch.Generator(device=device).manual_seed(actual_seed)

    # Execute diffusion pipeline
    try:
        output = pipeline(
            prompt=req.prompt,
            negative_prompt=req.negative_prompt,
            width=req.width,
            height=req.height,
            num_frames=req.num_frames,
            num_inference_steps=req.num_steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
            output_type="pt",
        )
    except Exception as e:
        logger.error(f"Inference execution failed: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

    # Export to local MP4
    from diffusers.utils import export_to_video
    local_output_path = f"/tmp/{job_id}.mp4"
    try:
        export_to_video(output.frames[0], local_output_path, fps=req.fps)
    except Exception as e:
        logger.error(f"Video export failed: {e}")
        raise HTTPException(status_code=500, detail=f"MP4 encoding failed: {str(e)}")

    # Upload to Azure Blob Storage
    blob_name = f"reels/{job_id}.mp4"
    video_url = ""

    if blob_service_client:
        try:
            container_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER)
            blob_client = container_client.get_blob_client(blob_name)
            with open(local_output_path, "rb") as data:
                blob_client.upload_blob(data, overwrite=True)
            video_url = blob_client.url
            logger.info(f"Video uploaded to Azure Blob: {video_url}")
        except Exception as e:
            logger.error(f"Failed to upload to Azure Blob Storage: {e}")
            video_url = f"/local/{job_id}.mp4"
    else:
        video_url = f"/local/{job_id}.mp4"

    # Cleanup local temp file
    if os.path.exists(local_output_path):
        os.remove(local_output_path)

    elapsed_ms = int((time.time() - start_time) * 1000)
    logger.info(f"Job {job_id} completed in {elapsed_ms / 1000:.1f}s")

    return VideoGenerationResponse(
        job_id=job_id,
        status="completed",
        video_url=video_url,
        blob_name=blob_name,
        duration_seconds=req.duration_seconds,
        fps=req.fps,
        num_frames=req.num_frames,
        generation_time_ms=elapsed_ms,
        model=MODEL_NAME,
    )
