/**
 * BROS - 경기 하이라이트 페이지 (highlight.html) 전용 스크립트
 *
 * 구조:
 *  - GAME_INFO / MOCK_HIGHLIGHTS : 아직 AI 백엔드가 없어서 쓰는 샘플 데이터.
 *    실제 연동 시에는 이 두 값 대신 서버 응답(GameInfo, HighlightClip[])을 그대로 넣어주면 됩니다.
 *  - filterHighlightsByPosition(highlights, position) : 포지션 기준 필터링만 담당
 *  - renderAllHighlights(highlights) / renderPositionHighlights(highlights, position) : 화면 렌더링만 담당
 *  - 탭 전환은 페이지 이동 없이 클래스/hidden 토글로만 처리합니다.
 */
(function () {
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  };

  // ===================== 샘플 데이터 (백엔드 연동 전) =====================
  /** @type {GameInfo} */
  const GAME_INFO = {
    date: "2026.09.20",
    opponent: "한빛 타이거즈",
    score: "BROS 7 : 3",
  };

  /** @type {HighlightClip[]} */
  const MOCK_HIGHLIGHTS = [
    { id: "h1", position: null, category: "batting", action: "double", actionLabel: "2회 결승 2루타", timestamp: "00:13:21", clipUrl: "", thumbnailUrl: "" },
    { id: "h2", position: null, category: "batting", action: "home_run", actionLabel: "5회 솔로 홈런", timestamp: "00:34:02", clipUrl: "", thumbnailUrl: "" },
    { id: "h3", position: "SS", category: "defense", action: "ground_ball", actionLabel: "2회 땅볼 처리", timestamp: "00:13:21", clipUrl: "", thumbnailUrl: "" },
    { id: "h4", position: "SS", category: "defense", action: "throw", actionLabel: "4회 송구", timestamp: "00:24:10", clipUrl: "", thumbnailUrl: "" },
    { id: "h5", position: "SS", category: "defense", action: "fly_out", actionLabel: "6회 뜬공 처리", timestamp: "00:41:55", clipUrl: "", thumbnailUrl: "" },
    { id: "h6", position: "3B", category: "defense", action: "diving_catch", actionLabel: "3회 다이빙 캐치", timestamp: "00:18:40", clipUrl: "", thumbnailUrl: "" },
    { id: "h7", position: "CF", category: "defense", action: "fly_out", actionLabel: "7회 낙구 처리", timestamp: "00:49:12", clipUrl: "", thumbnailUrl: "" },
    { id: "h8", position: "1B", category: "defense", action: "ground_ball", actionLabel: "8회 포구", timestamp: "00:55:30", clipUrl: "", thumbnailUrl: "" },
    { id: "h9", position: null, category: "highlight", action: "win", actionLabel: "9회 경기 종료", timestamp: "01:02:33", clipUrl: "", thumbnailUrl: "" },
    { id: "h10", position: "P", category: "defense", action: "strikeout", actionLabel: "3회 삼진 처리", timestamp: "00:20:15", clipUrl: "", thumbnailUrl: "" },
    { id: "h11", position: "P", category: "defense", action: "pickoff", actionLabel: "5회 견제 아웃", timestamp: "00:36:47", clipUrl: "", thumbnailUrl: "" },
    { id: "h12", position: "C", category: "defense", action: "throw_out", actionLabel: "4회 도루 저지", timestamp: "00:27:52", clipUrl: "", thumbnailUrl: "" },
    { id: "h13", position: "C", category: "defense", action: "block", actionLabel: "7회 블로킹", timestamp: "00:50:08", clipUrl: "", thumbnailUrl: "" },
  ];

  const POSITIONS = [
    { key: "P", label: "투수" },
    { key: "C", label: "포수" },
    { key: "1B", label: "1루수" },
    { key: "2B", label: "2루수" },
    { key: "3B", label: "3루수" },
    { key: "SS", label: "유격수" },
    { key: "LF", label: "좌익수" },
    { key: "CF", label: "중견수" },
    { key: "RF", label: "우익수" },
  ];

  const CATEGORY_META = {
    batting: { title: "타격 장면", badge: "NICE PLAY" },
    defense: { title: "수비 플레이", badge: "DEFENSE" },
    highlight: { title: "주요 플레이", badge: "BROS MOMENT" },
  };
  const CATEGORY_ORDER = ["batting", "defense", "highlight"];

  let activePosition = null;

  // ===================== 필터링 =====================
  /**
   * 포지션 기준으로 하이라이트를 걸러냅니다. (백엔드에서 position 필드만 내려주면 그대로 재사용 가능)
   * @param {HighlightClip[]} highlights
   * @param {string} position 예: "SS"
   * @returns {HighlightClip[]}
   */
  function filterHighlightsByPosition(highlights, position) {
    return highlights.filter((clip) => clip.position === position);
  }

  /** @param {HighlightClip[]} highlights */
  function groupHighlightsByCategory(highlights) {
    const groups = {};
    highlights.forEach((clip) => {
      if (!groups[clip.category]) groups[clip.category] = [];
      groups[clip.category].push(clip);
    });
    return groups;
  }

  // ===================== 렌더링 =====================
  function renderEmptyState(title, desc) {
    const el = document.createElement("div");
    el.className = "empty-state";
    el.innerHTML = `
      <span class="empty-state__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>
      </span>
      <p class="empty-state__title">${title}</p>
      <p class="empty-state__desc">${desc}</p>
    `;
    return el;
  }

  /** @param {HighlightClip} clip */
  function renderClipCard(clip) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "clip-card";
    btn.innerHTML = `
      <span class="clip-card__thumb">${ICONS.play}</span>
      <span class="clip-card__meta">
        <span class="clip-card__action">${clip.actionLabel}</span>
        <span class="clip-card__time">${clip.timestamp}</span>
      </span>
    `;
    btn.addEventListener("click", () => playClip(clip));
    return btn;
  }

  /**
   * @param {string} categoryKey
   * @param {HighlightClip[]} clips
   */
  function renderClipGroup(categoryKey, clips, titleOverride) {
    const meta = CATEGORY_META[categoryKey] || { title: categoryKey, badge: "" };
    const section = document.createElement("div");
    section.className = "clip-group";
    section.innerHTML = `
      <div class="clip-group__head">
        <span class="clip-group__badge">${meta.badge}</span>
        <h3 class="clip-group__title">${titleOverride || meta.title}</h3>
      </div>
      <div class="clip-group__list"></div>
    `;
    const list = section.querySelector(".clip-group__list");
    clips.forEach((clip) => list.appendChild(renderClipCard(clip)));
    return section;
  }

  /**
   * 전체 하이라이트 탭: 상단 경기 정보 + 카테고리별(타격/수비/주요) 장면 목록을 그립니다.
   * @param {HighlightClip[]} highlights
   */
  function renderAllHighlights(highlights) {
    const dateEl = document.getElementById("gameDate");
    const opponentEl = document.getElementById("gameOpponent");
    const scoreEl = document.getElementById("gameScore");
    if (dateEl) dateEl.textContent = GAME_INFO.date;
    if (opponentEl) opponentEl.textContent = GAME_INFO.opponent;
    if (scoreEl) scoreEl.textContent = GAME_INFO.score;

    const mount = document.getElementById("allHighlightsSlot");
    if (!mount) return;
    mount.innerHTML = "";

    if (!highlights.length) {
      mount.appendChild(
        renderEmptyState("아직 하이라이트가 없어요", "경기 영상을 올리면 AI가 주요 장면을 찾아 이곳에 정리해드려요.")
      );
      return;
    }

    const groups = groupHighlightsByCategory(highlights);
    CATEGORY_ORDER.forEach((key) => {
      if (groups[key] && groups[key].length) {
        mount.appendChild(renderClipGroup(key, groups[key]));
      }
    });
  }

  /**
   * 포지션별 하이라이트 탭: 선택된 포지션의 수비 장면만 필터링해서 그립니다.
   * @param {HighlightClip[]} highlights
   * @param {string|null} position
   */
  function renderPositionHighlights(highlights, position) {
    const mount = document.getElementById("positionHighlightsSlot");
    if (!mount) return;
    mount.innerHTML = "";

    if (!position) {
      mount.appendChild(
        renderEmptyState("포지션을 선택해주세요", "위에서 포지션을 고르면 해당 포지션의 수비 하이라이트를 볼 수 있어요.")
      );
      return;
    }

    const clips = filterHighlightsByPosition(highlights, position);
    const posInfo = POSITIONS.find((p) => p.key === position);
    const title = `${position} ${posInfo ? posInfo.label : ""}`;

    if (!clips.length) {
      mount.appendChild(
        renderEmptyState(`${title} 하이라이트가 아직 없어요`, "경기 영상을 올리면 AI가 포지션별로 분류해드려요.")
      );
      return;
    }

    mount.appendChild(renderClipGroup("defense", clips, title));
  }

  function renderPositionPicker() {
    const picker = document.getElementById("positionPicker");
    if (!picker) return;
    picker.innerHTML = "";
    POSITIONS.forEach((pos) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "position-pill";
      btn.dataset.position = pos.key;
      btn.textContent = pos.key;
      btn.setAttribute("aria-label", `${pos.key} ${pos.label}`);
      picker.appendChild(btn);
    });
  }

  // ===================== 재생 (대표 영상 자리에 선택한 장면 정보를 반영) =====================
  /** @param {HighlightClip} clip */
  function playClip(clip) {
    const label = document.getElementById("highlightMainLabel");
    const time = document.getElementById("highlightMainTime");
    if (label) label.textContent = clip.actionLabel;
    if (time) time.textContent = clip.timestamp;

    // TODO: 백엔드에서 clip.clipUrl 이 실제로 내려오면, 여기서 <video> 소스로 교체해서 재생하면 됩니다.
    // 예: mainVideoEl.src = clip.clipUrl; mainVideoEl.play();
    if (window.BROS.ui && window.BROS.ui.showToast) {
      window.BROS.ui.showToast("샘플 데이터입니다. 실제 영상이 연동되면 바로 재생됩니다.");
    }
  }

  /** 카드 상단의 "대표 영상" 재생 버튼 (특정 장면이 아니라 경기 전체 하이라이트 릴 재생용) */
  function playMainHighlight() {
    const label = document.getElementById("highlightMainLabel");
    const time = document.getElementById("highlightMainTime");
    if (label) label.textContent = "전체 하이라이트";
    if (time) time.textContent = "";
    // TODO: 백엔드에서 경기 전체 하이라이트 릴 URL이 내려오면 여기서 재생하면 됩니다.
    if (window.BROS.ui && window.BROS.ui.showToast) {
      window.BROS.ui.showToast("샘플 데이터입니다. 실제 영상이 연동되면 바로 재생됩니다.");
    }
  }

  function initMainPlayButton() {
    const btn = document.getElementById("highlightPlayBtn");
    if (btn) btn.addEventListener("click", playMainHighlight);
  }

  // ===================== 탭 전환 (페이지 이동 없이 내용만 교체) =====================
  function switchHighlightTab(tab) {
    document.querySelectorAll("#highlightTabs .report-tab").forEach((el) => {
      el.classList.toggle("report-tab--active", el.dataset.tab === tab);
    });
    const allPanel = document.getElementById("allHighlightsPanel");
    const positionPanel = document.getElementById("positionHighlightsPanel");
    if (allPanel) allPanel.hidden = tab !== "all";
    if (positionPanel) positionPanel.hidden = tab !== "position";
  }

  function initTabs() {
    const tabs = document.getElementById("highlightTabs");
    if (!tabs) return;
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".report-tab");
      if (!btn) return;
      switchHighlightTab(btn.dataset.tab);
    });
  }

  function initPositionPicker() {
    const picker = document.getElementById("positionPicker");
    if (!picker) return;
    picker.addEventListener("click", (e) => {
      const btn = e.target.closest(".position-pill");
      if (!btn) return;
      activePosition = btn.dataset.position;
      picker.querySelectorAll(".position-pill").forEach((el) => {
        el.classList.toggle("position-pill--active", el === btn);
      });
      renderPositionHighlights(MOCK_HIGHLIGHTS, activePosition);
    });
  }

  function init() {
    renderAllHighlights(MOCK_HIGHLIGHTS);
    renderPositionPicker();
    renderPositionHighlights(MOCK_HIGHLIGHTS, activePosition);
    initTabs();
    initPositionPicker();
    initMainPlayButton();
  }

  window.BROS = window.BROS || {};
  window.BROS.highlight = {
    init,
    renderAllHighlights,
    renderPositionHighlights,
    filterHighlightsByPosition,
  };
})();
