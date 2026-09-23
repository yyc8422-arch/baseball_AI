"""
프론트엔드 js/capture.js 의 handleVideoUpload() 가 아래 형태로 업로드합니다.

    const formData = new FormData();
    formData.append("video", file, file.name);
    formData.append("analysisType", analysisType);
    fetch(`${API_BASE_URL}/api/analysis`, { method: "POST", body: formData });

그 뒤 응답의 video_id 로 GET /api/analysis/{video_id} 를 주기적으로 조회해서
status 가 done / failed 가 될 때까지 기다립니다.
"""
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from app.schemas.video import AnalysisStatusResponse, AnalysisType, VideoUploadResponse
from app.services.analysis_store import load_record, save_record
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
    file_name = video.filename or ""

    # 2) 조회 API 가 바로 찾을 수 있도록 "대기 중" 레코드를 먼저 만든다
    save_record(video_id, file_name=file_name, analysis_type=analysisType, status="queued")

    # 3) 저장이 "완전히" 끝난 뒤에만 백그라운드 처리를 큐에 올린다
    background_tasks.add_task(process_video, video_id, saved_path, analysisType)

    # 4) 분석은 아직 끝나지 않았지만, 업로드 자체는 성공했으므로 바로 응답한다
    return VideoUploadResponse(
        video_id=video_id,
        file_name=file_name,
        file_size_bytes=size_bytes,
        analysis_type=analysisType,
    )


@router.get("/{video_id}", response_model=AnalysisStatusResponse, response_model_exclude_none=True)
def get_analysis(video_id: str, include_pose: bool = False):
    """
    분석 상태/결과 조회.
    프레임별 관절 좌표(pose)는 용량이 커서 기본으로는 빼고, include_pose=true 일 때만 내려줍니다.
    """
    record = load_record(video_id)
    if record is None:
        raise HTTPException(status_code=404, detail="분석 기록을 찾을 수 없습니다.")
    if not include_pose:
        record.pop("pose", None)
    return record
