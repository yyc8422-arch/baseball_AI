/**
 * BROS - 투구/타격 AI 분석 리포트 (pitching.html, batting.html 공통)
 *
 * 이 리포트는 자세를 평가(좋음/나쁨, 권장 범위, 개선 포인트)하지 않고,
 * 영상에서 추출한 신체 좌표·움직임을 "측정 → 기록 → 이전 영상과 비교" 하는 화면입니다.
 * 프론트는 값을 계산하지 않고 AI(Python/FastAPI)가 보내준 JSON 을 그대로 그리기만 합니다.
 * (예외: 이전 분석 비교의 "변화" 칸은 표시용으로 현재 - 이전 을 뺄셈만 함. API 가 change 를 주면 그 값을 그대로 씀)
 *
 * 화면 순서: ① 분석 영상 (+ 영상 아래 동작 단계 구간 바, 누르면 그 시점으로 이동) ② 자세 및 관절 수치
 *           ③ 동작 연결 분석 ④ 움직임 수치 ⑤ 이전 분석 비교 ⑥ 분석 안내
 *
 * 연결 함수 (향후 FastAPI 결과 → 화면):
 *   renderPitchAnalysis(result) / renderBattingAnalysis(result)   result 형식은 js/types.js 의 AnalysisReport
 *   showFromRecord(type, record)  GET /api/analysis/{id} 응답(record)을 AnalysisReport 로 바꿔서 그림 (js/analysis.js 가 호출)
 *   setSourceVideo(url, fileName) 방금 업로드한 영상을 ① 에 연결 (js/capture.js 가 호출)
 */
(function () {
  // ===================== 표시 단위 =====================
  // 실제 거리 보정이 없으므로 cm 같은 실제 거리 단위는 쓰지 않음
  const UNITS = {
    deg: { suffix: "°", digits: 1 },
    sec: { suffix: "s", digits: 2 },
    ratio: { suffix: "", digits: 2, note: "신장 대비 비율" },
    norm: { suffix: "", digits: 2, note: "정규화 좌표 기준" },
  };

  // ===================== 투구/타격 설정 (서로 다른 건 이 값들뿐, 화면 코드는 공통) =====================
  const REPORT_CONFIG = {
    pitching: {
      noun: "투구",
      titles: {
        phases: "투구 동작 단계",
        angles: "자세 및 관절 수치",
        sequence: "투구 동작 연결 분석",
        movement: "움직임 수치",
        compare: "이전 투구 분석 비교",
      },
      // key 는 API 의 phases[].key 와 같은 영어 값(그대로 유지), 화면에는 한글 label 로 표시
      phases: [
        { key: "SET", label: "준비 자세" },
        { key: "LEG_LIFT", label: "다리 들기" },
        { key: "STRIDE", label: "앞발 내딛기" },
        { key: "ARM_COCKING", label: "팔 젖히기" },
        { key: "ACCELERATION", label: "팔 가속" },
        { key: "RELEASE", label: "공 놓기" },
        { key: "FOLLOW_THROUGH", label: "마무리 동작" },
      ],
      angles: [
        { key: "elbowAngleAtRelease", label: "공 놓을 때 팔꿈치 각도", unit: "deg" },
        { key: "shoulderAngleAtRelease", label: "공 놓을 때 어깨 각도", unit: "deg" },
        { key: "frontKneeAngle", label: "앞무릎 각도", unit: "deg" },
        { key: "backKneeAngle", label: "뒷무릎 각도", unit: "deg" },
        { key: "trunkTilt", label: "상체 기울기", unit: "deg" },
        { key: "pelvisRotation", label: "골반 회전량", unit: "deg" },
        { key: "shoulderRotation", label: "어깨 회전량", unit: "deg" },
        { key: "strideLength", label: "보폭 (스트라이드)", unit: "ratio" },
      ],
      movement: [
        { key: "headDisplacement", label: "머리 이동량", unit: "norm" },
        { key: "pelvisDisplacement", label: "골반 이동량", unit: "norm" },
        { key: "trunkTiltChange", label: "상체 기울기 변화량", unit: "deg" },
      ],
      // 흐름: 하체 이동 → 골반 회전 → 어깨 회전 → 팔 가속 → 공 놓기 (각 단계 아래 시작 시점)
      sequenceFlow: [
        { label: "하체 이동", key: "lowerBodyMoveStartSec" },
        { label: "골반 회전", key: "pelvisRotationStartSec" },
        { label: "어깨 회전", key: "shoulderRotationStartSec" },
        { label: "팔 가속", key: "armAccelerationStartSec" },
        { label: "공 놓기", key: "releaseSec" },
      ],
      sequenceItems: [
        { key: "pelvisRotationStartSec", label: "골반 회전 시작 시점", unit: "sec" },
        { key: "shoulderRotationStartSec", label: "어깨 회전 시작 시점", unit: "sec" },
        { key: "armAccelerationStartSec", label: "팔 가속 시작 시점", unit: "sec" },
        { key: "releaseSec", label: "공 놓는 시점", unit: "sec" },
        { key: "pelvisToShoulderGapSec", label: "골반 → 어깨 회전 시간차", unit: "sec" },
        { key: "totalMotionSec", label: "전체 투구 동작 시간", unit: "sec" },
      ],
      compare: [
        { group: "angles", key: "elbowAngleAtRelease", label: "팔꿈치 각도" },
        { group: "angles", key: "shoulderAngleAtRelease", label: "어깨 각도" },
        { group: "angles", key: "trunkTilt" },
        { group: "angles", key: "pelvisRotation" },
        { group: "angles", key: "shoulderRotation" },
        { group: "angles", key: "strideLength" },
        { group: "movement", key: "headDisplacement" },
        { group: "sequence", key: "totalMotionSec", label: "투구 동작 시간" },
      ],
      notice:
        "본 리포트는 영상에서 추출한 신체 좌표와 동작 데이터를 수치화한 결과입니다. 특정 수치만으로 투구폼의 우수성이나 부상 위험을 판단하지 않습니다.",
    },
    batting: {
      noun: "타격",
      titles: {
        phases: "타격 동작 단계",
        angles: "자세 및 관절 수치",
        sequence: "타격 동작 연결 분석",
        movement: "움직임 수치",
        compare: "이전 타격 분석 비교",
      },
      // CONTACT 는 공/배트 인식 모델이 생기면 API 가 phases 에 넣어 보내면 자동으로 표시됨 (EXTRA_PHASE_LABELS)
      phases: [
        { key: "STANCE", label: "준비 자세" },
        { key: "LOAD", label: "뒤로 당기기" },
        { key: "STRIDE", label: "앞발 내딛기" },
        { key: "ROTATION", label: "몸통 회전" },
        { key: "SWING", label: "배트 휘두르기" },
        { key: "FOLLOW_THROUGH", label: "마무리 동작" },
      ],
      angles: [
        { key: "pelvisRotation", label: "골반 회전량", unit: "deg" },
        { key: "shoulderRotation", label: "어깨 회전량", unit: "deg" },
        { key: "trunkTilt", label: "상체 기울기", unit: "deg" },
        { key: "frontKneeAngle", label: "앞무릎 각도", unit: "deg" },
        { key: "backKneeAngle", label: "뒷무릎 각도", unit: "deg" },
        { key: "strideLength", label: "보폭 (스트라이드)", unit: "ratio" },
      ],
      movement: [
        { key: "headDisplacement", label: "머리 이동량", unit: "norm" },
        { key: "pelvisDisplacement", label: "골반 이동량", unit: "norm" },
        { key: "trunkTiltChange", label: "상체 기울기 변화량", unit: "deg" },
      ],
      // 흐름: 뒤로 당기기 → 앞발 내딛기 → 골반 회전 → 어깨 회전 → 배트 휘두르기 → 마무리 동작
      sequenceFlow: [
        { label: "뒤로 당기기", key: "loadStartSec" },
        { label: "앞발 내딛기", key: "strideStartSec" },
        { label: "골반 회전", key: "pelvisRotationStartSec" },
        { label: "어깨 회전", key: "shoulderRotationStartSec" },
        { label: "배트 휘두르기", key: "swingStartSec" },
        { label: "마무리 동작", key: "followThroughStartSec" },
      ],
      sequenceItems: [
        { key: "loadStartSec", label: "뒤로 당기기 시작 시점", unit: "sec" },
        { key: "strideStartSec", label: "앞발 내딛기 시작 시점", unit: "sec" },
        { key: "frontFootLandingSec", label: "앞발 착지 시점", unit: "sec" },
        { key: "pelvisRotationStartSec", label: "골반 회전 시작 시점", unit: "sec" },
        { key: "shoulderRotationStartSec", label: "어깨 회전 시작 시점", unit: "sec" },
        { key: "swingStartSec", label: "배트 휘두르기 시작 시점", unit: "sec" },
        { key: "pelvisToShoulderGapSec", label: "골반 → 어깨 회전 시간차", unit: "sec" },
        { key: "totalSwingSec", label: "전체 스윙 동작 시간", unit: "sec" },
      ],
      compare: [
        { group: "angles", key: "pelvisRotation" },
        { group: "angles", key: "shoulderRotation" },
        { group: "angles", key: "trunkTilt" },
        { group: "angles", key: "strideLength" },
        { group: "movement", key: "headDisplacement" },
        { group: "movement", key: "pelvisDisplacement" },
        { group: "sequence", key: "totalSwingSec", label: "스윙 동작 시간" },
      ],
      notice:
        "본 리포트는 영상에서 추출한 신체 좌표와 동작 데이터를 수치화한 결과입니다. 특정 수치만으로 타격폼의 우수성이나 경기 수행 능력을 판단하지 않습니다.",
    },
  };

  /** 설정에 없는 단계가 API 에서 오면(예: 추후 CONTACT) 이 이름으로 표시, 없으면 key 그대로 */
  const EXTRA_PHASE_LABELS = { CONTACT: "공 맞히기" };



  // ===================== 예시 데이터 (화면 확인용, 실제 분석 결과 아님) =====================
  // 실제 AI 모델이 완성되기 전 화면 구성을 미리 볼 수 있도록 "예시 리포트 보기" 에서만 사용.
  const SAMPLE_RESULTS = {
    pitching: {
      analysisType: "pitching",
      videoInfo: { status: "done", cameraView: "side", fps: 60, durationSec: 3.2, analyzedFrames: 192, metricCount: 18, analyzedAt: "2026.09.28" },
      phases: [
        { key: "SET", startSec: 0.0, endSec: 0.62 },
        { key: "LEG_LIFT", startSec: 0.62, endSec: 1.18 },
        { key: "STRIDE", startSec: 1.18, endSec: 1.64 },
        { key: "ARM_COCKING", startSec: 1.64, endSec: 1.9 },
        { key: "ACCELERATION", startSec: 1.9, endSec: 2.02 },
        { key: "RELEASE", startSec: 2.02, endSec: 2.08 },
        { key: "FOLLOW_THROUGH", startSec: 2.08, endSec: 2.7 },
      ],
      angles: {
        elbowAngleAtRelease: { value: 94.8, at: "RELEASE" },
        shoulderAngleAtRelease: { value: 101.3, at: "RELEASE" },
        frontKneeAngle: { value: 138.5, at: "RELEASE" },
        backKneeAngle: { value: 152.1, at: "STRIDE" },
        trunkTilt: { value: 16.1, at: "RELEASE" },
        pelvisRotation: 41.2,
        shoulderRotation: 57.6,
        strideLength: 0.84,
      },
      movement: { headDisplacement: 0.12, pelvisDisplacement: 0.31, trunkTiltChange: 22.4 },
      sequence: {
        lowerBodyMoveStartSec: 1.18,
        pelvisRotationStartSec: 1.52,
        shoulderRotationStartSec: 1.66,
        armAccelerationStartSec: 1.9,
        releaseSec: 2.04,
        pelvisToShoulderGapSec: 0.14,
        totalMotionSec: 1.38,
      },
      previousAnalysis: {
        analyzedAt: "2026.09.20",
        angles: { elbowAngleAtRelease: 97.2, shoulderAngleAtRelease: 99.8, trunkTilt: 14.3, pelvisRotation: 38.7, shoulderRotation: 55.1, strideLength: 0.81 },
        movement: { headDisplacement: 0.15 },
        sequence: { totalMotionSec: 1.42 },
      },
    },
    batting: {
      analysisType: "batting",
      videoInfo: { status: "done", cameraView: "side", fps: 60, durationSec: 2.4, analyzedFrames: 144, metricCount: 17, analyzedAt: "2026.09.28" },
      phases: [
        { key: "STANCE", startSec: 0.0, endSec: 0.48 },
        { key: "LOAD", startSec: 0.48, endSec: 0.86 },
        { key: "STRIDE", startSec: 0.86, endSec: 1.12 },
        { key: "ROTATION", startSec: 1.12, endSec: 1.3 },
        { key: "SWING", startSec: 1.3, endSec: 1.56 },
        { key: "FOLLOW_THROUGH", startSec: 1.56, endSec: 2.1 },
      ],
      angles: {
        pelvisRotation: 47.1,
        shoulderRotation: 61.3,
        trunkTilt: { value: 21.6, at: "SWING" },
        frontKneeAngle: { value: 148.2, at: "SWING" },
        backKneeAngle: { value: 126.9, at: "LOAD" },
        strideLength: 0.46,
      },
      movement: { headDisplacement: 0.14, pelvisDisplacement: 0.22, trunkTiltChange: 9.8 },
      sequence: {
        loadStartSec: 0.48,
        strideStartSec: 0.86,
        frontFootLandingSec: 1.1,
        pelvisRotationStartSec: 1.12,
        shoulderRotationStartSec: 1.2,
        swingStartSec: 1.3,
        followThroughStartSec: 1.56,
        pelvisToShoulderGapSec: 0.08,
        totalSwingSec: 0.7,
      },
      previousAnalysis: {
        analyzedAt: "2026.09.20",
        angles: { pelvisRotation: 43.2, shoulderRotation: 58.4, trunkTilt: 20.1, strideLength: 0.44 },
        movement: { headDisplacement: 0.18, pelvisDisplacement: 0.25 },
        sequence: { totalSwingSec: 0.74 },
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

  /** 지표 값: 숫자 또는 { value, at } (at = 측정 시점 단계 이름) */
  function metricOf(group, key) {
    const raw = group ? group[key] : undefined;
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "number") return { value: raw, at: null };
    if (typeof raw === "object" && typeof raw.value === "number") return { value: raw.value, at: raw.at || null };
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
    return found ? found.label : EXTRA_PHASE_LABELS[key] || key;
  }

  /** 모든 지표 정의(각도/움직임/연결)를 key 로 찾기 */
  function findDef(config, group, key) {
    const list = group === "angles" ? config.angles : group === "movement" ? config.movement : config.sequenceItems;
    return list.find((d) => d.key === key) || { key, label: key, unit: group === "sequence" ? "sec" : "deg" };
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
   * 동작 단계 구간 바 (영상 바로 아래, 플레이어의 일부).
   * 구간 위치/길이는 "영상 전체 길이" 기준이라 브라우저 기본 탐색바와 같은 축이고, 구간을 누르면 그 시작 시점으로 이동.
   * 구간 시작/종료 시점(startSec/endSec)이 없으면 아무것도 그리지 않음.
   * @param {HTMLElement} target 구간 바를 넣을 곳
   * @param {HTMLElement|null} before 이 요소 앞에 넣음 (플레이어의 재생속도 줄 앞)
   */
  function renderPhaseChapters(target, before, config, result) {
    const phases = orderedPhases(config, result.phases).filter(
      (p) => typeof p.startSec === "number" && typeof p.endSec === "number"
    );
    if (!phases.length) return;

    const video = state.player && !state.isSample ? state.player.video : null;
    const lastEnd = phases[phases.length - 1].endSec;
    /** 영상 길이: 실제 영상 → API 의 영상 길이 → 마지막 구간 끝 */
    const duration = () =>
      (video && Number.isFinite(video.duration) && video.duration) ||
      (result.videoInfo && result.videoInfo.durationSec) ||
      lastEnd;

    const wrap = el("div", "phase-chapters");
    const head = el("div", "phase-chapters__head");
    head.append(el("span", "phase-chapters__title", config.titles.phases));
    const now = el("span", "phase-chapters__now", "");
    head.appendChild(now);
    const track = el("div", "phase-chapters__track");
    const playhead = el("span", "phase-chapters__playhead");
    playhead.hidden = true;

    const segs = phases.map((p) => {
      const seg = el("button", "phase-chapter");
      seg.type = "button";
      seg.title = `${p.label} ${p.startSec.toFixed(2)}–${p.endSec.toFixed(2)}s`;
      seg.setAttribute("aria-label", `${p.label} 구간으로 이동 (${p.startSec.toFixed(2)}초)`);
      seg.append(el("span", "phase-chapter__label", p.label));
      if (video) {
        seg.addEventListener("click", () => {
          video.currentTime = p.startSec;
          video.pause();
        });
      } else {
        seg.disabled = true;
      }
      track.appendChild(seg);
      return { seg, phase: p };
    });
    track.appendChild(playhead);

    // 아주 짧은 구간은 막대 안에서 이름이 잘리므로, 아래에 단계 이름 + 시작 시간을 칩으로 한 번 더 나열 (눌러도 이동)
    const list = el("div", "phase-chapters__list");
    const chips = phases.map((p) => {
      const chip = el("button", "phase-chip");
      chip.type = "button";
      chip.append(el("span", "phase-chip__label", p.label), el("span", "phase-chip__time", `${p.startSec.toFixed(2)}s`));
      if (video) {
        chip.addEventListener("click", () => {
          video.currentTime = p.startSec;
          video.pause();
        });
      } else {
        chip.disabled = true;
      }
      list.appendChild(chip);
      return chip;
    });

    wrap.append(head, track, list);
    target.insertBefore(wrap, before);

    function layout() {
      const d = duration();
      segs.forEach(({ seg, phase }) => {
        seg.style.left = `${(phase.startSec / d) * 100}%`;
        seg.style.width = `${((phase.endSec - phase.startSec) / d) * 100}%`;
      });
    }

    /** 재생 위치 표시선 + 지금 구간 강조 + "현재 구간" 이름 */
    function sync() {
      if (!video) {
        now.textContent = `${phases[0].label} → ${phases[phases.length - 1].label}`;
        return;
      }
      const t = video.currentTime;
      const d = duration();
      playhead.hidden = false;
      playhead.style.left = `${Math.min(t / d, 1) * 100}%`;
      let current = null;
      segs.forEach(({ seg, phase }, i) => {
        const active = t >= phase.startSec && t < phase.endSec;
        seg.classList.toggle("phase-chapter--active", active);
        chips[i].classList.toggle("phase-chip--active", active);
        if (active) current = phase;
      });
      now.textContent = current ? `현재 구간 · ${current.label}` : "구간을 누르면 그 시점으로 이동해요";
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

  // ===================== ② 자세 및 관절 수치 / ④ 움직임 수치 =====================
  function renderMetricGrid(body, config, defs, values) {
    const grid = el("div", "metric-grid");
    let filled = 0;
    defs.forEach((def) => {
      const metric = metricOf(values, def.key);
      if (metric) filled += 1;
      const item = el("div", "metric-card");
      item.append(el("span", "metric-card__label", def.label));
      item.append(el("span", "metric-card__value", metric ? formatNumber(metric.value, def.unit) : "—"));
      const notes = [metric && metric.at ? `${phaseLabel(config, metric.at)} 시점` : null, UNITS[def.unit].note].filter(Boolean);
      if (notes.length) item.append(el("span", "metric-card__note", notes.join(" · ")));
      grid.appendChild(item);
    });
    body.appendChild(grid);
    if (!filled) body.appendChild(pendingNote());
  }

  // ===================== ③ 동작 연결 분석 =====================
  function renderSequenceCard(body, config, result) {
    const seq = result.sequence || {};
    const flow = el("ol", "sequence-flow");
    config.sequenceFlow.forEach((step, i) => {
      const metric = metricOf(seq, step.key);
      const item = el("li", "sequence-flow__step");
      item.append(el("span", "sequence-flow__label", step.label), el("span", "sequence-flow__time", metric ? formatNumber(metric.value, "sec") : "—"));
      flow.appendChild(item);
      if (i < config.sequenceFlow.length - 1) flow.appendChild(el("li", "sequence-flow__arrow", "→"));
    });
    body.appendChild(el("div", "sequence-flow-wrap")).appendChild(flow);

    const list = el("dl", "sequence-list");
    let filled = 0;
    config.sequenceItems.forEach((def) => {
      const metric = metricOf(seq, def.key);
      if (metric) filled += 1;
      const row = el("div", "sequence-list__row");
      row.append(el("dt", null, def.label), el("dd", null, metric ? formatNumber(metric.value, def.unit) : "—"));
      list.appendChild(row);
    });
    body.appendChild(list);
    if (!filled) body.appendChild(pendingNote("동작 시점 데이터는 AI 동작 연결 분석이 연결되면 표시됩니다."));
    else body.appendChild(el("p", "report-card__meta", "시점은 영상 시작 기준 초(s)입니다."));
  }

  // ===================== ⑤ 이전 분석 비교 =====================
  function renderCompareCard(body, config, result) {
    const prev = result.previousAnalysis;
    if (!prev) {
      body.appendChild(pendingNote(`비교할 이전 ${config.noun} 분석이 없어요. 같은 종류의 영상을 다시 분석하면 이전 결과와 나란히 볼 수 있어요.`));
      return;
    }
    const info = result.videoInfo || {};
    body.appendChild(
      el("p", "report-card__meta", `이전 ${prev.analyzedAt || "-"}${prev.fileName ? ` (${prev.fileName})` : ""} · 현재 ${info.analyzedAt || "-"}`)
    );

    const wrap = el("div", "compare-table-wrap");
    const table = el("table", "compare-table");
    const thead = el("thead");
    const headRow = el("tr");
    ["지표", "이전", "현재", "변화"].forEach((h) => headRow.appendChild(el("th", null, h)));
    thead.appendChild(headRow);
    const tbody = el("tbody");
    config.compare.forEach((row) => {
      const def = findDef(config, row.group, row.key);
      const before = metricOf(prev[row.group], row.key);
      const now = metricOf(result[row.group], row.key);
      // API 가 changes[key] 를 주면 그대로, 없으면 표시용 뺄셈
      const apiChange = prev.changes && typeof prev.changes[row.key] === "number" ? prev.changes[row.key] : null;
      const change = apiChange != null ? apiChange : before && now ? now.value - before.value : null;
      const tr = el("tr");
      tr.append(
        el("th", null, row.label || def.label),
        el("td", null, before ? formatNumber(before.value, def.unit) : "—"),
        el("td", null, now ? formatNumber(now.value, def.unit) : "—"),
        el("td", "compare-table__change", change != null ? formatChange(change, def.unit) : "—")
      );
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
    body.appendChild(el("p", "report-card__meta", "변화는 현재 값에서 이전 값을 뺀 수치입니다."));
  }

  // ===================== ⑥ 분석 안내 =====================
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
   * @param {{partial?: boolean}} [options] partial: 분석 중이라 ① 영상만
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

    // 동작 단계 구간 바는 ① 영상 바로 아래 (플레이어 안, 재생속도 줄 위)에 다시 그림
    state.videoSection.querySelectorAll(".phase-chapters").forEach((node) => node.remove());
    if (result && !options.partial) {
      const inPlayer = state.player && !state.isSample && state.videoSection.contains(state.player.element);
      if (inPlayer) {
        renderPhaseChapters(state.player.element, state.player.element.querySelector(".player__controls"), config, result);
      } else {
        renderPhaseChapters(state.videoSection.querySelector(".report-card__body"), null, config, result);
      }
    }

    if (result && !options.partial) {
      const r = result;
      let step = 2;
      const angles = card(step++, config.titles.angles, "영상의 신체 좌표에서 측정한 값입니다.");
      renderMetricGrid(angles.body, config, config.angles, r.angles);
      const sequence = card(step++, config.titles.sequence, "신체 부위가 움직이기 시작한 시점의 순서입니다.");
      renderSequenceCard(sequence.body, config, r);
      const movement = card(step++, config.titles.movement, "실제 거리 보정 전이므로 정규화 좌표·신체 비율 기준의 상대 값입니다.");
      renderMetricGrid(movement.body, config, config.movement, r.movement);
      const compare = card(step++, config.titles.compare, "같은 사용자의 이전 영상 수치와 현재 수치를 나란히 보여줍니다.");
      renderCompareCard(compare.body, config, r);
      container.append(angles.section, sequence.section, movement.section, compare.section);
    }
    container.appendChild(renderNotice(config));
  }

  const renderPitchAnalysis = (result) => renderAnalysisReport("pitching", result);
  const renderBattingAnalysis = (result) => renderAnalysisReport("batting", result);

  // ===================== API 응답 → 리포트 =====================
  /**
   * GET /api/analysis/{id} 응답을 AnalysisReport 로 바꿈.
   * 지금 AI-Server 는 summary(fps/프레임 수)와 pose(관절 좌표)만 주므로 영상 정보만 채워지고,
   * 나중에 FastAPI 가 record.report = { videoInfo, phases, angles, movement, sequence, previousAnalysis } 를 주면 그대로 표시됨.
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
      sequence: report.sequence || {},
      previousAnalysis: report.previousAnalysis || null,
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
    showFromRecord,
    setSourceVideo,
    showSample,
  };
})();
