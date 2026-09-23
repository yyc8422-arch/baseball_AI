from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel

# 프론트엔드(js/capture.js)의 ANALYSIS_TYPES 와 동일한 값만 허용
AnalysisType = Literal["pitching", "batting", "highlight"]


class VideoUploadResponse(BaseModel):
    """업로드 성공 시 프론트엔드로 돌려줄 응답. 분석은 아직 끝나지 않았으므로 status="queued"."""

    video_id: str
    file_name: str
    file_size_bytes: int
    analysis_type: AnalysisType
    status: Literal["queued"] = "queued"


AnalysisStatus = Literal["queued", "processing", "done", "failed"]


class AnalysisSummary(BaseModel):
    """분석 완료 시 간단한 통계 (전체 관절 좌표는 include_pose=true 로 요청할 때만 내려줌)"""

    fps: float
    total_frames: int
    analyzed_frames: int
    detected_frames: int  # 선수가 검출된 프레임 수


class AnalysisStatusResponse(BaseModel):
    """GET /api/analysis/{video_id} 응답. 프론트엔드가 이 status 를 주기적으로 조회합니다."""

    video_id: str
    file_name: str
    analysis_type: AnalysisType
    status: AnalysisStatus
    created_at: str
    updated_at: str
    elapsed_sec: Optional[float] = None
    error: Optional[str] = None
    summary: Optional[AnalysisSummary] = None
    pose: Optional[Dict[str, Any]] = None
