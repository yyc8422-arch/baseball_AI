/**
 * BROS - 영상 분석 API 연동 (Spring 백엔드가 AI-Server 로 그대로 전달해줌)
 *
 * 흐름: capture.js 가 uploadVideo() 로 영상을 올림
 *      → 응답으로 받은 video_id 를 localStorage 에 기억
 *      → GET /api/analysis/{video_id} 를 주기적으로 조회해서 "최근 분석 결과" 카드(#analysisResultSlot)에 상태 표시
 *
 * video_id 를 localStorage 에 기억해 두기 때문에, 홈 화면에서 업로드한 뒤 분석 페이지로 이동하거나
 * 새로고침해도 이어서 진행 상황을 보여줄 수 있습니다.
 */
(function () {
  /** 백엔드 주소는 js/api.js 한 곳에서만 관리합니다. */
  const API_BASE_URL = window.BROS.api.API_BASE_URL;
  const POLL_INTERVAL_MS = 2000;
  const STORAGE_KEY_PREFIX = "bros-last-analysis-";

  const STATUS_TEXT = {
    uploading: { badge: "업로드 중", desc: "영상을 AI 서버로 보내고 있어요." },
    queued: { badge: "분석 대기", desc: "곧 분석을 시작해요." },
    processing: { badge: "분석 중", desc: "AI가 영상 속 선수의 관절 위치를 찾고 있어요. 영상 길이에 따라 시간이 걸릴 수 있어요." },
    done: { badge: "분석 완료", desc: "" },
    failed: { badge: "분석 실패", desc: "" },
    offline: { badge: "연결 실패", desc: "AI 서버에 연결할 수 없어요. 서버가 켜져 있는지 확인해주세요." },
  };

  let pollTimer = null;
  // 새 조회를 시작하거나 멈출 때마다 1씩 올림. 이전 조회의 늦게 도착한 응답이 화면을 덮어쓰지 않게 하기 위함
  let trackingToken = 0;

  // ===================== localStorage (접근이 막힌 환경에서도 오류 없이 동작) =====================
  function rememberAnalysis(analysisType, info) {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + analysisType, JSON.stringify(info));
    } catch (e) {}
  }

  function recallAnalysis(analysisType) {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + analysisType));
    } catch (e) {
      return null;
    }
  }

  function forgetAnalysis(analysisType) {
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + analysisType);
    } catch (e) {}
  }

  // ===================== API =====================
  const readErrorMessage = window.BROS.api.readErrorMessage;

  /**
   * 영상을 AI-Server 에 업로드합니다.
   * @param {File} file
   * @param {"pitching"|"batting"|"highlight"} analysisType
   * @param {"side"|"front"|"rear"} [cameraView] 촬영 방향 (지금은 측면 기본, 정면/후면 선택 UI 는 추후)
   * @returns {Promise<{video_id: string, file_name: string, analysis_type: string, status: string}>}
   */
  async function uploadVideo(file, analysisType, cameraView = "side") {
    const formData = new FormData();
    formData.append("video", file, file.name);
    formData.append("analysisType", analysisType);
    formData.append("cameraView", cameraView);

    let res;
    try {
      // 로그인한 상태면 세션 쿠키가 같이 가서, 백엔드가 이 영상을 내 마이페이지 기록으로 연결해줌
      res = await fetch(`${API_BASE_URL}/api/analysis`, { method: "POST", body: formData, credentials: "include" });
    } catch (e) {
      throw new Error(STATUS_TEXT.offline.desc);
    }
    if (!res.ok) throw new Error(await readErrorMessage(res, "영상 업로드에 실패했어요."));

    const result = await res.json();
    rememberAnalysis(analysisType, { videoId: result.video_id, fileName: result.file_name });
    return result;
  }

  /** @param {string} videoId */
  async function fetchAnalysis(videoId) {
    const res = await fetch(`${API_BASE_URL}/api/analysis/${encodeURIComponent(videoId)}`, { credentials: "include" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(await readErrorMessage(res, "분석 결과를 불러오지 못했어요."));
    return res.json();
  }

  // ===================== "최근 분석 결과" 카드 렌더링 =====================
  function describeResult(record) {
    if (record.status === "done" && record.summary) {
      const { detected_frames, analyzed_frames } = record.summary;
      const seconds = record.elapsed_sec != null ? ` · ${record.elapsed_sec}초 소요` : "";
      return `선수 검출 ${detected_frames} / ${analyzed_frames} 프레임${seconds}. 아래 리포트에서 영상 위 관절 점과 분석 정보를 확인할 수 있어요.`;
    }
    if (record.status === "failed") return record.error || "알 수 없는 오류로 분석하지 못했어요.";
    return STATUS_TEXT[record.status].desc;
  }

  /**
   * @param {{status: string, file_name?: string}} record 서버 응답 또는 화면용 임시 상태
   */
  function renderStatus(record) {
    const slot = document.getElementById("analysisResultSlot");
    if (!slot) return;

    const text = STATUS_TEXT[record.status] || STATUS_TEXT.offline;
    const box = document.createElement("div");
    box.className = `analysis-status analysis-status--${record.status}`;

    const badge = document.createElement("span");
    badge.className = "analysis-status__badge";
    badge.textContent = text.badge;

    const fileName = document.createElement("p");
    fileName.className = "analysis-status__file";
    fileName.textContent = record.file_name || "";

    const desc = document.createElement("p");
    desc.className = "analysis-status__desc";
    desc.textContent = describeResult(record);

    box.append(badge, fileName, desc);
    slot.innerHTML = "";
    slot.appendChild(box);
  }

  // ===================== 상태 조회 (폴링) =====================
  function stopTracking() {
    trackingToken += 1;
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  /**
   * 분석이 끝날 때까지(done/failed) 주기적으로 상태를 조회해서 카드에 반영합니다.
   * @param {"pitching"|"batting"|"highlight"} analysisType
   * @param {string} videoId
   * @param {string} [fileName] 서버 응답 전에 먼저 보여줄 파일명
   */
  function trackAnalysis(analysisType, videoId, fileName) {
    stopTracking();
    const token = trackingToken;

    async function poll() {
      let record;
      try {
        record = await fetchAnalysis(videoId);
      } catch (e) {
        if (token !== trackingToken) return;
        renderStatus({ status: "offline", file_name: fileName });
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS * 3); // 서버가 다시 켜지면 이어서 표시
        return;
      }
      if (token !== trackingToken) return;

      if (!record) {
        // 서버에서 결과 파일이 지워진 경우: 기억해 둔 id 를 버리고 빈 상태로 둠
        forgetAnalysis(analysisType);
        return;
      }

      renderStatus(record);
      // 투구/타격 페이지면 아래 분석 리포트도 갱신 (js/report.js)
      if (window.BROS.report && document.body.dataset.page === analysisType) {
        window.BROS.report.showFromRecord(analysisType, record);
      }
      if (record.status === "done" || record.status === "failed") return;
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
  }

  /** 분석 페이지를 열면, 이전에 올린 영상의 분석 상태를 이어서 보여줌 */
  function resumeLastAnalysis() {
    const slot = document.getElementById("analysisResultSlot");
    const analysisType = document.body.dataset.page;
    if (!slot || !analysisType) return;

    if (window.BROS.shell && !window.BROS.shell.isLoggedIn()) return; // 회원 전용 (페이지가 로그인 창으로 보냄)
    const last = recallAnalysis(analysisType);
    if (last && last.videoId) trackAnalysis(analysisType, last.videoId, last.fileName);
  }

  document.addEventListener("DOMContentLoaded", resumeLastAnalysis);

  window.BROS = window.BROS || {};
  window.BROS.analysis = {
    API_BASE_URL,
    uploadVideo,
    fetchAnalysis,
    trackAnalysis,
    renderStatus,
    stopTracking,
  };
})();
