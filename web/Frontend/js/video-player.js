/**
 * BROS - 분석용 영상 플레이어 (투구/타격 리포트, 하이라이트 업로드 미리보기 공통)
 *
 * 브라우저 기본 컨트롤(재생/일시정지/탐색바/음량/전체화면)은 그대로 쓰고,
 * 분석용으로 느리게 보기 위한 "재생속도" 선택만 추가합니다.
 *  - PC: 버튼 [0.25x] [0.5x] ... [2x]
 *  - 폰: 같은 값을 고르는 드롭다운 (CSS 에서 화면 폭에 따라 둘 중 하나만 보임)
 *
 * createPoseOverlay(player) 로 영상 위에 AI 가 추출한 관절 좌표를 점으로 겹쳐 그릴 수 있습니다.
 *
 * 확장: 나중에 프레임 단위 이동을 넣을 때는 createAnalysisPlayer() 가 돌려주는 객체에
 *       stepFrames(n) 같은 함수를 추가하고, 컨트롤 줄(.player__controls)에 버튼만 붙이면 됩니다.
 *       (fps 는 리포트의 videoInfo.fps 로 알 수 있음)
 */
(function () {
  const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];
  const DEFAULT_RATE = 1;

  const formatRate = (rate) => `${rate}x`;

  /**
   * 영상의 재생속도를 바꿉니다. (HTMLVideoElement.playbackRate)
   * @param {HTMLVideoElement} video
   * @param {number} rate PLAYBACK_RATES 중 하나
   */
  function setPlaybackRate(video, rate) {
    if (!video || !PLAYBACK_RATES.includes(rate)) return;
    video.playbackRate = rate;
    // 일부 브라우저는 소스를 바꾸면 기본 속도로 돌아가므로, 다음 로드 때도 같은 값을 쓰도록 기본값도 맞춤
    video.defaultPlaybackRate = rate;
  }

  /**
   * 재생속도 선택 UI 가 달린 분석용 플레이어를 만듭니다.
   * @param {{src?: string, label?: string}} [options]
   * @returns {{element: HTMLElement, stage: HTMLElement, video: HTMLVideoElement, setSource: (src: string) => void, setRate: (rate: number) => void}}
   */
  function createAnalysisPlayer(options = {}) {
    const wrap = document.createElement("div");
    wrap.className = "player";

    // 영상과 그 위에 겹치는 것(관절 점 캔버스 등)을 담는 틀
    const stage = document.createElement("div");
    stage.className = "player__stage";

    const video = document.createElement("video");
    video.className = "player__video";
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";
    if (options.label) video.setAttribute("aria-label", options.label);

    const controls = document.createElement("div");
    controls.className = "player__controls";

    const title = document.createElement("span");
    title.className = "player__rate-title";
    title.textContent = "재생속도";

    // PC: 버튼 묶음
    const buttons = document.createElement("div");
    buttons.className = "player__rate-buttons";
    buttons.setAttribute("role", "group");
    buttons.setAttribute("aria-label", "재생속도");
    PLAYBACK_RATES.forEach((rate) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "player__rate-btn";
      btn.dataset.rate = String(rate);
      btn.textContent = formatRate(rate);
      buttons.appendChild(btn);
    });

    // 폰: 드롭다운
    const select = document.createElement("select");
    select.className = "player__rate-select";
    select.setAttribute("aria-label", "재생속도");
    PLAYBACK_RATES.forEach((rate) => {
      const opt = document.createElement("option");
      opt.value = String(rate);
      opt.textContent = formatRate(rate);
      select.appendChild(opt);
    });

    const current = document.createElement("span");
    current.className = "player__rate-current";
    current.setAttribute("aria-live", "polite");

    controls.append(title, buttons, select, current);
    stage.appendChild(video);
    wrap.append(stage, controls);

    /** 버튼/드롭다운/"현재 속도" 표시를 실제 video.playbackRate 에 맞춤 */
    function syncRateUi() {
      const rate = video.playbackRate;
      buttons.querySelectorAll(".player__rate-btn").forEach((btn) => {
        const active = Number(btn.dataset.rate) === rate;
        btn.classList.toggle("player__rate-btn--active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
      select.value = String(rate);
      current.textContent = `현재 속도 ${formatRate(rate)}`;
    }

    function setRate(rate) {
      setPlaybackRate(video, rate);
      syncRateUi();
    }

    buttons.addEventListener("click", (e) => {
      const btn = e.target.closest(".player__rate-btn");
      if (btn) setRate(Number(btn.dataset.rate));
    });
    select.addEventListener("change", () => setRate(Number(select.value)));
    // 브라우저 자체 메뉴 등 다른 경로로 속도가 바뀌어도 표시를 맞춤
    video.addEventListener("ratechange", syncRateUi);

    /** 영상을 바꿀 때는 항상 1.0x 로 다시 시작 */
    function setSource(src) {
      if (video.getAttribute("src") === src) return;
      video.src = src;
      setRate(DEFAULT_RATE);
    }

    if (options.src) setSource(options.src);
    else setRate(DEFAULT_RATE);

    return { element: wrap, stage, video, setSource, setRate };
  }

  // ===================== 관절 점 오버레이 =====================
  const MIN_KEYPOINT_CONFIDENCE = 0.3; // 이보다 신뢰도가 낮은 관절은 그리지 않음 (가려진 관절 등)
  const JOINT_COLORS = { right: "#cbff3d", left: "#4cc9f0", center: "#ffffff" };

  /** 관절 이름으로 좌/우/가운데 구분 (right_elbow → right) */
  function jointSide(name) {
    if (!name) return "center";
    if (name.startsWith("right_") || name.endsWith("_right")) return "right";
    if (name.startsWith("left_") || name.endsWith("_left")) return "left";
    return "center";
  }

  /**
   * 영상 위에 AI 가 추출한 프레임별 관절 좌표를 점으로 겹쳐 그립니다. 계산은 하지 않고 받은 좌표를 그대로 그림.
   * pose 형식 (AI-Server GET /api/analysis/{id}?includePose=true 의 pose):
   *   { width, height, fps, keypoint_names: string[24], frames: [{ time_sec, player: { keypoints: [[x, y, conf] x24] } | null }] }
   * @param {ReturnType<typeof createAnalysisPlayer>} player
   * @param {{onStatus?: (message: string) => void}} [options] 표시할 수 없을 때 이유를 알려줌
   */
  function createPoseOverlay(player, options = {}) {
    const { video, stage } = player;
    const canvas = document.createElement("canvas");
    canvas.className = "player__overlay";
    canvas.setAttribute("aria-hidden", "true");
    stage.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let pose = null;
    let visible = true;
    let maxGapSec = 0.2;

    const report = (message) => options.onStatus && options.onStatus(message);

    /** 재생 위치에서 가장 가까운 분석 프레임 (분석 간격보다 멀면 없음) */
    function frameAt(time) {
      const frames = pose.frames;
      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (frames[mid].time_sec < time) lo = mid + 1;
        else hi = mid;
      }
      let best = frames[lo];
      if (lo > 0 && Math.abs(frames[lo - 1].time_sec - time) < Math.abs(best.time_sec - time)) best = frames[lo - 1];
      return best && Math.abs(best.time_sec - time) <= maxGapSec ? best : null;
    }

    /** video 요소 안에서 실제 영상이 그려지는 영역 (위아래/좌우 검은 여백 제외) */
    function contentRect() {
      const w = video.clientWidth;
      const h = video.clientHeight;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const scale = Math.min(w / vw, h / vh);
      return { x: (w - vw * scale) / 2, y: (h - vh * scale) / 2, w: vw * scale, h: vh * scale };
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const w = video.clientWidth;
      const h = video.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (!visible || !pose || !pose.frames || !pose.frames.length) return;

      const rect = contentRect();
      if (!rect) return;
      const frame = frameAt(video.currentTime);
      if (!frame || !frame.player) return;

      const sx = rect.w / pose.width;
      const sy = rect.h / pose.height;
      const radius = Math.max(3, Math.min(rect.w, rect.h) / 110);
      const names = pose.keypoint_names || [];
      frame.player.keypoints.forEach(([x, y, conf], i) => {
        if (conf < MIN_KEYPOINT_CONFIDENCE) return;
        ctx.beginPath();
        ctx.arc(rect.x + x * sx, rect.y + y * sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = JOINT_COLORS[jointSide(names[i])];
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
        ctx.stroke();
      });
    }

    /** 영상과 좌표의 가로세로 비율이 다르면(휴대폰 회전 정보 차이 등) 점 위치가 틀어지므로 그리지 않음 */
    function checkAspect() {
      if (!pose || !video.videoWidth) return;
      const a = video.videoWidth / video.videoHeight;
      const b = pose.width / pose.height;
      if (Math.abs(a - b) / b > 0.05) {
        report("영상과 관절 좌표의 화면 비율이 달라 관절 점을 표시할 수 없어요.");
        pose = null;
      } else {
        report("");
      }
    }

    // 재생 중에는 영상 프레임이 바뀔 때마다, 멈췄을 때는 탐색/크기 변경 때마다 다시 그림
    if (typeof video.requestVideoFrameCallback === "function") {
      const onFrame = () => {
        draw();
        video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    } else {
      let rafId = null;
      const loop = () => {
        draw();
        rafId = video.paused ? null : requestAnimationFrame(loop);
      };
      video.addEventListener("play", () => {
        if (!rafId) loop();
      });
    }
    ["seeked", "loadeddata", "pause", "timeupdate"].forEach((evt) => video.addEventListener(evt, draw));
    video.addEventListener("loadedmetadata", () => {
      checkAspect();
      draw();
    });
    if ("ResizeObserver" in window) new ResizeObserver(draw).observe(video);

    return {
      /** @param {object|null} data AI-Server 의 pose (없으면 지움) */
      setPose(data) {
        pose = data && Array.isArray(data.frames) && data.width && data.height ? data : null;
        if (pose) {
          const stride = pose.frame_stride || 1;
          maxGapSec = Math.max(0.1, (stride / (pose.fps || 30)) * 1.5);
          checkAspect();
        }
        draw();
      },
      setVisible(value) {
        visible = value;
        draw();
      },
      hasPose: () => !!pose,
    };
  }

  window.BROS = window.BROS || {};
  window.BROS.player = { PLAYBACK_RATES, setPlaybackRate, createAnalysisPlayer, createPoseOverlay, JOINT_COLORS };
})();
