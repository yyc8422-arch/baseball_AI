/**
 * BROS - 투구/타격 AI 분석 리포트 (pitching.html, batting.html 공통)
 *
 * 이 리포트는 자세를 평가(좋음/나쁨, 권장 범위, 개선 포인트)하지 않고,
 * 영상에서 추출한 신체 좌표·움직임을 "측정 → 기록 → 이전 영상과 비교" 하는 화면입니다.
 * 흐름: 프론트 → Spring Boot → Python AI(분석) → Spring Boot(결과 DB 저장 + 이전 분석 비교 추가) → 프론트.
 * 프론트는 AI 서버와 직접 통신하지 않고, Spring API(GET /api/analysis/{id}) 결과를 그대로 그리기만 합니다 (Pose 계산 없음).
 * (예외: 이전 분석 비교의 "변화" 칸은 표시용으로 현재 - 이전 을 뺄셈만 함. API 가 changes 를 주면 그 값을 그대로 씀)
 *
 * 수치는 성격에 맞는 단위로만 표시합니다.
 *   관절 굽힘/기울기 → °   신체 이동 → 신장·신체·어깨너비 대비 % 또는 정규화 좌표 (실제 거리 보정 전이라 cm 금지)
 *   동작 시점/시간차 → s·ms   회전/관절 속도 → °/s
 *
 * 화면 순서: ① 분석 영상 (+ 영상 아래 동작 단계 타임라인) ② 영상 정보 ③ 관절 및 자세 ④ 움직임
 *           ⑤ 동작 타이밍 ⑥ 동작 속도 (추후 지원) ⑦ 이전 분석 비교 + 분석 안내
 *
 * 촬영 방향(side / front / rear)마다 측정할 수 있는 지표가 달라서, 지표마다 views 를 두고
 * 지금 영상의 촬영 방향에 맞는 지표만 보여줍니다 (기본 side). optional 지표는 값이 올 때만 보여줌.
 *
 * 연결 함수 (Spring API 결과 → 화면):
 *   renderPitchAnalysis(result) / renderBattingAnalysis(result)   result 형식은 js/types.js 의 AnalysisReport
 *   generateAnalysisSummary(result)  측정 요약 문장 목록 (Spring 이 준 observations, 없으면 측정한 항목 수만 사실대로)
 *   renderPreviousComparison(result) 이전 분석 비교 (같은 카테고리·같은 단위끼리)
 *   showFromRecord(type, record)  GET /api/analysis/{id} 응답(record)을 AnalysisReport 로 바꿔서 그림 (js/analysis.js 가 호출)
 *   setSourceVideo(url, fileName) 방금 업로드한 영상을 ① 에 연결 (js/capture.js 가 호출)
 */
(function () {
  // ===================== 표시 단위 =====================
  // API 는 지표마다 unit 을 보낼 수 있고(없으면 아래 지표 정의의 기본 단위), 나중에 신장/기준 물체로 실제 거리 보정이 되면
  // unit 만 "cm" 로 보내면 그대로 표시됩니다. basis = 값 아래에 붙는 기준 설명.
  const UNITS = {
    deg: { suffix: "°", digits: 1 },
    pct_height: { suffix: "%", digits: 1, basis: "신장 대비" },
    pct_body: { suffix: "%", digits: 1, basis: "신체 기준" },
    pct_shoulder: { suffix: "%", digits: 1, basis: "어깨너비 대비" },
    norm: { suffix: "", digits: 3, basis: "정규화 좌표 변화" },
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

  /** 리포트 카테고리 (이전 분석 비교도 이 순서/묶음으로) */
  const CATEGORIES = [
    { key: "angles", title: "관절 및 자세", en: "Angle" },
    { key: "movement", title: "움직임", en: "Movement" },
    { key: "timing", title: "동작 타이밍", en: "Timing" },
    { key: "speed", title: "동작 속도", en: "Speed" },
  ];

  // ===================== 투구/타격 설정 (서로 다른 건 이 값들뿐, 화면 코드는 공통) =====================
  // 지표 정의: key(API 필드), label, unit(기본 단위), views(측정 가능한 촬영 방향), optional(값이 올 때만 표시)
  //           timing 은 kind: event(시작 시점) / interval(동작 사이 시간차) / total(전체 동작 시간)
  const REPORT_CONFIG = {
    pitching: {
      noun: "투구",
      titles: { phases: "투구 동작 단계", compare: "이전 투구 분석 비교" },
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
        { key: "headDisplacement", label: "머리 이동량", unit: "pct_body", views: SIDE },
        { key: "pelvisDisplacement", label: "골반 이동량", unit: "pct_body", views: SIDE },
        { key: "strideLength", label: "스트라이드 길이", unit: "pct_height", views: SIDE },
        { key: "legLiftHeight", label: "레그 리프트 높이", unit: "pct_height", views: SIDE },
        { key: "releasePointShift", label: "릴리스 위치 변화", unit: "pct_body", views: SIDE, optional: true },
        { key: "lateralCenterShift", label: "좌우 중심 이동", unit: "pct_shoulder", views: FRONT_REAR },
      ],
      timing: [
        { key: "legLiftPeakSec", label: "레그 리프트 최고점", kind: "event" },
        { key: "strideStartSec", label: "스트라이드 시작", kind: "event" },
        { key: "frontFootLandingSec", label: "앞발 착지", kind: "event" },
        { key: "pelvisRotationStartSec", label: "골반 회전 시작", kind: "event" },
        { key: "shoulderRotationStartSec", label: "어깨 회전 시작", kind: "event" },
        { key: "armAccelerationStartSec", label: "팔 가속 시작", kind: "event" },
        { key: "releaseSec", label: "릴리스", kind: "event" },
        { key: "pelvisToShoulderSec", label: "골반 회전 → 어깨 회전", kind: "interval" },
        { key: "landingToReleaseSec", label: "앞발 착지 → 릴리스", kind: "interval", optional: true },
        { key: "totalMotionSec", label: "전체 투구 동작 시간", kind: "total" },
      ],
      // 현재 모델에서 신뢰할 수 있는 값이 없어 "추후 지원" 으로 표시. API 가 값을 보내면 자동으로 카드가 보임
      speed: [
        { key: "pelvisAngularVelocityMax", label: "골반 회전 최대 각속도", unit: "deg_per_sec" },
        { key: "trunkAngularVelocityMax", label: "몸통 회전 최대 각속도", unit: "deg_per_sec" },
        { key: "elbowExtensionVelocityMax", label: "팔꿈치 신전 최대 각속도", unit: "deg_per_sec" },
      ],
      notice:
        "본 리포트는 영상에서 추출한 신체 좌표와 동작 데이터를 수치화한 결과입니다. 특정 수치만으로 투구폼의 우수성이나 부상 위험을 판단하지 않습니다.",
    },
    batting: {
      noun: "타격",
      titles: { phases: "타격 동작 단계", compare: "이전 타격 분석 비교" },
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
        { key: "headDisplacement", label: "머리 이동량", unit: "pct_body", views: SIDE },
        { key: "pelvisDisplacement", label: "골반 이동량", unit: "pct_body", views: SIDE },
        { key: "strideLength", label: "스트라이드 길이", unit: "pct_height", views: SIDE },
        { key: "centerOfMassShift", label: "체중 이동에 따른 신체 중심 이동", unit: "pct_body", views: SIDE },
        { key: "lateralCenterShift", label: "좌우 중심 이동", unit: "pct_shoulder", views: FRONT_REAR },
      ],
      timing: [
        { key: "loadStartSec", label: "로드 시작", kind: "event" },
        { key: "strideStartSec", label: "스트라이드 시작", kind: "event" },
        { key: "frontFootLandingSec", label: "앞발 착지", kind: "event" },
        { key: "pelvisRotationStartSec", label: "골반 회전 시작", kind: "event" },
        { key: "shoulderRotationStartSec", label: "어깨 회전 시작", kind: "event" },
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
        "본 리포트는 영상에서 추출한 신체 좌표와 동작 데이터를 수치화한 결과입니다. 특정 수치만으로 타격폼의 우수성이나 경기 수행 능력을 판단하지 않습니다.",
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
      movement: { headDisplacement: 3.8, pelvisDisplacement: 11.2, strideLength: 75, legLiftHeight: 48.5 },
      timing: {
        legLiftPeakSec: 0.54,
        strideStartSec: 0.66,
        frontFootLandingSec: 0.91,
        pelvisRotationStartSec: 0.88,
        shoulderRotationStartSec: 0.97,
        armAccelerationStartSec: 1.0,
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
      movement: { headDisplacement: 2.9, pelvisDisplacement: 8.4, strideLength: 46, centerOfMassShift: 12.5 },
      timing: {
        loadStartSec: 0.48,
        strideStartSec: 0.86,
        frontFootLandingSec: 1.1,
        pelvisRotationStartSec: 1.12,
        shoulderRotationStartSec: 1.2,
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
    const raw = group ? group[def.key] : undefined;
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

  /** 이 촬영 방향에서 보여줄 지표 (optional 은 값이 있을 때만, 다른 방향 지표도 API 가 값을 보내면 표시) */
  function visibleDefs(defs, values, view) {
    return defs.filter((def) => {
      const hasValue = !!metricOf(values, def);
      if (def.optional) return hasValue;
      return def.views.includes(view) || hasValue;
    });
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
  };

  // ===================== 카드 틀 =====================
  function card(step, title, description) {
    const section = el("section", "page-card report-card");
    const head = el("div", "report-card__head");
    head.append(el("span", "report-card__step", String(step).padStart(2, "0")), el("h2", "report-card__title", title));
    section.appendChild(head);
    if (description) section.appendChild(el("p", "report-card__desc", description));
    const body = el("div", "report-card__body");
    section.appendChild(body);
    return { section, body };
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
    player.setSource(url); // 새 영상이면 재생속도는 1.0x 로 다시 시작
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

  // ===================== ② 영상 정보 (작은 칩 한 줄) =====================
  const STATUS_LABEL = { uploading: "업로드 중", queued: "분석 대기", processing: "분석 중", done: "분석 완료", failed: "분석 실패" };

  function countMetrics(config, result) {
    return ["angles", "movement", "timing", "speed"].reduce(
      (sum, cat) => sum + config[cat].filter((def) => metricOf(result[cat], def)).length,
      0
    );
  }

  function renderInfoCard(body, config, result) {
    const info = result.videoInfo || {};
    const count = info.metricCount != null ? info.metricCount : countMetrics(config, result);
    const items = [
      ["분석 상태", STATUS_LABEL[info.status] || info.status],
      ["촬영 방향", CAMERA_VIEW_LABEL[cameraViewOf(result)]],
      ["영상 FPS", info.fps != null ? `${Number(info.fps).toFixed(0)} fps` : null],
      ["영상 길이", info.durationSec != null ? `${Number(info.durationSec).toFixed(1)}s` : null],
      ["분석 프레임", info.analyzedFrames != null ? `${info.analyzedFrames}프레임` : null],
      ["측정 지표", info.status === "done" ? `${count}개` : null],
    ];
    const list = el("dl", "report-info");
    items.forEach(([label, value]) => {
      const item = el("div", "report-info__item");
      item.append(el("dt", null, label), el("dd", null, value || "—"));
      list.appendChild(item);
    });
    body.appendChild(list);
    const sub = [info.fileName, info.analyzedAt ? `분석일 ${info.analyzedAt}` : null].filter(Boolean).join(" · ");
    if (sub) body.appendChild(el("p", "report-card__meta", sub));

    // 측정 요약: 평가 없이 사실만 (분석이 끝난 경우만)
    if (info.status !== "done") return;
    const summary = generateAnalysisSummary(result);
    const box = el("div", "report-summary");
    box.appendChild(el("h3", "metric-group__title", "측정 요약"));
    const ul = el("ul", "report-summary__list");
    summary.forEach((item) => {
      const li = el("li", "report-summary__item");
      if (item.category) li.appendChild(el("span", "report-summary__tag", item.category));
      li.appendChild(el("span", null, item.text));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    body.appendChild(box);
  }

  /**
   * 측정 요약 문장 목록. Spring API 가 observations 배열을 주면 그대로 쓰고,
   * 없으면 "무엇을 몇 개 측정했는지" 만 사실대로 만듦 (좋다/나쁘다 같은 평가 문장은 만들지 않음).
   * observations 항목: 문자열 또는 { category?: "angles"|"movement"|"timing"|"speed", text }
   * @param {AnalysisReport} result
   * @returns {{category: string|null, text: string}[]}
   */
  function generateAnalysisSummary(result) {
    const categoryTitle = (key) => (CATEGORIES.find((c) => c.key === key) || {}).title || null;
    const observations = Array.isArray(result.observations) ? result.observations : [];
    const given = observations
      .map((o) => (typeof o === "string" ? { category: null, text: o } : o && typeof o.text === "string" ? { category: categoryTitle(o.category), text: o.text } : null))
      .filter(Boolean);
    if (given.length) return given;

    const config = REPORT_CONFIG[result.analysisType] || REPORT_CONFIG[state.type];
    const view = CAMERA_VIEW_LABEL[cameraViewOf(result)];
    const counts = CATEGORIES.slice(0, 3)
      .map((cat) => ({ cat, n: config[cat.key].filter((def) => metricOf(result[cat.key], def)).length }))
      .filter((x) => x.n > 0);
    if (!counts.length) {
      return [{ category: null, text: "아직 측정된 지표가 없어요. AI 측정 기능이 연결되면 이곳에 측정 내용이 정리됩니다." }];
    }
    const lines = [
      { category: null, text: `${view} 촬영 영상에서 ${counts.map((x) => `${x.cat.title} ${x.n}개`).join(" · ")} 지표를 측정했어요.` },
    ];
    const prev = result.previousAnalysis;
    if (prev && (!prev.cameraView || prev.cameraView === cameraViewOf(result))) {
      const shared = CATEGORIES.reduce(
        (sum, cat) => sum + config[cat.key].filter((def) => metricOf(prev[cat.key], def) && metricOf(result[cat.key], def)).length,
        0
      );
      if (shared) lines.push({ category: null, text: `${prev.analyzedAt || "이전"} 분석과 같은 지표 ${shared}개를 이전 분석 비교에서 나란히 볼 수 있어요.` });
    }
    return lines;
  }

  // ===================== ③ 관절 및 자세 / ④ 움직임 / ⑥ 동작 속도 : 지표 카드 =====================
  function metricCard(config, def, metric) {
    const item = el("div", "metric-card");
    item.append(el("span", "metric-card__label", def.label));
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

  // ===================== ⑤ 동작 타이밍: 시작 시점 순서 + 시간차/전체 시간 =====================
  function renderTimingCard(body, config, result, view) {
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
    if (!measured.length && !spans.some((d) => metricOf(values, d))) body.appendChild(pendingNote());
    else body.appendChild(el("p", "report-card__meta", "시점은 영상 시작 기준입니다."));
  }

  const toSec = (metric) => (metric.unit === "ms" ? metric.value / 1000 : metric.value);

  // ===================== ⑥ 동작 속도 (추후 지원) =====================
  function renderSpeedCard(body, config, result, view) {
    const values = result.speed || {};
    const defs = visibleDefs(config.speed, values, view).filter((def) => metricOf(values, def));
    if (defs.length) {
      renderMetricGrid(body, config, defs, values);
      return;
    }
    body.appendChild(
      pendingNote(
        `현재 모델에서는 신뢰할 수 있는 속도 값을 제공하지 않아 표시하지 않아요. 지원 예정: ${config.speed.map((d) => d.label).join(" · ")}`
      )
    );
  }

  // ===================== ⑦ 이전 분석 비교 (같은 카테고리·같은 단위끼리) =====================
  function renderCompareCard(body, config, result, view) {
    const prev = result.previousAnalysis;
    if (!prev) {
      body.appendChild(pendingNote(`비교할 이전 ${config.noun} 분석이 없어요. 같은 촬영 방향으로 다시 분석하면 이전 결과와 나란히 볼 수 있어요.`));
      return;
    }
    if (prev.cameraView && prev.cameraView !== view) {
      body.appendChild(pendingNote("이전 분석과 촬영 방향이 달라 수치를 비교하지 않아요."));
      return;
    }
    const info = result.videoInfo || {};
    body.appendChild(
      el("p", "report-card__meta", `이전 ${prev.analyzedAt || "-"}${prev.fileName ? ` (${prev.fileName})` : ""} → 현재 ${info.analyzedAt || "-"}`)
    );

    const wrap = el("div", "compare-table-wrap");
    const table = el("table", "compare-table");
    const thead = el("thead");
    const headRow = el("tr");
    ["지표", "이전", "현재", "변화"].forEach((h) => headRow.appendChild(el("th", null, h)));
    thead.appendChild(headRow);
    table.appendChild(thead);

    let rows = 0;
    CATEGORIES.forEach((cat) => {
      const pairs = config[cat.key]
        .map((def) => ({ def, before: metricOf(prev[cat.key], def), now: metricOf(result[cat.key], def) }))
        .filter((p) => p.before || p.now);
      if (!pairs.length) return;
      const tbody = el("tbody");
      const groupRow = el("tr", "compare-table__group");
      const groupCell = el("th", null, cat.title);
      groupCell.colSpan = 4;
      groupRow.appendChild(groupCell);
      tbody.appendChild(groupRow);
      pairs.forEach(({ def, before, now }) => {
        const sameUnit = before && now && before.unit === now.unit;
        // API 가 changes[key] 를 주면 그대로, 없으면 같은 단위일 때만 표시용 뺄셈
        const apiChange = prev.changes && typeof prev.changes[def.key] === "number" ? prev.changes[def.key] : null;
        let changeText = "—";
        if (apiChange != null && now) changeText = formatChange(apiChange, now.unit);
        else if (sameUnit) changeText = formatChange(now.value - before.value, now.unit);
        else if (before && now) changeText = "단위 다름";
        const tr = el("tr");
        tr.append(
          el("th", null, def.label),
          el("td", null, before ? formatNumber(before.value, before.unit) : "—"),
          el("td", null, now ? formatNumber(now.value, now.unit) : "—"),
          el("td", "compare-table__change", changeText)
        );
        tbody.appendChild(tr);
        rows += 1;
      });
      table.appendChild(tbody);
    });
    if (!rows) {
      body.appendChild(pendingNote("이전 분석과 같이 측정된 지표가 없어요."));
      return;
    }
    wrap.appendChild(table);
    body.appendChild(wrap);
    body.appendChild(el("p", "report-card__meta", "변화는 현재 값에서 이전 값을 뺀 수치이며, 지표마다 원래 단위로 표시합니다."));
  }

  /**
   * 이전 분석 비교 (공개 함수). body 를 주면 그 안에, 없으면 새 요소에 그려서 돌려줌.
   * @param {AnalysisReport} result  result.previousAnalysis 가 있어야 비교표가 그려짐
   * @param {HTMLElement} [body]
   */
  function renderPreviousComparison(result, body = el("div")) {
    const config = REPORT_CONFIG[result.analysisType] || REPORT_CONFIG[state.type];
    renderCompareCard(body, config, result, cameraViewOf(result));
    return body;
  }

  // ===================== 분석 안내 =====================
  function renderNotice(config) {
    const box = el("aside", "report-notice");
    box.append(el("span", "report-notice__icon", "ⓘ"), el("p", "report-notice__text", config.notice));
    return box;
  }

  // ===================== 전체 렌더링 =====================
  /**
   * 투구/타격 공통 리포트 렌더링.
   * @param {"pitching"|"batting"} type
   * @param {AnalysisReport|null} result
   * @param {{partial?: boolean}} [options] partial: 분석 중이라 ① 영상 + ② 영상 정보만
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
      const video = card(1, "분석 영상", "영상 아래 동작 구간을 누르면 그 시점으로 이동하고, 재생속도를 바꿔 느리게 볼 수 있어요.");
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
    }

    const r = result || { videoInfo: { status: "uploading", fileName: state.sourceName } };
    const info = card(2, "영상 정보");
    renderInfoCard(info.body, config, r);
    container.appendChild(info.section);

    if (full) {
      const view = cameraViewOf(r);
      const viewNote = `${CAMERA_VIEW_LABEL[view]} 촬영 기준으로 측정할 수 있는 항목만 표시합니다.`;
      const angles = card(3, "관절 및 자세", `관절 굽힘과 신체 기울기를 각도(°)로 표시합니다. ${viewNote}`);
      renderMetricGrid(angles.body, config, visibleDefs(config.angles, r.angles, view), r.angles);
      const movement = card(
        4,
        "움직임",
        "영상 속 신체 이동을 신장·신체 기준 비율(%)로 표시합니다. 실제 거리 보정 전이라 cm 로 표시하지 않아요."
      );
      renderMetricGrid(movement.body, config, visibleDefs(config.movement, r.movement, view), r.movement);
      const timing = card(5, "동작 타이밍", "각 동작이 시작된 시점과 동작 사이의 시간차를 초(s)로 표시합니다.");
      renderTimingCard(timing.body, config, r, view);
      const speed = card(6, "동작 속도", "회전·관절 움직임의 속도(°/s)를 표시할 자리입니다.");
      speed.section.classList.add("report-card--muted");
      renderSpeedCard(speed.body, config, r, view);
      const compare = card(7, config.titles.compare, "같은 사용자의 이전 영상과 같은 지표·같은 단위끼리 나란히 보여줍니다.");
      renderPreviousComparison(r, compare.body);
      container.append(angles.section, movement.section, timing.section, speed.section, compare.section);
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
    generateAnalysisSummary,
    renderPreviousComparison,
    showFromRecord,
    setSourceVideo,
    showSample,
  };
})();
