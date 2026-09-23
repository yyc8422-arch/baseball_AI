"""
설정값 모음. 환경변수로 덮어쓸 수 있게 os.getenv 를 기본값과 함께 씁니다.
나중에 .env 파일 + python-dotenv 로 바꾸기도 쉬운 구조입니다.
"""
import os
from pathlib import Path

# AI-Server/ 를 기준으로 storage 폴더 경로를 잡음 (실행 위치와 무관하게 항상 같은 곳을 가리키도록)
BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings:
    UPLOAD_DIR: Path = Path(os.getenv("UPLOAD_DIR", BASE_DIR / "storage" / "uploads"))
    TEMP_DIR: Path = Path(os.getenv("TEMP_DIR", BASE_DIR / "storage" / "tmp"))
    # 분석 결과(프레임별 관절 좌표 JSON)를 저장하는 곳
    RESULT_DIR: Path = Path(os.getenv("RESULT_DIR", BASE_DIR / "storage" / "results"))

    # Colab 에서 학습한 YOLO26 Pose 모델 (AIHUB 야구 데이터, 관절 24개)
    # 다시 학습하면 이 파일만 교체하면 됩니다.
    POSE_MODEL_PATH: Path = Path(os.getenv("POSE_MODEL_PATH", BASE_DIR / "models" / "best_baseball_pose.pt"))
    # 추론 장치: "cpu" 또는 GPU 번호("0"). 이 PC 의 PyTorch 는 CPU 전용이라 기본값은 cpu
    POSE_DEVICE: str = os.getenv("POSE_DEVICE", "cpu")
    # 이 값보다 신뢰도가 낮은 사람 검출은 버림
    POSE_CONF: float = float(os.getenv("POSE_CONF", "0.25"))
    # N 프레임마다 1번 추론 (1 = 모든 프레임). CPU 에서 너무 느리면 2~3 으로 올리기
    POSE_FRAME_STRIDE: int = int(os.getenv("POSE_FRAME_STRIDE", "1"))

    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "500"))
    MAX_UPLOAD_SIZE_BYTES: int = MAX_UPLOAD_SIZE_MB * 1024 * 1024

    # 한 번에 메모리에 올릴 청크 크기. 이 값만큼씩 읽고-쓰기를 반복해서
    # 영상 전체를 한 번에 메모리에 올리지 않도록 합니다.
    CHUNK_SIZE_BYTES: int = 1024 * 1024  # 1MB

    # 프론트엔드(js/capture.js)가 검증하는 것과 동일한 허용 타입
    ALLOWED_CONTENT_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
    ALLOWED_EXTENSIONS = {".mp4", ".mov", ".webm"}


settings = Settings()
