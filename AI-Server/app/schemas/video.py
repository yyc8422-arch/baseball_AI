from typing import Literal

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
