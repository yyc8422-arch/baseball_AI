"""
분석 상태/결과를 storage/results/<video_id>.json 파일로 저장하고 읽는 곳.

아직 DB 가 없어서 파일 하나가 분석 1건의 "레코드" 역할을 합니다.
    queued(업로드 직후) -> processing(분석 중) -> done(완료) / failed(실패)
나중에 DB(MySQL 등)로 옮길 때는 이 파일의 함수 안쪽만 바꾸면 됩니다.
"""
import json
import re
import threading
from datetime import datetime, timezone
from typing import Optional

from app.core.config import settings

# save_upload_safely() 가 uuid4().hex 로 만드는 id 형식. 이 형식이 아니면 파일 경로로 쓰지 않음 (경로 조작 방지)
_VIDEO_ID_PATTERN = re.compile(r"^[0-9a-f]{32}$")

# 같은 레코드를 여러 스레드가 동시에 읽고-고쳐-쓰지 않도록 잠금
_lock = threading.Lock()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def is_valid_video_id(video_id: str) -> bool:
    return bool(_VIDEO_ID_PATTERN.match(video_id))


def load_record(video_id: str) -> Optional[dict]:
    if not is_valid_video_id(video_id):
        return None
    path = settings.RESULT_DIR / f"{video_id}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_record(video_id: str, **fields) -> dict:
    """
    기존 레코드에 fields 를 덮어써서 저장합니다 (없으면 새로 만듦).
    임시 파일에 다 쓴 뒤 이름을 바꿔서, 반쯤 쓰인 파일을 읽는 일이 없도록 합니다.
    """
    with _lock:
        record = load_record(video_id) or {"video_id": video_id, "created_at": _now()}
        record.update(fields, updated_at=_now())

        settings.RESULT_DIR.mkdir(parents=True, exist_ok=True)
        final_path = settings.RESULT_DIR / f"{video_id}.json"
        temp_path = settings.RESULT_DIR / f"{video_id}.json.part"
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(record, f, ensure_ascii=False)
        temp_path.replace(final_path)
        return record
