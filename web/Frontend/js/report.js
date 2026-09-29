/**
 * BROS - 투구/타격 AI 분석 리포트 (pitching.html, batting.html 공통)
 *
 * 목표: 숫자를 많이 보여주는 리포트가 아니라 "영상 확인 → 핵심 수치 → AI 가 쉽게 풀어 설명 → 필요한 사람만 상세 분석".
 * 자세를 평가(좋음/나쁨, 정상/비정상, 부상 위험)하지 않고, 측정 사실 + 기본적인 야구 동작 관점의 의미 + 다음 촬영에서
 * 확인해볼 부분만 전합니다. 비교 기준(이전 기록 등)이 없으면 "짧다/길다/크다/작다" 같은 표현도 쓰지 않습니다.
 *
 * 흐름: 프론트 → Spring Boot → Python AI(분석) → Spring Boot(결과 DB 저장 + 이전 분석 추가) → 프론트.
 * 프론트는 AI 서버와 직접 통신하지 않고, Spring API(GET /api/analysis/{id}) 결과를 그대로 그리기만 합니다 (Pose 계산 없음).
 *
 * 수치는 성격에 맞는 단위로만 표시합니다.
 *   관절 및 자세 → °   움직임 → 신장·신체·어깨너비 대비 % 또는 정규화 값 (실제 거리 보정 전이라 cm 금지)
 *   동작 타이밍 → s·ms   동작 속도 → °/s (신뢰할 수 있는 값이 올 때만)
 *
 * 화면 순서 (세로 길이를 줄이기 위해 카드 3장 + 작은 안내):
 *   ① 제목 + 메타정보 한 줄 → 분석 영상(재생속도) → 동작 단계 타임라인
 *   ② 핵심 지표 4개 → AI 분석 요약 (피드백 최대 3개)
 *   ③ 상세 분석: [관절·자세] [움직임] [타이밍] 탭 (한 번에 하나만)
 *   + 분석 결과 안내 (눌러서 펼침)
 *
 * 촬영 방향(side / front / rear)마다 측정할 수 있는 지표가 달라서, 지표마다 views 를 두고
 * 지금 영상의 촬영 방향에 맞는 지표만 보여줍니다 (기본 side). optional 지표는 값이 올 때만 보여줌.
 *
 * 연결 함수 (Spring API 결과 → 화면):
 *   renderPitchAnalysis(result) / renderBattingAnalysis(result)   result 형식은 js/types.js 의 AnalysisReport
 *   generatePitchFeedback(result) / generateBattingFeedback(result)  측정값 → AI 피드백 문장 (최대 3개)
 *   generateAnalysisSummary(result)  Spring 이 observations 를 주면 그대로(최대 3개), 없으면 위 피드백 함수 사용
 *   renderDetailMetrics(result, [body])  상세 분석 탭 영역
 *   showFromRecord(type, record)  GET /api/analysis/{id} 응답(record)을 AnalysisReport 로 바꿔서 그림 (js/analysis.js 가 호출)
 *   setSourceVideo(url, fileName) 방금 업로드한 영상을 ① 에 연결 (js/capture.js 가 호출)
 * 재생속도(0.25x~2.0x, video.playbackRate)는 투구/타격/하이라이트 공통 플레이어 js/video-player.js 에 있음.
 */
(function () {
  // ===================== 표시 단위 =====================
  // API 는 지표마다 unit 을 보낼 수 있고(없으면 아래 지표 정의의 기본 단위), 나중에 신장/기준 물체로 실제 거리 보정이 되면
  // unit 만 "cm" 로 보내면 그대로 표시됩니다. basis = 값 앞/아래에 붙는 기준 설명.
  const UNITS = {
    deg: { suffix: "°", digits: 1 },
    pct_height: { suffix: "%", digits: 1, basis: "신장 대비" },
    pct_body: { suffix: "%", digits: 1, basis: "신체 기준" },
    pct_shoulder: { suffix: "%", digits: 1, basis: "어깨너비 대비" },
    norm: { suffix: "", digits: 3, basis: "정규화 값" },
    cm: { suffix: "cm", digits: 1, basis: "실측 보정" },
    sec: { suffix: "s", digits: 2 },
    ms: { suffix: "ms", digits: 0 },
    deg_per_sec: { suffix: "°/s", digits: 0 },
  };

  const CAMERA_VIEW_LABEL = { side: "측면", front: "정면", rear: "후면" };
  const DEFAULT_VIEW = "side";
  const SIDE = ["side"];
  const FRONT_REAR = ["front", "rear"];
  const ALL_VIEWS = ["side", "front", "rear"];

  /** 측정 카테고리 (observations 의 category 이름 표시용) */
  const CATEGORIES = [
    { key: "angles", title: "관절·자세" },
    { key: "movement", title: "움직임" },
    { key: "timing", title: "타이밍" },
    { key: "speed", title: "동작 속도" },
  ];

  // ===================== 용어 설명 (지표 카드의 ⓘ) : 무엇을 잰 값인지만, 좋다/나쁘다는 쓰지 않음 =====================
  const METRIC_HELP = {
    elbowAngleAtRelease: "공을 놓는 순간 위팔과 아래팔 사이의 각도예요. 180°에 가까울수록 팔이 펴진 상태예요.",
    frontKneeAngle: "앞다리 허벅지와 정강이 사이의 각도예요. 180°에 가까울수록 무릎이 펴진 상태예요.",
    backKneeAngle: "뒷다리(축발) 허벅지와 정강이 사이의 각도예요. 180°에 가까울수록 무릎이 펴진 상태예요.",
    trunkForwardTilt: "상체가 수직선에서 앞(던지는 방향)으로 기운 각도예요.",
    trunkTilt: "상체가 수직선에서 기운 각도예요.",
    elbowAngle: "팔꿈치에서 위팔과 아래팔 사이의 각도예요.",
    shoulderLineTilt: "양쪽 어깨를 이은 선이 수평선에서 기운 각도예요.",
    pelvisLineTilt: "양쪽 골반을 이은 선이 수평선에서 기운 각도예요.",
    landingFootAngle: "앞발이 땅에 닿을 때 발끝이 향하는 방향을 각도로 나타낸 값이에요.",
    pelvisRotation: "동작하는 동안 골반이 돌아간 각도예요.",
    shoulderRotation: "동작하는 동안 어깨가 돌아간 각도예요.",
    headDisplacement: "동작하는 동안 머리가 움직인 거리예요. 몸 크기 대비 비율(%)로 나타내요.",
    pelvisDisplacement: "동작하는 동안 골반이 움직인 거리예요. 몸 크기 대비 비율(%)로 나타내요.",
    strideLength: "앞발을 내디딘 폭이에요. 키 대비 비율(%)로 나타내요.",
    legLiftHeight: "다리를 들어 올린 가장 높은 높이예요. 키 대비 비율(%)로 나타내요.",
    releaseWristPosition: "공을 놓는 순간 손목이 몸 중심에서 떨어진 위치예요. 몸 크기 대비 비율(%)로 나타내요.",
    wristPath: "스윙하는 동안 손목이 지나간 경로의 길이예요. 몸 크기 대비 비율(%)로 나타내요.",
    lateralCenterShift: "몸의 중심이 좌우로 움직인 거리예요. 어깨너비 대비 비율(%)로 나타내요.",
    centerOfMassShift: "체중을 옮기면서 몸의 중심이 움직인 거리예요. 몸 크기 대비 비율(%)로 나타내요.",
    pelvisToShoulderSec: "골반이 돌기 시작한 뒤 어깨가 돌기 시작할 때까지 걸린 시간이에요.",
    landingToReleaseSec: "앞발이 땅에 닿은 뒤 공을 놓을 때까지 걸린 시간이에요.",
    landingToSwingSec: "앞발이 땅에 닿은 뒤 스윙을 시작할 때까지 걸린 시간이에요.",
    totalMotionSec: "투구 동작을 시작해서 끝낼 때까지 걸린 시간이에요.",
    totalSwingSec: "스윙 동작을 시작해서 끝낼 때까지 걸린 시간이에요.",
    pelvisAngularVelocityMax: "골반이 가장 빠르게 돌 때의 속도예요. 1초에 몇 도 도는지로 나타내요.",
    trunkAngularVelocityMax: "몸통이 가장 빠르게 돌 때의 속도예요. 1초에 몇 도 도는지로 나타내요.",
    elbowExtensionVelocityMax: "팔꿈치가 가장 빠르게 펴질 때의 속도예요. 1초에 몇 도 펴지는지로 나타내요.",
  };

  // ===================== 투구/타격 설정 (서로 다른 건 이 값들뿐, 화면 코드는 공통) =====================
  // 지표 정의: key(API 필드), label, unit(기본 단위), views(측정 가능한 촬영 방향), optional(값이 올 때만 표시)
  //           timing 은 kind: event(시작 시점) / interval(동작 사이 시간차) / total(전체 동작 시간)
  // 실제 구속·회전수·관절 힘/토크·부상 위험(투구), 배트 스피드·타구속도·발사각·비거리·컨택 위치·공 기준 타이밍(타격)은
  // Pose 영상 분석만으로 정확히 잴 수 없어 지표로 두지 않음 (Ball/Bat Detection 등 추가 모델이 생기면 확장)
  const REPORT_CONFIG = {
    pitching: {
      noun: "투구",
      titles: { report: "투구폼 AI 분석 리포트", phases: "투구 동작 단계" },
      // ② 핵심 지표 4개: [카테고리, 지표 key]. 값이 없는 건 빼고, 모자라면 측정된 다른 지표로 채움
      keyMetrics: [
        ["angles", "elbowAngleAtRelease"],
        ["angles", "trunkForwardTilt"],
        ["movement", "strideLength"],
        ["timing", "totalMotionSec"],
      ],
      // key 는 API 의 phases[].key 와 같은 영어 값(그대로 유지), 화면에는 야구 용어를 한글 발음으로 표기한 label
      phases: [
        { key: "SET", label: "세트" },
        { key: "LEG_LIFT", label: "레그 리프트" },
        { key: "STRIDE", label: "스트라이드" },
        { key: "ARM_COCKING", label: "암 코킹" },
        { key: "ACCELERATION", label: "액셀러레이션" },
        { key: "RELEASE", label: "릴리스" },
        { key: "FOLLOW_THROUGH", label: "팔로 스루" },
      ],
      angles: [
        { key: "elbowAngleAtRelease", label: "릴리스 시 팔꿈치 각도", unit: "deg", views: SIDE },
        { key: "frontKneeAngle", label: "앞무릎 각도", unit: "deg", views: SIDE },
        { key: "backKneeAngle", label: "뒷무릎 각도", unit: "deg", views: SIDE },
        { key: "trunkForwardTilt", label: "상체 전방 기울기", unit: "deg", views: SIDE },
        { key: "shoulderLineTilt", label: "어깨선 기울기", unit: "deg", views: ALL_VIEWS, optional: true },
        { key: "pelvisLineTilt", label: "골반선 기울기", unit: "deg", views: FRONT_REAR },
        { key: "landingFootAngle", label: "착지발 방향", unit: "deg", views: FRONT_REAR },
        // 회전량은 촬영 방향·Pose 신뢰도에 따라 정확도가 달라서, 모델이 검증돼 값을 보낼 때만 표시
        { key: "pelvisRotation", label: "골반 회전량", unit: "deg", views: FRONT_REAR, optional: true },
        { key: "shoulderRotation", label: "어깨 회전량", unit: "deg", views: FRONT_REAR, optional: true },
      ],
      movement: [
        { key: "strideLength", label: "스트라이드 길이", unit: "pct_height", views: SIDE },
        { key: "headDisplacement", label: "머리 이동량", unit: "pct_body", views: SIDE },
        { key: "pelvisDisplacement", label: "골반 이동량", unit: "pct_body", views: SIDE },
        { key: "legLiftHeight", label: "레그 리프트 높이", unit: "pct_height", views: SIDE },
        { key: "releaseWristPosition", label: "릴리스 시 손목 상대 위치", unit: "pct_body", views: SIDE, optional: true },
        { key: "lateralCenterShift", label: "좌우 중심 이동", unit: "pct_shoulder", views: FRONT_REAR },
      ],
      timing: [
        { key: "legLiftPeakSec", label: "레그 리프트 최고점", kind: "event" },
        { key: "strideStartSec", label: "스트라이드 시작", kind: "event" },
        { key: "frontFootLandingSec", label: "앞발 착지", kind: "event" },
        { key: "pelvisRotationStartSec", label: "골반 회전 시작", kind: "event", optional: true },
        { key: "shoulderRotationStartSec", label: "어깨 회전 시작", kind: "event", optional: true },
        { key: "armAccelerationStartSec", label: "팔 가속 시작", kind: "event", optional: true },
        { key: "releaseSec", label: "릴리스", kind: "event" },
        { key: "pelvisToShoulderSec", label: "골반 회전 → 어깨 회전", kind: "interval" },
        { key: "landingToReleaseSec", label: "앞발 착지 → 릴리스", kind: "interval", optional: true },
        { key: "totalMotionSec", label: "전체 투구 동작 시간", kind: "total" },
      ],
      // 현재 모델에서 신뢰할 수 있는 값이 없어 기본으로는 숨김. API 가 값을 보내면 타이밍 탭 아래에 표시
      speed: [
        { key: "pelvisAngularVelocityMax", label: "골반 회전 최대 각속도", unit: "deg_per_sec" },
        { key: "trunkAngularVelocityMax", label: "몸통 회전 최대 각속도", unit: "deg_per_sec" },
        { key: "elbowExtensionVelocityMax", label: "팔꿈치 신전 최대 각속도", unit: "deg_per_sec" },
      ],
      notice:
        "본 리포트는 영상에서 추출한 신체 좌표와 동작 데이터를 수치화하여 기본적인 야구 동작 관점에서 해석한 결과입니다. 특정 수치만으로 투구폼의 우수성이나 부상 위험을 판단하지 않습니다.",
    },
    batting: {
      noun: "타격",
      titles: { report: "타격폼 AI 분석 리포트", phases: "타격 동작 단계" },
      keyMetrics: [
        ["angles", "frontKneeAngle"],
        ["angles", "trunkTilt"],
        ["movement", "strideLength"],
        ["timing", "totalSwingSec"],
      ],
      // CONTACT 는 공/배트 인식 모델이 생기면 API 가 phases 에 넣어 보내면 자동으로 표시됨 (EXTRA_PHASE_LABELS)
      phases: [
        { key: "STANCE", label: "스탠스" },
        { key: "LOAD", label: "로드" },
        { key: "STRIDE", label: "스트라이드" },
        { key: "ROTATION", label: "로테이션" },
        { key: "SWING", label: "스윙" },
        { key: "FOLLOW_THROUGH", label: "팔로 스루" },
      ],
      angles: [
        { key: "frontKneeAngle", label: "앞무릎 각도", unit: "deg", views: SIDE },
        { key: "backKneeAngle", label: "뒷무릎 각도", unit: "deg", views: SIDE },
        { key: "trunkTilt", label: "상체 기울기", unit: "deg", views: SIDE },
        { key: "elbowAngle", label: "팔꿈치 각도", unit: "deg", views: SIDE, optional: true },
        { key: "shoulderLineTilt", label: "어깨선 기울기", unit: "deg", views: FRONT_REAR },
        { key: "pelvisLineTilt", label: "골반선 기울기", unit: "deg", views: FRONT_REAR },
        { key: "landingFootAngle", label: "앞발 착지 방향", unit: "deg", views: FRONT_REAR },
        { key: "pelvisRotation", label: "골반 회전량", unit: "deg", views: FRONT_REAR, optional: true },
        { key: "shoulderRotation", label: "어깨 회전량", unit: "deg", views: FRONT_REAR, optional: true },
      ],
      movement: [
        { key: "strideLength", label: "스트라이드 길이", unit: "pct_height", views: SIDE },
        { key: "headDisplacement", label: "머리 이동량", unit: "pct_body", views: SIDE },
        { key: "pelvisDisplacement", label: "골반 이동량", unit: "pct_body", views: SIDE },
        { key: "wristPath", label: "손목 이동 경로", unit: "pct_body", views: SIDE, optional: true },
        { key: "centerOfMassShift", label: "신체 중심 이동", unit: "pct_body", views: SIDE },
        { key: "lateralCenterShift", label: "좌우 중심 이동", unit: "pct_shoulder", views: FRONT_REAR },
      ],
      // 공이 없는 영상 분석이라 "빠른/늦은 스윙" 같은 공 기준 타이밍은 판단하지 않고, 동작 시점만 기록
      timing: [
        { key: "loadStartSec", label: "로드 시작", kind: "event" },
        { key: "strideStartSec", label: "스트라이드 시작", kind: "event" },
        { key: "frontFootLandingSec", label: "앞발 착지", kind: "event" },
        { key: "pelvisRotationStartSec", label: "로테이션 시작", kind: "event" },
        { key: "shoulderRotationStartSec", label: "어깨 회전 시작", kind: "event", optional: true },
        { key: "swingStartSec", label: "스윙 시작", kind: "event" },
        { key: "followThroughStartSec", label: "팔로 스루 진입", kind: "event" },
        { key: "pelvisToShoulderSec", label: "골반 회전 → 어깨 회전", kind: "interval" },
        { key: "landingToSwingSec", label: "앞발 착지 → 스윙 시작", kind: "interval", optional: true },
        { key: "totalSwingSec", label: "전체 스윙 동작 시간", kind: "total" },
      ],
      speed: [
        { key: "pelvisAngularVelocityMax", label: "골반 회전 최대 각속도", unit: "deg_per_sec" },
        { key: "trunkAngularVelocityMax", label: "몸통 회전 최대 각속도", unit: "deg_per_sec" },
      ],
      notice:
        "본 리포트는 영상에서 추출한 신체 좌표와 동작 데이터를 수치화하여 기본적인 야구 동작 관점에서 해석한 결과입니다. 특정 수치만으로 타격폼의 우수성이나 경기 수행 능력을 판단하지 않습니다.",
    },
  };

  // timing 지표는 기본 단위가 초, 촬영 방향과 관계없이 측정 (speed 도 방향 무관)
  Object.values(REPORT_CONFIG).forEach((config) => {
    config.timing.forEach((def) => Object.assign(def, { unit: def.unit || "sec", views: def.views || ALL_VIEWS }));
    config.speed.forEach((def) => Object.assign(def, { views: def.views || ALL_VIEWS }));
  });

  /** 설정에 없는 단계가 API 에서 오면(예: 추후 CONTACT) 이 이름으로 표시, 없으면 key 그대로 */
  const EXTRA_PHASE_LABELS = { CONTACT: "컨택" };

  // ===================== 예시 데이터 (화면 확인용, 실제 분석 결과 아님) =====================
  // "예시 리포트 보기" 에서만 사용. 회전량처럼 아직 신뢰할 수 없는 값은 넣지 않음.
  const SAMPLE_RESULTS = {
    pitching: {
      analysisType: "pitching",
      videoInfo: { status: "done", cameraView: "side", fps: 60, durationSec: 1.8, analyzedFrames: 108, analyzedAt: "2026.09.28" },
      phases: [
        { key: "SET", startSec: 0.0, endSec: 0.3 },
        { key: "LEG_LIFT", startSec: 0.3, endSec: 0.66 },
        { key: "STRIDE", startSec: 0.66, endSec: 0.91 },
        { key: "ARM_COCKING", startSec: 0.91, endSec: 1.0 },
        { key: "ACCELERATION", startSec: 1.0, endSec: 1.08 },
        { key: "RELEASE", startSec: 1.08, endSec: 1.12 },
        { key: "FOLLOW_THROUGH", startSec: 1.12, endSec: 1.6 },
      ],
      angles: {
        elbowAngleAtRelease: { value: 96.4, at: "RELEASE" },
        frontKneeAngle: { value: 143.2, at: "RELEASE" },
        backKneeAngle: { value: 152.1, at: "STRIDE" },
        trunkForwardTilt: { value: 16.7, at: "RELEASE" },
      },
      movement: { strideLength: 74, headDisplacement: 3.8, pelvisDisplacement: 11.2, legLiftHeight: 48.5 },
      timing: {
        legLiftPeakSec: 0.54,
        strideStartSec: 0.66,
        frontFootLandingSec: 0.91,
        releaseSec: 1.08,
        pelvisToShoulderSec: 0.09,
        totalMotionSec: 1.38,
      },
      speed: {},
      previousAnalysis: {
        analyzedAt: "2026.09.20",
        cameraView: "side",
        angles: { elbowAngleAtRelease: 97.2, frontKneeAngle: 141.0, trunkForwardTilt: 14.3 },
        movement: { headDisplacement: 4.1, strideLength: 72 },
        timing: { pelvisToShoulderSec: 0.11, totalMotionSec: 1.42 },
      },
    },
    batting: {
      analysisType: "batting",
      videoInfo: { status: "done", cameraView: "side", fps: 60, durationSec: 2.2, analyzedFrames: 132, analyzedAt: "2026.09.28" },
      phases: [
        { key: "STANCE", startSec: 0.0, endSec: 0.48 },
        { key: "LOAD", startSec: 0.48, endSec: 0.86 },
        { key: "STRIDE", startSec: 0.86, endSec: 1.12 },
        { key: "ROTATION", startSec: 1.12, endSec: 1.3 },
        { key: "SWING", startSec: 1.3, endSec: 1.56 },
        { key: "FOLLOW_THROUGH", startSec: 1.56, endSec: 2.1 },
      ],
      angles: {
        frontKneeAngle: { value: 148.2, at: "SWING" },
        backKneeAngle: { value: 126.9, at: "LOAD" },
        trunkTilt: { value: 21.6, at: "SWING" },
      },
      movement: { strideLength: 46, headDisplacement: 2.9, pelvisDisplacement: 8.4, centerOfMassShift: 12.5 },
      timing: {
        loadStartSec: 0.48,
        strideStartSec: 0.86,
        frontFootLandingSec: 1.1,
        pelvisRotationStartSec: 1.12,
        swingStartSec: 1.3,
        followThroughStartSec: 1.56,
        pelvisToShoulderSec: 0.08,
        totalSwingSec: 0.7,
      },
      speed: {},
      previousAnalysis: {
        analyzedAt: "2026.09.20",
        cameraView: "side",
        angles: { frontKneeAngle: 150.4, trunkTilt: 20.1 },
        movement: { headDisplacement: 3.4, strideLength: 44 },
        timing: { pelvisToShoulderSec: 0.1, totalSwingSec: 0.74 },
      },
    },
  };

  // ===================== 작은 도우미 =====================
  /** 요소 만들기 (글자는 항상 textContent 로 넣어서 안전) */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /**
   * 지표 값: 숫자 또는 { value, unit?, at? } (unit 이 없으면 지표 정의의 기본 단위, at = 측정 시점 단계 key)
   * @returns {{value: number, unit: string, at: string|null}|null}
   */
  function metricOf(group, def) {
    const raw = group && def ? group[def.key] : undefined;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "number") return { value: raw, unit: def.unit, at: null };
    if (typeof raw === "object" && typeof raw.value === "number") {
      return { value: raw.value, unit: UNITS[raw.unit] ? raw.unit : def.unit, at: raw.at || null };
    }
    return null;
  }

  function formatNumber(value, unit) {
    const u = UNITS[unit] || UNITS.deg;
    return `${value.toFixed(u.digits)}${u.suffix}`;
  }

  /** 문장 안에 넣을 값: 비율이면 기준까지 ("신장 대비 74.0%"), 아니면 값만 ("96.4°") */
  function formatWithBasis(metric) {
    const u = UNITS[metric.unit];
    const value = formatNumber(metric.value, metric.unit);
    return u && u.basis ? `${u.basis} ${value}` : value;
  }

  function formatChange(change, unit) {
    const u = UNITS[unit] || UNITS.deg;
    const rounded = Number(change.toFixed(u.digits));
    const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
    return `${sign}${Math.abs(rounded).toFixed(u.digits)}${u.suffix}`;
  }

  function phaseLabel(config, key) {
    const found = config.phases.find((p) => p.key === key);
    if (found) return found.label;
    const timing = config.timing.find((t) => t.key === key);
    return timing ? timing.label : EXTRA_PHASE_LABELS[key] || key;
  }

  function cameraViewOf(result) {
    const view = result && result.videoInfo && result.videoInfo.cameraView;
    return CAMERA_VIEW_LABEL[view] ? view : DEFAULT_VIEW;
  }

  function configOf(result) {
    return REPORT_CONFIG[result && result.analysisType] || REPORT_CONFIG[state.type];
  }

  /** 이 촬영 방향에서 보여줄 지표 (optional 은 값이 있을 때만, 다른 방향 지표도 API 가 값을 보내면 표시) */
  function visibleDefs(defs, values, view) {
    return defs.filter((def) => {
      const hasValue = !!metricOf(values, def);
      if (def.optional) return hasValue;
      return def.views.includes(view) || hasValue;
    });
  }

  /** 이전 분석과 같은 촬영 방향이면 previousAnalysis, 아니면 null (방향이 다르면 수치를 비교하지 않음) */
  function comparablePrevious(result) {
    const prev = result && result.previousAnalysis;
    if (!prev || (prev.cameraView && prev.cameraView !== cameraViewOf(result))) return null;
    return prev;
  }

  // ===================== 상태 =====================
  const state = {
    type: null,
    container: null,
    result: null, // AnalysisReport
    isSample: false,
    sourceUrl: null, // 방금 업로드한 영상(이 기기에서만 재생 가능)
    sourceName: null,
    player: null,
    overlay: null,
    poseVideoId: null, // 관절 좌표를 불러온 영상 id (같은 영상이면 다시 부르지 않음)
    showJoints: true,
    videoSection: null, // ① 카드. 다시 그릴 때도 이 카드는 그대로 둬서 재생이 끊기지 않게 함
    videoSectionUrl: null,
    lastRecordKey: null, // 같은 영상/같은 상태면 다시 그리지 않음
    detailTab: "angles", // ③ 상세 분석에서 보고 있던 탭 (다시 그려도 유지)
  };

  // ===================== 카드 틀 =====================
  function card(title, className) {
    const section = el("section", `page-card report-card${className ? ` ${className}` : ""}`);
    const head = el("div", "report-card__head");
    head.appendChild(el("h2", "report-card__title", title));
    section.appendChild(head);
    const body = el("div", "report-card__body");
    section.appendChild(body);
    return { section, head, body };
  }

  function pendingNote(text) {
    return el("p", "report-pending", text || "이 항목은 AI 측정 기능이 연결되면 표시됩니다.");
  }

  // ===================== ① 분석 영상 =====================
  function ensurePlayer() {
    if (state.player || !window.BROS.player) return state.player;
    state.player = window.BROS.player.createAnalysisPlayer({ label: `${REPORT_CONFIG[state.type].noun} 분석 영상` });
    state.overlay = window.BROS.player.createPoseOverlay(state.player, {
      onStatus: (message) => {
        const status = state.container && state.container.querySelector(".report-joint__status");
        if (status) status.textContent = message;
      },
    });
    return state.player;
  }

  /** ① 에서 재생할 영상: API 가 준 주소 → 방금 올린 영상 순. 예시 리포트에는 영상을 붙이지 않음 (예시 수치와 섞이지 않게) */
  function currentVideoUrl() {
    if (state.isSample) return null;
    return (state.result && state.result.videoInfo && state.result.videoInfo.videoUrl) || state.sourceUrl;
  }

  function renderVideoCard(body) {
    const url = currentVideoUrl();
    if (!url) {
      body.appendChild(
        el("div", "report-video-empty", state.isSample
          ? "예시 리포트에는 영상이 없어요. 영상을 올려 분석하면 이곳에서 재생되고, 관절 점이 영상 위에 함께 표시돼요."
          : "이 영상은 올린 기기에서 분석 직후에만 재생할 수 있어요. (서버 영상 재생은 연결 예정)")
      );
      return;
    }
    const player = ensurePlayer();
    if (!player) return;
    player.setSource(url); // 새 영상이면 재생속도는 1.0x 로 다시 시작 (js/video-player.js)
    body.appendChild(player.element);

    // 관절 점 표시 켜기/끄기 + 색 안내
    const joints = el("div", "report-joint");
    const toggle = el("label", "report-joint__toggle");
    const checkbox = el("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.showJoints;
    checkbox.addEventListener("change", () => {
      state.showJoints = checkbox.checked;
      state.overlay.setVisible(checkbox.checked);
    });
    toggle.append(checkbox, el("span", null, "관절 점 표시"));
    const legend = el("span", "report-joint__legend");
    const colors = window.BROS.player.JOINT_COLORS;
    [["right", "오른쪽"], ["left", "왼쪽"], ["center", "몸통/머리"]].forEach(([side, label]) => {
      const dot = el("span", "report-joint__dot");
      dot.style.background = colors[side];
      legend.append(dot, el("span", null, label));
    });
    joints.append(toggle, legend, el("span", "report-joint__status"));
    body.appendChild(joints);
    state.overlay.setVisible(state.showJoints);
    state.overlay.setPose(state.result && state.result.pose ? state.result.pose : null);
  }

  // ===================== ① 제목 아래 메타정보 한 줄 =====================
  const STATUS_LABEL = { uploading: "업로드 중", queued: "분석 대기", processing: "분석 중", done: "분석 완료", failed: "분석 실패" };

  /** "측면 촬영 · 60FPS · 영상 1.8초 · 2026.09.28" (분석이 끝나기 전에는 앞에 상태). 다시 그릴 때마다 교체 */
  function renderVideoMeta(section, result) {
    section.querySelectorAll(".report-meta").forEach((node) => node.remove());
    const info = result.videoInfo || {};
    const parts = [
      info.status !== "done" ? STATUS_LABEL[info.status] || info.status : null,
      `${CAMERA_VIEW_LABEL[cameraViewOf(result)]} 촬영`,
      info.fps != null ? `${Number(info.fps).toFixed(0)}FPS` : null,
      info.durationSec != null ? `영상 ${Number(info.durationSec).toFixed(1)}초` : null,
      info.analyzedAt || null,
    ].filter(Boolean);
    const meta = el("p", "report-meta", parts.join(" · "));
    if (info.fileName) meta.title = info.fileName;
    section.querySelector(".report-card__head").appendChild(meta);
  }

  // ===================== ① 안의 동작 단계 구간 바 (영상 타임라인과 연결) =====================
  function orderedPhases(config, apiPhases) {
    const byKey = {};
    (apiPhases || []).forEach((p) => {
      byKey[p.key] = p;
    });
    const list = config.phases.map((p) => ({ key: p.key, label: p.label, ...(byKey[p.key] || {}) }));
    // 설정에 없는 단계(예: 추후 CONTACT)는 시작 시점 순서에 맞춰 끼워 넣음
    (apiPhases || [])
      .filter((p) => !config.phases.some((c) => c.key === p.key))
      .forEach((extra) => {
        const item = { label: phaseLabel(config, extra.key), ...extra };
        const idx = list.findIndex((p) => p.startSec != null && extra.startSec != null && p.startSec > extra.startSec);
        if (idx === -1) list.push(item);
        else list.splice(idx, 0, item);
      });
    return list;
  }

  /**
   * 동작 단계 타임라인 (영상 바로 아래, 플레이어의 일부).
   *  - 가는 줄: 영상 전체 길이 기준(기본 탐색바와 같은 축). 각 단계 시작 지점에 눈금, 재생된 부분은 채움, 지금 단계 구간은 은은하게 표시.
   *    줄이나 눈금을 누르면 그 시점으로 이동.
   *  - 아래 단계 표시: "세트 › 레그 리프트 › …" 한 줄 (눌러서 이동, 폰에서는 가로 스크롤)
   * 단계 시작/종료 시점(startSec/endSec)이 없으면 아무것도 그리지 않음.
   * @param {HTMLElement} target 넣을 곳
   * @param {HTMLElement|null} before 이 요소 앞에 넣음 (플레이어의 재생속도 줄 앞)
   */
  function renderPhaseChapters(target, before, config, result) {
    const phases = orderedPhases(config, result.phases).filter(
      (p) => typeof p.startSec === "number" && typeof p.endSec === "number"
    );
    if (!phases.length) return;

    const video = state.player && !state.isSample ? state.player.video : null;
    const lastEnd = phases[phases.length - 1].endSec;
    /** 영상 길이: 실제 영상 → API 의 영상 길이 → 마지막 단계 끝 */
    const duration = () =>
      (video && Number.isFinite(video.duration) && video.duration) ||
      (result.videoInfo && result.videoInfo.durationSec) ||
      lastEnd;
    const seek = (sec) => {
      if (!video) return;
      video.currentTime = sec;
      video.pause();
    };

    const wrap = el("div", "phase-chapters");
    const head = el("div", "phase-chapters__head");
    const now = el("span", "phase-chapters__now", "");
    head.append(el("span", "phase-chapters__title", config.titles.phases), now);

    // 가는 타임라인
    const line = el("div", "phase-line");
    const rail = el("div", "phase-line__rail");
    const range = el("span", "phase-line__range");
    const progress = el("span", "phase-line__progress");
    const knob = el("span", "phase-line__knob");
    range.hidden = true;
    knob.hidden = !video;
    rail.append(range, progress);
    line.append(rail, knob);
    if (video) {
      line.addEventListener("click", (e) => {
        if (e.target.closest(".phase-tick")) return;
        const rect = rail.getBoundingClientRect();
        seek(Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1) * duration());
      });
    } else {
      line.classList.add("phase-line--static");
    }
    const ticks = phases.map((p) => {
      const tick = el("button", "phase-tick");
      tick.type = "button";
      tick.title = `${p.label} ${p.startSec.toFixed(2)}s`;
      tick.setAttribute("aria-label", `${p.label} 시작 지점으로 이동 (${p.startSec.toFixed(2)}초)`);
      if (video) tick.addEventListener("click", () => seek(p.startSec));
      else tick.disabled = true;
      line.appendChild(tick);
      return tick;
    });

    // 아래 단계 표시 (세트 › 레그 리프트 › …)
    const steps = el("ol", "phase-steps");
    const stepButtons = phases.map((p) => {
      const li = el("li", "phase-steps__item");
      const btn = el("button", "phase-step");
      btn.type = "button";
      btn.append(el("span", "phase-step__label", p.label), el("span", "phase-step__time", `${p.startSec.toFixed(2)}s`));
      if (video) btn.addEventListener("click", () => seek(p.startSec));
      else btn.disabled = true;
      li.appendChild(btn);
      steps.appendChild(li);
      return btn;
    });

    const stepsWrap = el("div", "phase-steps-wrap");
    stepsWrap.appendChild(steps);
    wrap.append(head, line, stepsWrap);
    target.insertBefore(wrap, before);

    const pct = (sec) => `${Math.min(Math.max(sec / duration(), 0), 1) * 100}%`;
    let current = -1; // 지금 재생 중인 단계 번호

    function layout() {
      phases.forEach((p, i) => {
        ticks[i].style.left = pct(p.startSec);
      });
    }

    /** 재생된 부분 채움 + 지금 단계 구간 표시 + 단계 강조 + "현재 구간" 이름 */
    function sync() {
      if (!video) {
        now.textContent = `${phases[0].label} → ${phases[phases.length - 1].label}`;
        return;
      }
      const t = video.currentTime;
      progress.style.width = pct(t);
      knob.style.left = pct(t);
      const before = current;
      current = -1;
      phases.forEach((p, i) => {
        const active = t >= p.startSec && t < p.endSec;
        if (active) current = i;
        stepButtons[i].classList.toggle("phase-step--active", active);
        stepButtons[i].classList.toggle("phase-step--done", t >= p.endSec);
        ticks[i].classList.toggle("phase-tick--passed", t >= p.startSec);
      });
      // 좁은 화면에서 단계 줄이 가로로 넘치면, 지금 단계가 보이도록 가운데로 스크롤
      if (current >= 0 && current !== before) {
        const btn = stepButtons[current];
        const target = btn.offsetLeft - (stepsWrap.clientWidth - btn.offsetWidth) / 2;
        stepsWrap.scrollTo({ left: Math.max(target, 0), behavior: "smooth" });
      }
      range.hidden = current < 0;
      if (current >= 0) {
        const p = phases[current];
        range.style.left = pct(p.startSec);
        range.style.width = `calc(${pct(p.endSec)} - ${pct(p.startSec)})`;
        now.textContent = `현재 구간 · ${p.label}`;
      } else {
        now.textContent = "눈금이나 단계를 누르면 그 시점으로 이동해요";
      }
    }

    layout();
    sync();
    if (video) {
      // 리포트를 다시 그릴 때마다 덮어써서 중복 등록되지 않게 속성으로 연결
      video.ontimeupdate = sync;
      video.onseeked = sync;
      video.onloadedmetadata = () => {
        layout();
        sync();
      };
    }
  }

  // ===================== 지표 카드 (핵심 지표 / 상세 분석 공통) =====================
  let helpSeq = 0;
  function metricCard(config, def, metric) {
    const item = el("div", "metric-card");
    const head = el("div", "metric-card__head");
    head.appendChild(el("span", "metric-card__label", def.label));
    item.appendChild(head);
    const help = METRIC_HELP[def.key];
    if (help) {
      // ⓘ 를 누르면 카드 안에 한 줄 설명이 열리고, 다시 누르면 닫힘
      const btn = el("button", "metric-help", "ⓘ");
      btn.type = "button";
      btn.setAttribute("aria-label", `${def.label} 설명 보기`);
      btn.setAttribute("aria-expanded", "false");
      const text = el("p", "metric-card__help", help);
      text.id = `metric-help-${++helpSeq}`;
      text.hidden = true;
      btn.setAttribute("aria-controls", text.id);
      btn.addEventListener("click", () => {
        text.hidden = !text.hidden;
        btn.setAttribute("aria-expanded", String(!text.hidden));
      });
      head.appendChild(btn);
      item.appendChild(text);
    }
    item.append(el("span", "metric-card__value", metric ? formatNumber(metric.value, metric.unit) : "—"));
    const unit = UNITS[metric ? metric.unit : def.unit];
    const notes = [unit && unit.basis, metric && metric.at ? `${phaseLabel(config, metric.at)} 시점` : null].filter(Boolean);
    if (notes.length) item.append(el("span", "metric-card__note", notes.join(" · ")));
    return item;
  }

  function renderMetricGrid(body, config, defs, values) {
    const grid = el("div", "metric-grid");
    let filled = 0;
    defs.forEach((def) => {
      const metric = metricOf(values, def);
      if (metric) filled += 1;
      grid.appendChild(metricCard(config, def, metric));
    });
    if (defs.length) body.appendChild(grid);
    if (!filled) body.appendChild(pendingNote());
  }

  // ===================== ② 핵심 지표 4개 =====================
  /** 핵심 지표로 보여줄 [카테고리, 지표 정의] 목록 (값이 있는 것만, 4개가 안 되면 측정된 다른 지표로 채움) */
  function keyMetricDefs(config, result, view) {
    const picked = [];
    const add = (cat, def) => {
      if (!def || picked.length >= 4 || picked.some((p) => p.def === def)) return;
      if (metricOf(result[cat], def)) picked.push({ cat, def });
    };
    config.keyMetrics.forEach(([cat, key]) => add(cat, config[cat].find((d) => d.key === key)));
    ["angles", "movement", "timing"].forEach((cat) => {
      visibleDefs(config[cat], result[cat], view)
        .filter((def) => def.kind !== "event") // 시작 시점(몇 초에 시작했는지)은 핵심 지표로 보기 어려워 제외
        .forEach((def) => add(cat, def));
    });
    return picked;
  }

  /** 변화 표시 문구: API 가 changes[key] 를 주면 그대로, 없으면 같은 단위일 때만 표시용 뺄셈 */
  function changeText(prev, def, before, now) {
    const apiChange = prev.changes && typeof prev.changes[def.key] === "number" ? prev.changes[def.key] : null;
    if (apiChange != null && now) return formatChange(apiChange, now.unit);
    if (before && now && before.unit === now.unit) return formatChange(now.value - before.value, now.unit);
    return null;
  }

  function renderKeyMetrics(body, config, result, view) {
    const picked = keyMetricDefs(config, result, view);
    if (!picked.length) {
      body.appendChild(pendingNote());
      return;
    }
    const prev = comparablePrevious(result);
    const grid = el("div", "metric-grid metric-grid--key");
    picked.forEach(({ cat, def }) => {
      const now = metricOf(result[cat], def);
      const item = metricCard(config, def, now);
      item.classList.add("metric-card--key");
      // 이전 분석(같은 촬영 방향)에 같은 지표가 있을 때만 "이전 대비" 를 사실대로 (좋고 나쁨 색은 쓰지 않음)
      const change = prev ? changeText(prev, def, metricOf(prev[cat], def), now) : null;
      if (change) item.appendChild(el("span", "metric-card__change", `이전 대비 ${change}`));
      grid.appendChild(item);
    });
    body.appendChild(grid);
  }

  // ===================== ② AI 분석 요약 (피드백 최대 3개) =====================
  // 피드백 한 개 = 측정 결과 → 기본적인 야구 동작 관점의 의미 → 다음 촬영에서 확인해볼 부분.
  // 단정하지 않는 표현만 사용 ("~로 측정되었습니다", "~에 영향을 줄 수 있습니다", "~를 확인해볼 수 있습니다").
  // 비교 기준이 없으면 짧다/길다/크다/작다를 쓰지 않고, 이전 분석(같은 촬영 방향)이 있을 때만 이전 값을 함께 적음.
  const MAX_FEEDBACK = 3;

  /** 피드백 문장 재료: 지표 값/이전 값/측정 시점 */
  function feedbackContext(result) {
    const config = configOf(result);
    const prev = comparablePrevious(result);
    const find = (cat, key) => config[cat].find((d) => d.key === key);
    return {
      /** 지금 값 ("신장 대비 74.0%" / "96.4°"), 없으면 null */
      value(cat, key) {
        const m = metricOf(result[cat], find(cat, key));
        return m ? formatWithBasis(m) : null;
      },
      /** "릴리스 시점의 " 처럼 측정 시점 머리말 (없으면 "") */
      at(cat, key) {
        const m = metricOf(result[cat], find(cat, key));
        return m && m.at ? `${phaseLabel(config, m.at)} 시점의 ` : "";
      },
      /** 이전 분석에 같은 지표가 있으면 " 이전 분석(2026.09.20)에서는 72.0%로 측정되었습니다." */
      previous(cat, key) {
        const before = prev ? metricOf(prev[cat], find(cat, key)) : null;
        if (!before) return "";
        return ` 이전 분석(${prev.analyzedAt || "직전 기록"})에서는 ${formatWithBasis(before)}로 측정되었습니다.`;
      },
    };
  }

  /** 우선순위대로 만들어 보고 값이 있는 것만 최대 3개 */
  function buildFeedback(result, builders) {
    const ctx = feedbackContext(result);
    return builders
      .map((build) => build(ctx))
      .filter(Boolean)
      .slice(0, MAX_FEEDBACK);
  }

  const PITCH_FEEDBACK = [
    (c) => {
      const v = c.value("movement", "strideLength");
      return v && {
        category: "movement",
        title: "스트라이드",
        text: `이번 투구의 스트라이드 길이는 ${v}로 측정되었습니다.${c.previous("movement", "strideLength")} 스트라이드 크기는 하체 이동과 이후 몸통 회전 동작에 영향을 줄 수 있습니다. 다음 투구에서 보폭을 조금 다르게 했을 때 상체 움직임과 릴리스 위치가 어떻게 달라지는지 확인해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("angles", "elbowAngleAtRelease");
      return v && {
        category: "angles",
        title: "릴리스 팔꿈치",
        text: `릴리스 시 팔꿈치 각도는 ${v}로 측정되었습니다.${c.previous("angles", "elbowAngleAtRelease")} 이 각도는 투구 팔의 위치와 상체 자세에 따라 함께 달라질 수 있습니다. 다음 촬영에서 상체 전방 기울기와 함께 비교하면 팔 위치가 어떻게 바뀌는지 확인해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("timing", "pelvisToShoulderSec");
      return v && {
        category: "timing",
        title: "회전 순서",
        text: `골반 회전이 시작된 뒤 ${v} 후에 어깨 회전이 시작되는 움직임이 확인되었습니다.${c.previous("timing", "pelvisToShoulderSec")} 하체와 상체 회전 사이의 시간차는 몸통 동작이 이어지는 흐름을 확인할 때 참고할 수 있는 지표입니다. 다음 투구에서 앞발 착지 시점과 함께 이 시간차가 어떻게 달라지는지 비교해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("angles", "trunkForwardTilt");
      return v && {
        category: "angles",
        title: "상체 기울기",
        text: `${c.at("angles", "trunkForwardTilt")}상체 전방 기울기는 ${v}로 측정되었습니다.${c.previous("angles", "trunkForwardTilt")} 상체 기울기는 릴리스 위치와 팔 높이에 영향을 줄 수 있습니다. 다음 촬영에서 스트라이드 길이를 달리했을 때 상체 기울기가 함께 달라지는지 확인해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("movement", "headDisplacement");
      return v && {
        category: "movement",
        title: "머리 움직임",
        text: `투구 동작 동안 머리 이동량은 ${v}로 측정되었습니다.${c.previous("movement", "headDisplacement")} 머리 위치 변화는 시선과 신체 중심의 이동과 함께 확인할 수 있는 지표입니다. 다음 투구에서 머리 위치를 조금 더 유지했을 때 릴리스 위치가 어떻게 달라지는지 확인해볼 수 있습니다.`,
      };
    },
  ];

  const BATTING_FEEDBACK = [
    (c) => {
      const v = c.value("movement", "headDisplacement");
      return v && {
        category: "movement",
        title: "머리 움직임",
        text: `이번 스윙에서 머리 이동량은 ${v}로 측정되었습니다.${c.previous("movement", "headDisplacement")} 머리 이동은 스윙 중 시선과 신체 중심의 변화와 함께 확인할 수 있는 지표입니다. 다음 스윙에서 머리 위치를 조금 더 유지했을 때 전체 움직임이 어떻게 달라지는지 확인해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("movement", "strideLength");
      return v && {
        category: "movement",
        title: "스트라이드",
        text: `이번 스윙의 스트라이드 길이는 ${v}로 측정되었습니다.${c.previous("movement", "strideLength")} 스트라이드 크기는 체중 이동과 이후 몸통 회전에 영향을 줄 수 있습니다. 다음 스윙에서 보폭을 조금 다르게 했을 때 앞무릎 각도와 상체 기울기가 어떻게 달라지는지 비교해볼 수 있습니다.`,
      };
    },
    (c) => {
      const landing = c.value("timing", "frontFootLandingSec");
      const swing = c.value("timing", "swingStartSec");
      return landing && swing && {
        category: "timing",
        title: "착지와 스윙 시작",
        text: `앞발 착지는 ${landing}, 스윙 시작은 ${swing} 시점으로 측정되었습니다. 앞발 착지 시점은 이후 몸통 회전과 스윙 동작의 연결을 확인할 때 참고할 수 있습니다. 다음 스윙에서 두 시점 사이의 간격이 어떻게 달라지는지 확인해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("angles", "frontKneeAngle");
      return v && {
        category: "angles",
        title: "앞무릎",
        text: `${c.at("angles", "frontKneeAngle")}앞무릎 각도는 ${v}로 측정되었습니다.${c.previous("angles", "frontKneeAngle")} 앞다리 무릎 각도는 체중 이동과 몸통 회전 과정에서 함께 달라질 수 있습니다. 다음 스윙에서 스트라이드 길이와 함께 비교해볼 수 있습니다.`,
      };
    },
    (c) => {
      const v = c.value("timing", "pelvisToShoulderSec");
      return v && {
        category: "timing",
        title: "회전 순서",
        text: `골반 회전이 시작된 뒤 ${v} 후에 어깨 회전이 시작되는 움직임이 확인되었습니다.${c.previous("timing", "pelvisToShoulderSec")} 하체와 상체 회전 사이의 시간차는 스윙 동작이 이어지는 흐름을 확인할 때 참고할 수 있는 지표입니다. 다음 스윙에서 이 시간차가 어떻게 달라지는지 비교해볼 수 있습니다.`,
      };
    },
  ];

  /**
   * 투구 피드백 (측정값이 있는 항목만, 최대 3개)
   * @param {AnalysisReport} result
   * @returns {{category: string, title: string, text: string}[]}
   */
  function generatePitchFeedback(result) {
    return buildFeedback({ ...result, analysisType: "pitching" }, PITCH_FEEDBACK);
  }

  /** 타격 피드백 (측정값이 있는 항목만, 최대 3개) @param {AnalysisReport} result */
  function generateBattingFeedback(result) {
    return buildFeedback({ ...result, analysisType: "batting" }, BATTING_FEEDBACK);
  }

  /**
   * AI 분석 요약 목록. Spring API 가 observations 배열을 주면 그대로 쓰고(최대 3개),
   * 없으면 투구/타격 피드백 함수로 측정값에서 만듦.
   * observations 항목: 문자열 또는 { category?, title?, text }
   * @param {AnalysisReport} result
   * @returns {{category: string|null, title: string|null, text: string}[]}
   */
  function generateAnalysisSummary(result) {
    const observations = Array.isArray(result.observations) ? result.observations : [];
    const given = observations
      .map((o) =>
        typeof o === "string"
          ? { category: null, title: null, text: o }
          : o && typeof o.text === "string"
            ? { category: o.category || null, title: o.title || null, text: o.text }
            : null
      )
      .filter(Boolean)
      .slice(0, MAX_FEEDBACK);
    if (given.length) return given;
    const type = result.analysisType || state.type;
    return type === "batting" ? generateBattingFeedback(result) : generatePitchFeedback(result);
  }

  function renderAiSummary(body, result) {
    const box = el("div", "report-ai");
    box.appendChild(el("h3", "report-ai__title", "AI 분석 요약"));
    const items = generateAnalysisSummary(result);
    if (!items.length) {
      box.appendChild(pendingNote("측정값이 들어오면 AI가 주요 관찰 포인트를 정리해드려요."));
      body.appendChild(box);
      return;
    }
    const categoryTitle = (key) => (CATEGORIES.find((c) => c.key === key) || {}).title || null;
    const list = el("ul", "report-ai__list");
    items.forEach((item) => {
      const li = el("li", "report-ai__item");
      const head = el("div", "report-ai__head");
      if (item.title) head.appendChild(el("strong", "report-ai__name", item.title));
      const tag = categoryTitle(item.category);
      if (tag) head.appendChild(el("span", "report-ai__tag", tag));
      if (head.childNodes.length) li.appendChild(head);
      li.appendChild(el("p", "report-ai__text", item.text));
      list.appendChild(li);
    });
    box.appendChild(list);
    body.appendChild(box);
  }

  // ===================== ③ 상세 분석: [관절·자세] [움직임] [타이밍] =====================
  function renderTimingPanel(body, config, result, view) {
    const values = result.timing || {};
    const defs = visibleDefs(config.timing, values, view);
    const events = defs
      .filter((d) => d.kind === "event")
      .map((def) => ({ def, metric: metricOf(values, def) }));
    const measured = events.filter((e) => e.metric).sort((a, b) => toSec(a.metric) - toSec(b.metric));
    const missing = events.filter((e) => !e.metric);

    // 시작 시점 (시간순)
    body.appendChild(el("h3", "metric-group__title", "동작 시작 시점"));
    const list = el("ol", "timing-events");
    [...measured, ...missing].forEach(({ def, metric }) => {
      const li = el("li", `timing-events__item${metric ? "" : " timing-events__item--empty"}`);
      li.append(el("span", "timing-events__label", def.label), el("span", "timing-events__time", metric ? formatNumber(metric.value, metric.unit) : "—"));
      list.appendChild(li);
    });
    body.appendChild(list);

    // 동작 사이 시간차 + 전체 시간
    const spans = defs.filter((d) => d.kind !== "event");
    if (spans.length) {
      body.appendChild(el("h3", "metric-group__title metric-group__title--spaced", "시간차 · 전체 동작 시간"));
      const grid = el("div", "metric-grid");
      spans.forEach((def) => grid.appendChild(metricCard(config, def, metricOf(values, def))));
      body.appendChild(grid);
    }

    // 동작 속도: 신뢰할 수 있는 값이 올 때만 (현재 모델은 보내지 않음)
    const speedValues = result.speed || {};
    const speedDefs = visibleDefs(config.speed, speedValues, view).filter((def) => metricOf(speedValues, def));
    if (speedDefs.length) {
      body.appendChild(el("h3", "metric-group__title metric-group__title--spaced", "동작 속도"));
      renderMetricGrid(body, config, speedDefs, speedValues);
    }

    if (!measured.length && !spans.some((d) => metricOf(values, d))) body.appendChild(pendingNote());
    else body.appendChild(el("p", "report-card__meta", "시점은 영상 시작 기준이며, 공이 없는 영상이라 공 기준의 빠르고 늦음은 판단하지 않아요."));
  }

  const toSec = (metric) => (metric.unit === "ms" ? metric.value / 1000 : metric.value);

  /**
   * 상세 분석 탭 영역. 탭 하나를 누르면 그 영역만 보임 (보던 탭은 다시 그려도 유지)
   * @param {AnalysisReport} result
   * @param {HTMLElement} [body] 넣을 곳 (없으면 새 요소를 만들어 돌려줌)
   * @param {HTMLElement} [tabsTarget] 탭 버튼을 넣을 곳 (카드 제목 줄). 없으면 body 맨 위
   */
  function renderDetailMetrics(result, body = el("div"), tabsTarget = null) {
    const config = configOf(result);
    const view = cameraViewOf(result);
    const count = (cat) => visibleDefs(config[cat], result[cat], view).filter((def) => metricOf(result[cat], def)).length;
    const tabs = [
      {
        key: "angles",
        label: "관절·자세",
        desc: "관절 굽힘과 신체 기울기 (°)",
        render: (panel) => renderMetricGrid(panel, config, visibleDefs(config.angles, result.angles, view), result.angles),
      },
      {
        key: "movement",
        label: "움직임",
        desc: "신장·신체 기준 비율 (실제 거리 보정 전이라 cm 로 표시하지 않아요)",
        render: (panel) => renderMetricGrid(panel, config, visibleDefs(config.movement, result.movement, view), result.movement),
      },
      {
        key: "timing",
        label: "타이밍",
        desc: "동작 시작 시점과 동작 사이 시간차 (s)",
        render: (panel) => renderTimingPanel(panel, config, result, view),
      },
    ];
    if (!tabs.some((t) => t.key === state.detailTab)) state.detailTab = tabs[0].key;

    const bar = el("div", "report-tabs report-tabs--detail");
    bar.setAttribute("role", "tablist");
    bar.setAttribute("aria-label", "상세 분석 영역");
    const panels = {};
    const buttons = tabs.map((tab) => {
      const btn = el("button", "report-tab");
      btn.type = "button";
      btn.dataset.detailTab = tab.key;
      btn.setAttribute("role", "tab");
      btn.appendChild(el("span", null, tab.label));
      const n = count(tab.key);
      if (n) btn.appendChild(el("span", "report-tab__count", String(n)));
      bar.appendChild(btn);

      const panel = el("div", "report-detail__panel");
      panel.dataset.detailPanel = tab.key;
      panel.setAttribute("role", "tabpanel");
      panel.appendChild(el("p", "report-detail__desc", `${tab.desc} · ${CAMERA_VIEW_LABEL[view]} 촬영 기준`));
      tab.render(panel);
      panels[tab.key] = panel;
      return btn;
    });

    function select(key) {
      state.detailTab = key;
      buttons.forEach((btn) => {
        const active = btn.dataset.detailTab === key;
        btn.classList.toggle("report-tab--active", active);
        btn.setAttribute("aria-selected", String(active));
      });
      Object.entries(panels).forEach(([k, panel]) => {
        panel.hidden = k !== key;
      });
    }
    bar.addEventListener("click", (e) => {
      const btn = e.target.closest(".report-tab");
      if (btn) select(btn.dataset.detailTab);
    });
    (tabsTarget || body).appendChild(bar);
    body.append(...Object.values(panels));
    select(state.detailTab);
    return body;
  }

  // ===================== 분석 결과 안내 (작게, 눌러서 펼침) =====================
  function renderNotice(config) {
    const box = el("details", "report-notice");
    const summary = el("summary", "report-notice__summary");
    summary.append(el("span", "report-notice__icon", "ⓘ"), el("span", null, "분석 결과 안내"));
    box.append(summary, el("p", "report-notice__text", config.notice));
    return box;
  }

  // ===================== 전체 렌더링 =====================
  /**
   * 투구/타격 공통 리포트 렌더링.
   * @param {"pitching"|"batting"} type
   * @param {AnalysisReport|null} result
   * @param {{partial?: boolean}} [options] partial: 분석 중이라 ① 제목·메타·영상만
   */
  function renderAnalysisReport(type, result, options = {}) {
    const container = state.container;
    if (!container) return;
    const config = REPORT_CONFIG[type];
    state.type = type;
    state.result = result;

    const videoUrl = currentVideoUrl();
    container.hidden = !result && !videoUrl;
    // ① 영상 카드는 영상이 그대로면 다시 만들지 않음 (DOM 에서 빠지면 재생이 멈추므로)
    const keepVideo = !!(state.videoSection && state.videoSection.isConnected && videoUrl && state.videoSectionUrl === videoUrl);
    [...container.children].forEach((child) => {
      if (!(keepVideo && child === state.videoSection)) child.remove();
    });
    if (container.hidden) return;

    if (!keepVideo) {
      const video = card(config.titles.report, "report-card--main");
      renderVideoCard(video.body);
      state.videoSection = video.section;
      state.videoSectionUrl = videoUrl;
      container.appendChild(video.section);
    } else if (state.overlay) {
      state.overlay.setPose(result && result.pose ? result.pose : null);
    }

    if (state.isSample) {
      const badge = el("div", "report-sample-badge");
      badge.append(el("strong", null, "예시 데이터"), el("span", null, "화면 구성을 보여주기 위한 예시이며 실제 분석 결과가 아닙니다."));
      container.insertBefore(badge, container.firstChild);
    }

    const r = result || { analysisType: type, videoInfo: { status: "uploading", fileName: state.sourceName } };
    renderVideoMeta(state.videoSection, r);

    const full = result && !options.partial;
    // 동작 단계 타임라인은 ① 영상 바로 아래 (플레이어 안, 재생속도 줄 위)에 다시 그림
    state.videoSection.querySelectorAll(".phase-chapters").forEach((node) => node.remove());
    if (full) {
      const inPlayer = state.player && !state.isSample && state.videoSection.contains(state.player.element);
      if (inPlayer) {
        renderPhaseChapters(state.player.element, state.player.element.querySelector(".player__controls"), config, result);
      } else {
        renderPhaseChapters(state.videoSection.querySelector(".report-card__body"), null, config, result);
      }

      const view = cameraViewOf(r);
      const key = card("핵심 지표", "report-card--key");
      renderKeyMetrics(key.body, config, r, view);
      renderAiSummary(key.body, r);
      const detail = card("상세 분석", "report-card--detail");
      renderDetailMetrics(r, detail.body, detail.head);
      container.append(key.section, detail.section);
    }
    container.appendChild(renderNotice(config));
  }

  const renderPitchAnalysis = (result) => renderAnalysisReport("pitching", result);
  const renderBattingAnalysis = (result) => renderAnalysisReport("batting", result);

  // ===================== API 응답 → 리포트 =====================
  /**
   * GET /api/analysis/{id} 응답을 AnalysisReport 로 바꿈.
   * Spring 이 AI 결과를 DB 에 저장하고 record.report = { videoInfo, phases, angles, movement, timing, speed, observations,
   * previousAnalysis } 로 주면 그대로 표시. (previousAnalysis 는 Spring 이 같은 사용자의 직전 분석을 DB 에서 찾아 붙임)
   * 지금 AI 서버는 아직 측정값을 만들지 않아서 summary(fps/프레임 수)·pose·camera_view 만 채워짐.
   */
  function resultFromRecord(type, record) {
    const report = record.report || {};
    const summary = record.summary || {};
    const durationSec = summary.total_frames && summary.fps ? summary.total_frames / summary.fps : null;
    return {
      analysisType: type,
      videoInfo: {
        status: record.status,
        fileName: record.file_name,
        cameraView: record.camera_view || DEFAULT_VIEW,
        fps: summary.fps,
        durationSec,
        analyzedFrames: summary.analyzed_frames,
        detectedFrames: summary.detected_frames,
        analyzedAt: record.updated_at ? String(record.updated_at).slice(0, 10).replace(/-/g, ".") : null,
        ...(report.videoInfo || {}),
      },
      phases: report.phases || [],
      angles: report.angles || {},
      movement: report.movement || {},
      timing: report.timing || {},
      speed: report.speed || {},
      previousAnalysis: report.previousAnalysis || null,
      observations: Array.isArray(report.observations) ? report.observations : [],
      pose: record.pose || null,
    };
  }

  /** 분석이 끝난 영상의 관절 좌표(pose)는 용량이 커서 따로 한 번만 불러옴 */
  async function loadPose(record) {
    if (state.poseVideoId === record.video_id) return;
    state.poseVideoId = record.video_id;
    try {
      const full = await window.BROS.api.request(`/api/analysis/${encodeURIComponent(record.video_id)}?includePose=true`);
      if (state.result && full.pose) {
        state.result.pose = full.pose;
        if (state.overlay) state.overlay.setPose(full.pose);
      }
    } catch (e) {
      state.poseVideoId = null; // 다음 조회 때 다시 시도
    }
  }

  /**
   * js/analysis.js 가 분석 상태를 조회할 때마다 호출. 진행 중에는 영상/기본 정보만, 끝나면 전체 리포트.
   * @param {"pitching"|"batting"} type
   * @param {object} record GET /api/analysis/{id} 응답
   */
  function showFromRecord(type, record) {
    if (type !== state.type || !record) return;
    // 분석 중에는 2초마다 조회되므로, 영상이나 상태가 바뀔 때만 다시 그림
    const key = `${record.video_id}:${record.status}`;
    if (key === state.lastRecordKey && !state.isSample) return;
    state.lastRecordKey = key;
    state.isSample = false;
    const result = resultFromRecord(type, record);
    // 진행 중인 동안에는 영상만 (분석 상태는 위쪽 "최근 분석 결과" 카드에 표시됨)
    renderAnalysisReport(type, result, { partial: record.status !== "done" });
    if (record.status === "done") loadPose(record);
  }

  /** 방금 업로드/촬영한 영상을 ① 에 연결 (js/capture.js). 새 영상이므로 이전 결과는 지움 */
  function setSourceVideo(url, fileName) {
    state.sourceUrl = url;
    state.sourceName = fileName;
    state.isSample = false;
    state.poseVideoId = null;
    state.lastRecordKey = null;
    renderAnalysisReport(state.type, null);
  }

  function showSample(type) {
    state.isSample = true;
    renderAnalysisReport(type, SAMPLE_RESULTS[type]);
    state.container.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /** 페이지 시작 시 한 번: 어떤 리포트인지와 그릴 자리를 정하고 "예시 리포트 보기" 버튼을 연결 */
  function init(type, container) {
    state.type = type;
    state.container = container;
    container.hidden = true;
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-report-sample]")) showSample(state.type);
    });
  }

  window.BROS = window.BROS || {};
  window.BROS.report = {
    REPORT_CONFIG,
    init,
    renderAnalysisReport,
    renderPitchAnalysis,
    renderBattingAnalysis,
    generatePitchFeedback,
    generateBattingFeedback,
    generateAnalysisSummary,
    renderDetailMetrics,
    showFromRecord,
    setSourceVideo,
    showSample,
  };
})();
