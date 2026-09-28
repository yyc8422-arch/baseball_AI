/**
 * BROS - 경기 하이라이트 페이지 (highlight.html) 전용 스크립트
 *
 * 구조:
 *  - loadLatestHighlights() : GET /api/highlights/latest 로 최신 경기(games) + 하이라이트(highlight_clips) 를 받아옴
 *    (등록된 경기가 없으면 404 → 안내 문구, 서버 연결 실패 → 안내 문구)
 *  - filterHighlightsByPosition(highlights, position) : 포지션 기준 필터링만 담당
 *  - renderAllHighlights(highlights) / renderPositionHighlights(highlights, position) : 화면 렌더링만 담당
 *  - 탭 전환은 페이지 이동 없이 클래스/hidden 토글로만 처리합니다.
 */
(function () {
  const ICONS = {
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  };

  const escapeHtml = window.BROS.render.escapeHtml;

  // ===================== 서버에서 받아온 데이터 =====================
  /** @type {GameInfo|null} 최신 경기 정보 (없으면 null) */
  let gameInfo = null;
  /** @type {HighlightClip[]} */
  let highlights = [];
  const NO_HIGHLIGHTS = ["아직 하이라이트가 없어요", "경기 영상을 올리면 AI가 주요 장면을 찾아 이곳에 정리해드려요."];
  /** 목록이 비었을 때 안내 문구 [제목, 설명] (처음엔 불러오는 중) */
  let emptyMessage = ["하이라이트를 불러오는 중이에요", "잠시만 기다려주세요."];

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
      <p class="empty-state__title">${escapeHtml(title)}</p>
      <p class="empty-state__desc">${escapeHtml(desc)}</p>
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
        <span class="clip-card__action">${escapeHtml(clip.actionLabel)}</span>
        <span class="clip-card__time">${escapeHtml(clip.timestamp)}</span>
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
        <span class="clip-group__badge">${escapeHtml(meta.badge)}</span>
        <h3 class="clip-group__title">${escapeHtml(titleOverride || meta.title)}</h3>
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
    if (dateEl) dateEl.textContent = gameInfo ? gameInfo.date : "-";
    if (opponentEl) opponentEl.textContent = gameInfo ? gameInfo.opponent : "-";
    if (scoreEl) scoreEl.textContent = gameInfo && gameInfo.score ? gameInfo.score : "-";

    const mount = document.getElementById("allHighlightsSlot");
    if (!mount) return;
    mount.innerHTML = "";

    if (!highlights.length) {
      mount.appendChild(renderEmptyState(emptyMessage[0], emptyMessage[1]));
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

    // 장면 영상 주소(highlight_clips.clip_url)가 등록돼 있으면 새 탭에서 재생, 없으면 안내만
    if (clip.clipUrl) {
      window.open(clip.clipUrl, "_blank", "noopener");
    } else if (window.BROS.ui && window.BROS.ui.showToast) {
      window.BROS.ui.showToast("이 장면 영상은 아직 준비 중이에요.");
    }
  }

  /** 카드 상단의 "대표 영상" 재생 버튼 (특정 장면이 아니라 경기 전체 하이라이트 릴 재생용) */
  function playMainHighlight() {
    const label = document.getElementById("highlightMainLabel");
    const time = document.getElementById("highlightMainTime");
    if (label) label.textContent = "전체 하이라이트";
    if (time) time.textContent = "";
    // 경기 전체 하이라이트 영상은 아직 DB/AI-Server 에 없어서 안내만 (games 테이블에 영상 주소가 생기면 여기서 재생)
    if (window.BROS.ui && window.BROS.ui.showToast) {
      window.BROS.ui.showToast(gameInfo ? "경기 전체 하이라이트 영상은 준비 중이에요." : "등록된 경기가 없어요.");
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
      renderPositionHighlights(highlights, activePosition);
    });
  }

  // ===================== 서버에서 불러오기 =====================
  async function loadLatestHighlights() {
    try {
      const page = await window.BROS.api.request("/api/highlights/latest", {
        fallbackError: "하이라이트를 불러오지 못했어요.",
      });
      gameInfo = page.game;
      highlights = page.highlights || [];
      emptyMessage = NO_HIGHLIGHTS;
    } catch (e) {
      gameInfo = null;
      highlights = [];
      emptyMessage =
        e.status === 404
          ? ["등록된 경기가 없어요", "경기 영상을 올리면 AI가 주요 장면을 찾아 이곳에 정리해드려요."]
          : ["하이라이트를 불러오지 못했어요", e.message];
    }
    renderAllHighlights(highlights);
    renderPositionHighlights(highlights, activePosition);
  }

  function init() {
    renderAllHighlights(highlights); // 불러오는 동안은 빈 상태
    renderPositionPicker();
    renderPositionHighlights(highlights, activePosition);
    initTabs();
    initPositionPicker();
    initMainPlayButton();
    loadLatestHighlights();
  }

  window.BROS = window.BROS || {};
  window.BROS.highlight = {
    init,
    renderAllHighlights,
    renderPositionHighlights,
    filterHighlightsByPosition,
  };
})();
