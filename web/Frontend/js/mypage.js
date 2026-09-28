/**
 * BROS - 마이페이지 (mypage.html)
 * - GET /api/auth/me 로 이름/권한 표시 (관리자면 "회원 승인 관리" 버튼 노출)
 * - GET /api/mypage/analysis-records 로 "분석 기록" / "업로드한 영상" 카드 채우기
 * 세션이 없거나(401) 승인이 취소된(403) 경우 로그인 페이지로 돌려보냅니다.
 */
(function () {
  const ANALYSIS_TYPE_LABEL = {
    pitching: "투구폼 분석",
    batting: "타격폼 분석",
    highlight: "경기 하이라이트",
  };

  const STATUS_LABEL = {
    uploading: "업로드 중",
    queued: "분석 대기",
    processing: "분석 중",
    done: "분석 완료",
    failed: "분석 실패",
  };

  // analysis.js 와 같은 키. 기록을 누르면 해당 분석 페이지가 이 영상을 이어서 보여줌
  const LAST_ANALYSIS_KEY_PREFIX = "bros-last-analysis-";

  function goToLogin() {
    window.BROS.shell.clearLocalAuth();
    window.location.href = "./login.html";
  }

  function renderProfile(user) {
    document.getElementById("profileName").textContent = `${user.name || user.username}님`;
    const isAdmin = user.role === "ADMIN";
    document.getElementById("profileMeta").textContent = isAdmin ? `${user.username} · 관리자` : `${user.username} · BROS 회원`;
    document.getElementById("adminLink").hidden = !isAdmin;
  }

  function renderMessage(container, text) {
    container.innerHTML = "";
    const p = document.createElement("p");
    p.className = "record-list__message";
    p.textContent = text;
    container.appendChild(p);
  }

  /** 기록 한 줄. 누르면 해당 분석 페이지로 이동해서 결과(진행 상황)를 이어서 보여줌 */
  function createRecordItem(record, { showStatus }) {
    const item = document.createElement("a");
    item.className = "record-item";
    item.href = `./${record.analysisType}.html`;
    item.addEventListener("click", () => {
      try {
        localStorage.setItem(
          LAST_ANALYSIS_KEY_PREFIX + record.analysisType,
          JSON.stringify({ videoId: record.videoId, fileName: record.fileName })
        );
      } catch (e) {}
    });

    const main = document.createElement("div");
    main.className = "record-item__main";

    const name = document.createElement("p");
    name.className = "record-item__name";
    name.textContent = record.fileName;

    const meta = document.createElement("p");
    meta.className = "record-item__meta";
    meta.textContent = `${ANALYSIS_TYPE_LABEL[record.analysisType] || record.analysisType} · ${record.createdAt}`;

    main.append(name, meta);
    item.appendChild(main);

    if (showStatus) {
      const badge = document.createElement("span");
      badge.className = `record-item__badge record-item__badge--${record.status}`;
      badge.textContent = STATUS_LABEL[record.status] || record.status;
      item.appendChild(badge);
    }
    return item;
  }

  function renderRecords(records) {
    const analysisList = document.getElementById("analysisRecordList");
    const videoList = document.getElementById("uploadedVideoList");
    // 기록이 없으면 HTML 에 들어 있는 빈 상태(empty-state)를 그대로 둠
    if (records.length === 0) return;

    analysisList.innerHTML = "";
    videoList.innerHTML = "";
    analysisList.classList.add("record-list");
    videoList.classList.add("record-list");

    records.forEach((record) => {
      analysisList.appendChild(createRecordItem(record, { showStatus: true }));
      videoList.appendChild(createRecordItem(record, { showStatus: false }));
    });
  }

  async function load() {
    const { request } = window.BROS.api;
    try {
      renderProfile(await request("/api/auth/me"));
    } catch (e) {
      if (e.status === 401 || e.status === 403) return goToLogin();
      window.BROS.ui.showToast(e.message);
      return;
    }

    try {
      renderRecords(await request("/api/mypage/analysis-records", { fallbackError: "기록을 불러오지 못했어요." }));
    } catch (e) {
      if (e.status === 401) return goToLogin();
      renderMessage(document.getElementById("analysisRecordList"), e.message);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    // 로그인하지 않았으면 로그인 페이지로 돌려보냄
    if (!window.BROS.shell.requireLogin()) return;

    window.BROS.shell.init("mypage");

    // 서버에서 받기 전까지는 저장해 둔 정보로 먼저 표시
    const cached = window.BROS.shell.getAuthUser();
    if (cached && cached.username) renderProfile(cached);

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await window.BROS.shell.logout();
      window.location.href = "./index.html";
    });

    load();
  });
})();
