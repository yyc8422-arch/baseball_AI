"""
대용량 영상을 "안전하게" 받아 저장하는 핵심 로직.

안전하다는 것의 의미:
  1) 파일 전체를 메모리에 올리지 않고, CHUNK_SIZE_BYTES 만큼씩 읽고 쓰기를 반복한다.
  2) 쓰는 도중 용량 제한(MAX_UPLOAD_SIZE_BYTES)을 넘으면 그 자리에서 즉시 중단하고
     이미 쓴 임시 파일을 지운다 (디스크가 꽉 차는 것을 방지).
  3) 처음엔 <TEMP_DIR>에 "*.part" 임시 파일로 쓰고, 다 쓰고 검증이 끝난 뒤에만
     <UPLOAD_DIR>의 최종 경로로 옮긴다. 그래서 중간에 실패해도 최종 저장소에는
     "다 쓰다 만 파일"이 남지 않는다.
  4) 파일명은 요청자가 보낸 원본 파일명을 그대로 쓰지 않고 uuid4 로 새로 만든다
     (경로 조작/충돌/한글 파일명 문제를 한 번에 피함).
"""
import shutil
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile

from app.core.config import settings


def _ensure_dirs() -> None:
    settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)


def _validate_content_type(file: UploadFile) -> None:
    # 브라우저 녹화 영상은 "video/webm;codecs=vp8,opus" 처럼 뒤에 코덱 정보가 붙으므로 앞부분만 비교
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type in settings.ALLOWED_CONTENT_TYPES:
        return
    # 일부 브라우저/OS 는 .mov 등의 타입을 비워서 보내므로, 그때는 확장자로 확인 (프론트 isAllowedVideo 와 동일)
    extension = Path(file.filename or "").suffix.lower()
    if content_type in ("", "application/octet-stream") and extension in settings.ALLOWED_EXTENSIONS:
        return
    raise HTTPException(
        status_code=400,
        detail=f"허용되지 않는 파일 형식입니다: {file.content_type}",
    )


async def save_upload_safely(file: UploadFile) -> Tuple[str, Path, int]:
    """
    업로드된 영상을 스트리밍 방식으로 저장합니다.

    Returns:
        (video_id, 최종 저장 경로, 파일 크기(byte))

    Raises:
        HTTPException: 형식이 허용되지 않거나(400), 용량 제한을 넘거나(413),
                        저장 중 알 수 없는 오류가 나면(500)
    """
    _ensure_dirs()
    _validate_content_type(file)

    video_id = uuid.uuid4().hex
    suffix = Path(file.filename or "").suffix or ".mp4"
    temp_path = settings.TEMP_DIR / f"{video_id}{suffix}.part"
    final_path = settings.UPLOAD_DIR / f"{video_id}{suffix}"

    total_bytes = 0
    try:
        with open(temp_path, "wb") as out_file:
            while True:
                chunk = await file.read(settings.CHUNK_SIZE_BYTES)
                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"영상 파일은 최대 {settings.MAX_UPLOAD_SIZE_MB}MB까지 업로드할 수 있습니다.",
                    )

                out_file.write(chunk)
    except HTTPException:
        temp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:  # 디스크 오류 등 예상 못한 상황
        temp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="영상 저장 중 오류가 발생했습니다.") from exc
    finally:
        await file.close()

    # 끝까지 무사히 쓴 파일만 최종 위치로 이동
    shutil.move(str(temp_path), str(final_path))

    return video_id, final_path, total_bytes
