# BROS AI-Server

대용량 경기 영상을 안전하게 받아 저장하고, 실제 AI 분석은 백그라운드로 넘기는 역할만 담당하는
FastAPI 서비스입니다. 회원가입/로그인/마이페이지 같은 나머지 비즈니스 로직은 별도의 Java/Spring
백엔드(`Backend/`)에서 처리할 예정이고, 이 서버는 "영상 업로드 + 분석 파이프라인 진입점"에만
집중합니다.

## 실행 방법

```bash
cd AI-Server
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

정상적으로 뜨면 http://localhost:8000/health 에서 `{"status": "ok"}` 가 보입니다.

## 폴더 구조

```
AI-Server/
  main.py                        FastAPI 앱 진입점 (CORS 설정 + 라우터 등록)
  app/
    core/config.py               업로드 용량 제한, 허용 파일 형식, 저장 경로 등 설정값
    schemas/video.py             요청/응답 데이터 형태 (Pydantic)
    routers/video.py             POST /api/analysis 엔드포인트
    services/video_storage.py    대용량 파일을 안전하게 저장하는 핵심 로직
    services/pose_model.py       YOLO26 Pose 모델을 서버 시작 시 1번만 로드
    services/video_processor.py  영상 프레임별 선수 관절 24개 좌표 추출 -> results/*.json
  models/
    best_baseball_pose.pt        Colab 에서 학습한 포즈 모델 (재학습 시 이 파일만 교체)
  storage/
    uploads/                     저장이 완료된 영상 (최종 위치)
    tmp/                         저장 중인 영상의 임시 위치 (*.part)
    results/                     분석 결과 JSON (<video_id>.json, status: done/failed)
```

## 업로드 흐름

1. 프론트엔드(`Frontend/js/capture.js`)가 `POST /api/analysis` 로 `video` 파일 +
   `analysisType`("pitching"|"batting"|"highlight")을 `FormData` 로 보냅니다.
2. `video_storage.save_upload_safely()` 가 파일을 **한 번에 메모리에 올리지 않고**
   1MB씩 읽어서 `storage/tmp/`에 `.part` 파일로 씁니다. 쓰는 도중 용량 제한(기본 500MB)을
   넘으면 그 자리에서 즉시 중단하고 임시 파일을 지웁니다.
3. 끝까지 무사히 저장되면 그제서야 `storage/uploads/`의 최종 경로로 옮깁니다.
   (중간에 실패한 "다 쓰다 만 파일"이 최종 저장소에 남지 않습니다.)
4. 저장이 끝난 **뒤에만** `BackgroundTasks.add_task(process_video, ...)` 로 분석을
   큐에 올리고, 요청자에게는 분석 완료를 기다리지 않고 바로 응답합니다.

## 앞으로 채워야 할 곳

- 자세 분석 로직 — `process_video()` 가 뽑은 프레임별 관절 좌표로 각도/개선 포인트 계산.
- 분석 상태를 DB에 저장하고 조회하는 API (`GET /api/analysis/{video_id}` 같은) —
  지금은 상태를 어디에도 저장하지 않아서, 프론트가 진행 상황을 물어볼 방법이 없습니다.
  Spring 백엔드와 같은 MySQL을 공유할지, 이 서버가 자체 DB를 가질지 정한 뒤 추가하면 됩니다.
- 실제 AI 추론이 오래 걸린다면 `BackgroundTasks` 대신 Celery + Redis/RabbitMQ 같은
  별도 워커 큐로 교체하는 걸 추천합니다 (호출부 `process_video(...)` 한 줄만 바꾸면 됨).
- 배포 시 `main.py`의 CORS `allow_origins=["*"]` 를 실제 프론트 도메인으로 좁혀야 합니다.
