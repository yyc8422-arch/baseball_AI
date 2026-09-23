"""
저장이 끝난 영상을 실제로 "분석"하는 자리.

지금은 1단계로, 영상을 프레임 단위로 읽어서 YOLO26 Pose 모델로 선수의 관절 24개 좌표를 뽑고
storage/results/<video_id>.json 에 저장합니다.
이 좌표로 각도/개선 포인트를 계산하는 "자세 분석" 로직은 다음 단계에서 이 결과를 이용해 붙입니다.
"""
import json
import time
from pathlib import Path
from typing import Optional

import cv2

from app.core.config import settings
from app.services.pose_model import KEYPOINT_NAMES, get_pose_model, inference_lock


def _save_result(video_id: str, result: dict) -> Path:
    """결과 JSON 을 임시 파일에 다 쓴 뒤 이름을 바꿔서, 반쯤 쓰인 파일을 읽는 일이 없도록 합니다."""
    settings.RESULT_DIR.mkdir(parents=True, exist_ok=True)
    final_path = settings.RESULT_DIR / f"{video_id}.json"
    temp_path = settings.RESULT_DIR / f"{video_id}.json.part"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)
    temp_path.replace(final_path)
    return final_path


def _extract_main_player(pred) -> Optional[dict]:
    """
    한 프레임의 예측 결과에서 분석 대상 선수 1명을 고릅니다.
    화면에 여러 명이 잡히면 신뢰도가 가장 높은 사람을 대상으로 봅니다.
    """
    if pred.boxes is None or len(pred.boxes) == 0:
        return None

    best = int(pred.boxes.conf.argmax())
    x1, y1, x2, y2 = pred.boxes.xyxy[best].tolist()
    # keypoints.data: [사람 수, 24, 3] -> (x 픽셀, y 픽셀, 관절 신뢰도)
    keypoints = pred.keypoints.data[best].tolist()

    return {
        "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
        "confidence": round(float(pred.boxes.conf[best]), 4),
        "keypoints": [[round(x, 1), round(y, 1), round(c, 4)] for x, y, c in keypoints],
    }


def extract_pose_sequence(file_path: Path) -> dict:
    """영상 전체를 프레임 단위로 읽으며 각 프레임의 선수 관절 좌표를 뽑습니다."""
    model = get_pose_model()

    cap = cv2.VideoCapture(str(file_path))
    if not cap.isOpened():
        raise RuntimeError(f"영상을 열 수 없습니다: {file_path.name}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    frames = []
    frame_index = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_index % settings.POSE_FRAME_STRIDE == 0:
                with inference_lock:
                    pred = model.predict(
                        frame, conf=settings.POSE_CONF, device=settings.POSE_DEVICE, verbose=False
                    )[0]
                frames.append({
                    "frame_index": frame_index,
                    "time_sec": round(frame_index / fps, 3),
                    # 선수가 안 잡힌 프레임은 null (프론트/분석 로직에서 건너뛰면 됨)
                    "player": _extract_main_player(pred),
                })
            frame_index += 1
    finally:
        cap.release()

    return {
        "fps": round(fps, 3),
        "width": width,
        "height": height,
        "total_frames": frame_index,
        "frame_stride": settings.POSE_FRAME_STRIDE,
        "keypoint_names": KEYPOINT_NAMES,
        "frames": frames,
    }


def process_video(video_id: str, file_path: Path, analysis_type: str) -> None:
    """
    라우터의 BackgroundTasks 가 응답을 보낸 "이후"에 호출하는 함수.
    (요청자는 이 함수가 끝나길 기다리지 않고, 업로드 응답을 바로 받습니다.)

    결과는 성공/실패와 관계없이 storage/results/<video_id>.json 에 status 와 함께 남깁니다.
      - 성공: {"status": "done", "pose": {...프레임별 관절 좌표...}}
      - 실패: {"status": "failed", "error": "..."}

    TODO 다음 단계:
      1) pose 결과로 관절 각도/개선 포인트를 계산하는 자세 분석 로직 (analysis_type 별)
      2) GET /api/analysis/{video_id} 로 이 결과를 조회하는 API

    참고: 지금은 FastAPI 의 BackgroundTasks 를 쓰는데, 이건 "같은 프로세스 안에서,
    응답을 보낸 뒤" 실행되는 가벼운 방식입니다. 실제 AI 추론이 무겁고 오래 걸린다면
    Celery + Redis/RabbitMQ 같은 별도 워커 큐로 바꾸는 걸 추천합니다 (지금 구조를
    바꾸지 않고 이 함수 호출부만 큐에 넣는 방식으로 교체 가능).
    """
    print(f"[AI-Server] 분석 시작 -> video_id={video_id}, path={file_path}, type={analysis_type}")
    started = time.time()
    result = {"video_id": video_id, "analysis_type": analysis_type}

    try:
        pose = extract_pose_sequence(file_path)
        detected = sum(1 for f in pose["frames"] if f["player"] is not None)
        result.update(status="done", pose=pose)
        print(
            f"[AI-Server] 분석 완료 -> video_id={video_id}, "
            f"선수 검출 {detected}/{len(pose['frames'])} 프레임, {time.time() - started:.1f}초"
        )
    except Exception as e:
        result.update(status="failed", error=str(e))
        print(f"[AI-Server] 분석 실패 -> video_id={video_id}: {e}")

    result["elapsed_sec"] = round(time.time() - started, 1)
    _save_result(video_id, result)
