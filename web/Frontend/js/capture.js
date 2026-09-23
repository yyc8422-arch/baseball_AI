/**
 * BROS - 플로팅 버튼(FAB) / 동영상 업로드 / 바로 촬영
 *
 * 흐름: FAB 클릭 → "동영상 업로드" or "바로 촬영" 선택
 *      → 분석 종류(투구폼/타격폼/경기 하이라이트) 선택 모달
 *      → (업로드) 파일 선택  또는  (촬영) 카메라 모달에서 녹화
 *      → handleVideoUpload() / useRecordedVideo() 에서 payload 로 정리
 *
 * 아직 실제 AI 분석 API가 없으므로, 여기서는 fetch 로 가짜 서버에 요청하지 않고
 * console.info 로그 + TODO 주석으로 연동 지점만 표시합니다.
 * main.js 의 window.BROS.ui.showToast() 를 재사용해 안내 메시지를 띄웁니다.
 */
(function () {
  /** 업로드/촬영 공통으로 쓰는 분석 종류. 기존 NAV_ITEMS(data.js)의 key 규칙과 동일하게 맞춤 */
  const ANALYSIS_TYPES = [
    { id: "pitching", icon: "pitching", uploadLabel: "투구폼 분석", captureLabel: "투구폼 촬영" },
    { id: "batting", icon: "batting", uploadLabel: "타격폼 분석", captureLabel: "타격폼 촬영" },
    { id: "highlight", icon: "highlight", uploadLabel: "경기 하이라이트", captureLabel: "경기 영상 촬영" },
  ];
  const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
  const MAX_FILE_SIZE_MB = 500;

  let pendingSource = null; // "upload" | "record" — 타입 선택 모달을 어떤 흐름에서 열었는지
  let selectedAnalysisType = null; // "pitching" | "batting" | "highlight"
  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedBlob = null;

  function notify(message) {
    if (window.BROS.ui && window.BROS.ui.showToast) {
      window.BROS.ui.showToast(message);
    }
  }

  function analysisTypeLabel(type) {
    const found = ANALYSIS_TYPES.find((t) => t.id === type);
    return found ? found.uploadLabel : type;
  }

  let lastPreviewUrl = null; // 이전 미리보기 blob URL (교체 시 메모리 해제용)

  /**
   * 업로드/촬영한 영상을 "분석 결과"와는 별개인 미리보기 카드에 넣어서 바로 재생해볼 수 있게 함.
   * 이 페이지에 미리보기 영역(#uploadedVideoCard)이 없으면 false 를 반환합니다.
   * (예: 홈 화면처럼 분석 페이지가 아닌 곳에서 업로드한 경우)
   * @param {File} file
   * @returns {boolean} 미리보기를 보여줬는지 여부
   */
  function renderUploadedVideoPreview(file) {
    const card = document.getElementById("uploadedVideoCard");
    const slot = document.getElementById("uploadedVideoSlot");
    if (!card || !slot) return false;

    if (lastPreviewUrl) URL.revokeObjectURL(lastPreviewUrl);
    lastPreviewUrl = URL.createObjectURL(file);

    slot.innerHTML = "";
    const video = document.createElement("video");
    video.src = lastPreviewUrl;
    video.controls = true;
    video.playsInline = true;
    video.className = "video-preview__player";
    slot.appendChild(video);

    card.hidden = false;
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return true;
  }

  // ===================== FAB =====================
  function initFab() {
    const wrap = document.getElementById("fabWrap");
    const toggle = document.getElementById("fabToggle");
    const uploadItem = document.getElementById("fabUpload");
    const recordItem = document.getElementById("fabRecord");
    if (!wrap || !toggle) return;

    const ICONS = (window.BROS.render && window.BROS.render.ICONS) || {};

    function openFab() {
      wrap.classList.add("fab-wrap--open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.innerHTML = ICONS.close || "";
    }
    function closeFab() {
      wrap.classList.remove("fab-wrap--open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.innerHTML = ICONS.video || "";
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      wrap.classList.contains("fab-wrap--open") ? closeFab() : openFab();
    });

    // 메뉴 바깥 클릭 시 닫기
    document.addEventListener("click", (e) => {
      if (wrap.classList.contains("fab-wrap--open") && !wrap.contains(e.target)) {
        closeFab();
      }
    });

    // ESC 키로 닫기
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && wrap.classList.contains("fab-wrap--open")) closeFab();
    });

    if (uploadItem) {
      uploadItem.addEventListener("click", () => {
        closeFab();
        openTypeModal("upload");
      });
    }
    if (recordItem) {
      recordItem.addEventListener("click", () => {
        closeFab();
        openTypeModal("record");
      });
    }
  }

  // ===================== 분석 종류 선택 모달 =====================
  function renderTypeOptions(source) {
    const list = document.getElementById("typeModalOptions");
    if (!list) return;
    const ICONS = (window.BROS.render && window.BROS.render.ICONS) || {};
    list.innerHTML = "";
    ANALYSIS_TYPES.forEach((type) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "modal-option";
      btn.dataset.type = type.id;
      const label = source === "record" ? type.captureLabel : type.uploadLabel;
      btn.innerHTML = `<span class="modal-option__icon">${ICONS[type.icon] || ""}</span><span>${label}</span>`;
      list.appendChild(btn);
    });
  }

  function openTypeModal(source) {
    const overlay = document.getElementById("typeModalOverlay");
    const title = document.getElementById("typeModalTitle");
    if (!overlay) return;
    pendingSource = source;
    renderTypeOptions(source);
    if (title) title.textContent = source === "record" ? "촬영할 종류를 선택하세요" : "분석 종류를 선택하세요";
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("modal-overlay--visible"));
  }

  function closeTypeModal() {
    const overlay = document.getElementById("typeModalOverlay");
    if (!overlay) return;
    overlay.classList.remove("modal-overlay--visible");
    setTimeout(() => {
      overlay.hidden = true;
    }, 180);
  }

  function initTypeModal() {
    const overlay = document.getElementById("typeModalOverlay");
    if (!overlay) return;
    const closeBtn = document.getElementById("typeModalClose");
    const list = document.getElementById("typeModalOptions");

    if (closeBtn) closeBtn.addEventListener("click", closeTypeModal);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeTypeModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) closeTypeModal();
    });

    if (list) {
      list.addEventListener("click", (e) => {
        const btn = e.target.closest(".modal-option");
        if (!btn) return;
        selectedAnalysisType = btn.dataset.type;
        closeTypeModal();
        if (pendingSource === "upload") {
          const input = document.getElementById("videoFileInput");
          if (input) input.click();
        } else if (pendingSource === "record") {
          openCameraModal();
        }
      });
    }
  }

  // ===================== 동영상 업로드 =====================
  function initFileInput() {
    const input = document.getElementById("videoFileInput");
    if (!input) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.value = ""; // 같은 파일을 다시 선택할 수 있도록 초기화
      if (!file || !selectedAnalysisType) return;
      handleVideoUpload(file, selectedAnalysisType);
    });
  }

  function isAllowedVideo(file) {
    if (ALLOWED_VIDEO_TYPES.includes(file.type)) return true;
    // 일부 브라우저/OS 는 .mov 등의 MIME 타입을 비워서 넘기므로 확장자로 보정 확인
    return /\.(mp4|mov|webm)$/i.test(file.name);
  }

  /**
   * 업로드된 영상 파일을 검증하고, 이후 AI 분석 API 연동을 위한 형태로 정리합니다.
   * 실제 API가 준비되면 이 함수 안의 TODO 지점에서 fetch 요청만 추가하면 됩니다.
   * @param {File} file
   * @param {"pitching"|"batting"|"highlight"} analysisType
   */
  function handleVideoUpload(file, analysisType) {
    if (!isAllowedVideo(file)) {
      notify("mp4, mov, webm 형식의 영상 파일만 업로드할 수 있습니다.");
      return;
    }
    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      notify(`영상 파일은 최대 ${MAX_FILE_SIZE_MB}MB까지 업로드할 수 있습니다.`);
      return;
    }

    /** 백엔드에 바로 보낼 수 있는 최소 정보 */
    const payload = {
      file,
      fileName: file.name,
      fileSizeBytes: file.size,
      mimeType: file.type,
      analysisType,
    };

    const formData = new FormData();
    formData.append("video", file, file.name);
    formData.append("analysisType", analysisType);

    console.info("[BROS] 영상 업로드 준비 완료", payload);
    notify(`${analysisTypeLabel(analysisType)} 영상이 준비되었습니다. (AI 분석 연동 예정)`);

    // TODO: 백엔드 AI 분석 API 연동 지점
    // fetch("/api/analysis", { method: "POST", body: formData }).then(...);

    // 지금 있는 페이지에 미리보기 영역이 있으면 그 자리에서 바로 재생, 없으면 해당 분석 페이지로 이동
    if (!renderUploadedVideoPreview(file)) {
      goToAnalysisFlow(analysisType);
    }
  }

  // ===================== 바로 촬영 (카메라) =====================
  function getCameraElements() {
    return {
      overlay: document.getElementById("cameraModalOverlay"),
      preview: document.getElementById("cameraPreview"),
      playback: document.getElementById("cameraPlayback"),
      status: document.getElementById("cameraStatus"),
      idleControls: document.getElementById("cameraControlsIdle"),
      recordingControls: document.getElementById("cameraControlsRecording"),
      previewControls: document.getElementById("cameraControlsPreview"),
    };
  }

  function setCameraStage(stage) {
    const els = getCameraElements();
    const isIdle = stage === "idle";
    const isRecording = stage === "recording";
    const isPreview = stage === "preview";

    if (els.idleControls) els.idleControls.hidden = !isIdle;
    if (els.recordingControls) els.recordingControls.hidden = !isRecording;
    if (els.previewControls) els.previewControls.hidden = !isPreview;
    if (els.preview) els.preview.hidden = isPreview;
    if (els.playback) els.playback.hidden = !isPreview;
  }

  /** 마이크 포함 → 실패 시 영상만이라도 재시도 */
  async function requestCameraStream() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.name === "OverconstrainedError")) {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      }
      throw err;
    }
  }

  async function openCamera() {
    const els = getCameraElements();
    if (!els.overlay) return;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      notify("이 환경에서는 카메라를 사용할 수 없습니다. HTTPS 또는 localhost 환경에서 시도해주세요.");
      return;
    }

    els.overlay.hidden = false;
    requestAnimationFrame(() => els.overlay.classList.add("modal-overlay--visible"));
    setCameraStage("idle");
    if (els.status) els.status.textContent = "카메라를 준비하고 있어요...";

    try {
      mediaStream = await requestCameraStream();
      if (els.preview) els.preview.srcObject = mediaStream;
      if (els.status) els.status.textContent = "";
    } catch (err) {
      console.error("[BROS] 카메라 접근 실패", err);
      const message =
        err && err.name === "NotAllowedError"
          ? "카메라 권한이 필요합니다. 브라우저 설정에서 카메라 권한을 허용해주세요."
          : "카메라를 사용할 수 없습니다. 다른 앱에서 사용 중이거나 지원되지 않는 환경일 수 있습니다.";
      if (els.status) els.status.textContent = message;
      notify(message);
    }
  }

  // 모달을 여는 진입점 (분석 종류 선택 이후 호출)
  function openCameraModal() {
    openCamera();
  }

  function startRecording() {
    if (!mediaStream) return;
    recordedChunks = [];
    try {
      mediaRecorder = new MediaRecorder(mediaStream);
    } catch (err) {
      console.error("[BROS] MediaRecorder 생성 실패", err);
      notify("이 브라우저는 영상 녹화를 지원하지 않습니다.");
      return;
    }
    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = () => {
      recordedBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || "video/webm" });
      const els = getCameraElements();
      if (els.playback) els.playback.src = URL.createObjectURL(recordedBlob);
      setCameraStage("preview");
    };
    mediaRecorder.start();
    setCameraStage("recording");
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
  }

  function retakeRecording() {
    recordedBlob = null;
    recordedChunks = [];
    setCameraStage("idle");
  }

  /** 카메라 트랙을 반드시 정지시켜서 카메라가 계속 켜진 채로 남지 않도록 함 */
  function closeCamera() {
    const els = getCameraElements();
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }
    if (els.overlay) {
      els.overlay.classList.remove("modal-overlay--visible");
      setTimeout(() => {
        els.overlay.hidden = true;
      }, 180);
    }
    recordedChunks = [];
    recordedBlob = null;
  }

  function useRecordedVideo() {
    if (!recordedBlob || !selectedAnalysisType) return;
    const fileName = `bros-${selectedAnalysisType}-${Date.now()}.webm`;
    const file = new File([recordedBlob], fileName, { type: recordedBlob.type });

    const payload = {
      file,
      fileName,
      fileSizeBytes: file.size,
      mimeType: file.type,
      analysisType: selectedAnalysisType,
    };

    console.info("[BROS] 촬영 영상 준비 완료", payload);
    notify(`${analysisTypeLabel(selectedAnalysisType)} 촬영이 완료되었습니다. (AI 분석 연동 예정)`);

    // TODO: 백엔드 AI 분석 API 연동 지점 (handleVideoUpload 와 동일한 payload 형태)

    closeCamera();
    if (!renderUploadedVideoPreview(file)) {
      goToAnalysisFlow(selectedAnalysisType);
    }
  }

  function initCameraModal() {
    const overlay = document.getElementById("cameraModalOverlay");
    if (!overlay) return;
    const closeBtn = document.getElementById("cameraModalClose");
    const cancelBtn = document.getElementById("cameraCancelBtn");
    const startBtn = document.getElementById("cameraStartBtn");
    const stopBtn = document.getElementById("cameraStopBtn");
    const retakeBtn = document.getElementById("cameraRetakeBtn");
    const useBtn = document.getElementById("cameraUseBtn");

    if (closeBtn) closeBtn.addEventListener("click", closeCamera);
    if (cancelBtn) cancelBtn.addEventListener("click", closeCamera);
    if (startBtn) startBtn.addEventListener("click", startRecording);
    if (stopBtn) stopBtn.addEventListener("click", stopRecording);
    if (retakeBtn) retakeBtn.addEventListener("click", retakeRecording);
    if (useBtn) useBtn.addEventListener("click", useRecordedVideo);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeCamera();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) closeCamera();
    });
  }

  // ===================== 분석 종류별 이후 화면 연결 =====================
  /**
   * 업로드/촬영이 끝난 뒤 선택된 분석 종류에 맞는 페이지로 이동합니다.
   * @param {"pitching"|"batting"|"highlight"} analysisType
   */
  function goToAnalysisFlow(analysisType) {
    const pages = { pitching: "pitching.html", batting: "batting.html", highlight: "highlight.html" };
    const target = pages[analysisType];
    if (target) window.location.href = "./" + target;
  }

  /**
   * 분석 종류가 이미 정해진 페이지(예: pitching.html)의 "지금 분석하기" 버튼에서 쓰는 진입점.
   * 종류 선택 모달을 건너뛰고 바로 파일 선택창을 엽니다.
   * @param {"pitching"|"batting"|"highlight"} type
   */
  function startUploadFor(type) {
    selectedAnalysisType = type;
    const input = document.getElementById("videoFileInput");
    if (input) input.click();
  }

  /**
   * startUploadFor() 와 동일하되, 종류 선택 모달을 건너뛰고 바로 카메라 모달을 엽니다.
   * @param {"pitching"|"batting"|"highlight"} type
   */
  function startRecordFor(type) {
    selectedAnalysisType = type;
    openCameraModal();
  }

  function initCaptureFeature() {
    initFab();
    initTypeModal();
    initFileInput();
    initCameraModal();
  }

  window.BROS = window.BROS || {};
  window.BROS.capture = {
    initCaptureFeature,
    handleVideoUpload,
    openCamera,
    startRecording,
    stopRecording,
    closeCamera,
    useRecordedVideo,
    startUploadFor,
    startRecordFor,
  };
})();
