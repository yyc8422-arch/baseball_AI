"""
YOLO26 Pose 모델을 서버 전체에서 딱 한 번만 불러와 두고 같이 쓰는 곳.

모델 로딩은 수 초가 걸리므로 영상마다 새로 불러오지 않고, 서버가 켜질 때(main.py 의 lifespan)
load_pose_model() 로 한 번 불러온 뒤 get_pose_model() 로 꺼내 씁니다.
"""
import threading
from typing import Optional

from ultralytics import YOLO

from app.core.config import settings

# AIHUB 야구 데이터의 관절 24개 이름 (모델이 내보내는 keypoint 순서와 동일)
KEYPOINT_NAMES = [
    "head", "eye_right", "eye_left", "neck", "chest",
    "right_shoulder", "left_shoulder", "right_elbow", "left_elbow",
    "right_wrist", "left_wrist", "right_fingertips", "left_fingertips", "waist",
    "right_hip", "left_hip", "right_knee", "left_knee", "right_ankle", "left_ankle",
    "right_tiptoe", "left_tiptoe", "right_heel", "left_heel",
]

_model: Optional[YOLO] = None

# BackgroundTasks 는 여러 영상을 동시에 처리할 수 있는데, 하나의 YOLO 객체를 여러 스레드가
# 동시에 호출하면 안전하지 않으므로 추론은 한 번에 하나씩만 하도록 잠급니다.
inference_lock = threading.Lock()


def load_pose_model() -> None:
    """서버 시작 시 1번 호출. 모델 파일이 없으면 경고만 남기고 서버는 계속 뜹니다 (업로드는 가능)."""
    global _model
    if not settings.POSE_MODEL_PATH.exists():
        print(f"[AI-Server] 경고: 포즈 모델 파일이 없습니다 -> {settings.POSE_MODEL_PATH}")
        return

    model = YOLO(str(settings.POSE_MODEL_PATH))
    kpt_shape = model.model.yaml.get("kpt_shape")
    if model.task != "pose" or kpt_shape != [len(KEYPOINT_NAMES), 3]:
        raise RuntimeError(f"야구 포즈 모델이 아닙니다 (task={model.task}, kpt_shape={kpt_shape})")

    _model = model
    print(f"[AI-Server] 포즈 모델 로드 완료 -> {settings.POSE_MODEL_PATH.name} (device={settings.POSE_DEVICE})")


def get_pose_model() -> YOLO:
    if _model is None:
        # 이 메시지는 프론트 화면에 그대로 보이므로 서버 경로는 넣지 않음 (경로는 서버 시작 로그에 출력됨)
        raise RuntimeError("AI 분석 모델이 아직 준비되지 않았어요. 모델이 설치된 뒤 다시 시도해주세요.")
    return _model
