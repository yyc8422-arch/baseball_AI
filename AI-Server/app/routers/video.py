"""
프론트엔드 js/capture.js 의 handleVideoUpload() 가 이미 아래 형태로 보낼 준비가 되어 있습니다.

    const formData = new FormData();
    formData.append("video", file, file.name);
    formData.append("analysisType", analysisType);
    fetch("/api/analysis", { method: "POST", body: formData });

그래서 이 라우터의 경로/필드명을 그 값과 똑같이 맞췄습니다.
"""
from fastapi import APIRouter, BackgroundTasks, File, Form, UploadFile

from app.schemas.video import AnalysisType, VideoUploadResponse
from app.services.video_processor import process_video
from app.services.video_storage import save_upload_safely

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


@router.post("", response_model=VideoUploadResponse)
async def upload_video(
    background_tasks: BackgroundTasks,
    video: UploadFile = File(...),
    analysisType: AnalysisType = Form(...),
):
    # 1) 저장부터 안전하게 끝낸다 (용량 초과/형식 오류면 여기서 예외로 즉시 응답)
    video_id, saved_path, size_bytes = await save_upload_safely(video)

    # 2) 저장이 "완전히" 끝난 뒤에만 백그라운드 처리를 큐에 올린다
    background_tasks.add_task(process_video, video_id, saved_path, analysisType)

    # 3) 분석은 아직 끝나지 않았지만, 업로드 자체는 성공했으므로 바로 응답한다
    return VideoUploadResponse(
        video_id=video_id,
        file_name=video.filename or "",
        file_size_bytes=size_bytes,
        analysis_type=analysisType,
    )
