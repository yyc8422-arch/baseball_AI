"""
BROS AI-Server 진입점.
실행: uvicorn main:app --reload --port 8000
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import video
from app.services.pose_model import load_pose_model


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버가 켜질 때 포즈 모델을 딱 한 번만 불러와 둔다 (영상마다 새로 불러오면 느림)
    load_pose_model()
    yield


app = FastAPI(title="BROS AI Video Ingest Server", lifespan=lifespan)

# 프론트엔드(Frontend/*.html)를 정적 서버 또는 file:// 로 열어서 호출하므로 CORS 를 열어둠
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: 배포 시 실제 프론트 주소로 제한
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(video.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
