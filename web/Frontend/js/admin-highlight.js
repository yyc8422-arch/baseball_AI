/**
 * BROS - 관리자 화면 "하이라이트 관리" 탭 (admin.html, 관리자 전용)
 * - GET    /api/admin/highlights/games              경기 목록
 * - POST   /api/admin/highlights/games              경기 등록
 * - DELETE /api/admin/highlights/games/{id}         경기 삭제 (장면도 함께)
 * - GET    /api/admin/highlights/games/{id}/clips   장면 목록
 * - POST   /api/admin/highlights/games/{id}/clips   장면 추가
 * - DELETE /api/admin/highlights/clips/{id}         장면 삭제
 * 하이라이트 페이지(highlight.html)에는 가장 최근 날짜의 경기가 보입니다.
 * 위쪽 "회원 승인 / 하이라이트 관리" 탭 전환도 여기서 처리합니다 (주소 뒤 #highlights 로 바로 열 수 있음).
 */
(function () {
  const CATEGORY_LABEL = { batting: "타격 장면", defense: "수비 플레이", highlight: "주요 플레이" };

  let selectedGame = null; // 장면 관리 중인 경기
  let gamesLoaded = false;

  const request = (...args) => window.BROS.api.request(...args);
  const toast = (msg) => window.BROS.ui.showToast(msg);

  function handleError(e) {
    if (e.status === 401) {
      window.BROS.shell.clearLocalAuth();
      window.location.href = "./login.html";
      return;
    }
    toast(e.message);
  }

  function renderMessage(list, text) {
    list.innerHTML = "";
    const p = document.createElement("p");
    p.className = "record-list__message";
    p.textContent = text;
    list.appendChild(p);
  }

  function actionButton(label, variant, onClick) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `admin-action admin-action--${variant}`;
    btn.textContent = label;
    btn.addEventListener("click", () => onClick(btn));
    return btn;
  }

  /** 목록 한 줄 (회원 목록과 같은 모양) */
  function listItem(title, meta, badgeText, buttons) {
    const item = document.createElement("div");
    item.className = "record-item record-item--static";

    const main = document.createElement("div");
    main.className = "record-item__main";
    const name = document.createElement("p");
    name.className = "record-item__name";
    name.textContent = title;
    const sub = document.createElement("p");
    sub.className = "record-item__meta";
    sub.textContent = meta;
    main.append(name, sub);

    const side = document.createElement("div");
    side.className = "record-item__side";
    if (badgeText) {
      const badge = document.createElement("span");
      badge.className = "record-item__badge record-item__badge--approved";
      badge.textContent = badgeText;
      side.appendChild(badge);
    }
    buttons.forEach((b) => side.appendChild(b));

    item.append(main, side);
    return item;
  }

  // ===================== 경기 =====================
  async function loadGames() {
    const list = document.getElementById("adminGameList");
    let games;
    try {
      games = await request("/api/admin/highlights/games", { fallbackError: "경기 목록을 불러오지 못했어요." });
    } catch (e) {
      if (e.status === 401) return handleError(e);
      renderMessage(list, e.message);
      return;
    }
    gamesLoaded = true;
    list.innerHTML = "";
    if (!games.length) {
      renderMessage(list, "등록된 경기가 없어요. 위에서 경기를 먼저 추가해주세요.");
      closeClips();
      return;
    }
    games.forEach((game) => {
      const buttons = [
        actionButton("장면 관리", "approve", () => openClips(game)),
        actionButton("삭제", "reject", (btn) => deleteGame(game, btn)),
      ];
      list.appendChild(
        listItem(
          `${game.date} vs ${game.opponent}`,
          `${game.score} · 장면 ${game.clipCount}개`,
          game.showing ? "하이라이트에 표시 중" : "",
          buttons
        )
      );
    });
    // 장면 관리 중이던 경기가 지워졌으면 닫기, 있으면 개수 등 최신 정보로 갱신
    if (selectedGame) {
      const still = games.find((g) => g.id === selectedGame.id);
      if (still) selectedGame = still;
      else closeClips();
    }
  }

  function initGameForm() {
    const form = document.getElementById("gameForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const result = await request("/api/admin/highlights/games", {
          method: "POST",
          json: { gameDate: form.gameDate.value, opponent: form.opponent.value, score: form.score.value },
          fallbackError: "경기를 등록하지 못했어요.",
        });
        toast(result.message);
        form.reset();
        loadGames();
      } catch (err) {
        handleError(err);
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function deleteGame(game, btn) {
    if (!window.confirm(`${game.date} vs ${game.opponent} 경기와 장면 ${game.clipCount}개를 모두 삭제할까요?`)) return;
    btn.disabled = true;
    try {
      const result = await request(`/api/admin/highlights/games/${game.id}`, {
        method: "DELETE",
        fallbackError: "경기를 삭제하지 못했어요.",
      });
      toast(result.message);
      loadGames();
    } catch (e) {
      handleError(e);
      btn.disabled = false;
    }
  }

  // ===================== 장면 =====================
  function openClips(game) {
    selectedGame = game;
    const card = document.getElementById("clipCard");
    card.hidden = false;
    document.getElementById("clipCardTitle").textContent = `장면 관리 · ${game.date} vs ${game.opponent}`;
    loadClips();
    card.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeClips() {
    selectedGame = null;
    document.getElementById("clipCard").hidden = true;
  }

  async function loadClips() {
    if (!selectedGame) return;
    const list = document.getElementById("adminClipList");
    let clips;
    try {
      clips = await request(`/api/admin/highlights/games/${selectedGame.id}/clips`, {
        fallbackError: "장면 목록을 불러오지 못했어요.",
      });
    } catch (e) {
      if (e.status === 401) return handleError(e);
      renderMessage(list, e.message);
      return;
    }
    list.innerHTML = "";
    if (!clips.length) {
      renderMessage(list, "아직 장면이 없어요. 위에서 장면을 추가해주세요.");
      return;
    }
    clips.forEach((clip) => {
      const meta = [CATEGORY_LABEL[clip.category] || clip.category, clip.position, clip.timestamp, clip.clipUrl ? "영상 있음" : "영상 없음"]
        .filter(Boolean)
        .join(" · ");
      list.appendChild(
        listItem(clip.actionLabel, meta, "", [actionButton("삭제", "reject", (btn) => deleteClip(clip, btn))])
      );
    });
  }

  function initClipForm() {
    const form = document.getElementById("clipForm");
    // 수비 플레이는 포지션이 필수라 선택칸을 강조
    form.category.addEventListener("change", () => {
      form.position.required = form.category.value === "defense";
    });
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!selectedGame) return;
      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const result = await request(`/api/admin/highlights/games/${selectedGame.id}/clips`, {
          method: "POST",
          json: {
            category: form.category.value,
            position: form.position.value,
            actionLabel: form.actionLabel.value,
            timestamp: form.timestamp.value,
            clipUrl: form.clipUrl.value,
          },
          fallbackError: "장면을 추가하지 못했어요.",
        });
        toast(result.message);
        // 같은 분류/포지션으로 연달아 넣기 쉽도록 이름·시간·주소만 비움
        form.actionLabel.value = "";
        form.timestamp.value = "";
        form.clipUrl.value = "";
        form.actionLabel.focus();
        loadClips();
        loadGames();
      } catch (err) {
        handleError(err);
      } finally {
        btn.disabled = false;
      }
    });
  }

  async function deleteClip(clip, btn) {
    if (!window.confirm(`"${clip.actionLabel}" 장면을 삭제할까요?`)) return;
    btn.disabled = true;
    try {
      const result = await request(`/api/admin/highlights/clips/${clip.id}`, {
        method: "DELETE",
        fallbackError: "장면을 삭제하지 못했어요.",
      });
      toast(result.message);
      loadClips();
      loadGames();
    } catch (e) {
      handleError(e);
      btn.disabled = false;
    }
  }

  // ===================== 위쪽 탭 (회원 승인 / 하이라이트 관리) =====================
  function showPanel(panel) {
    document.querySelectorAll("#adminTabs .report-tab").forEach((tab) => {
      tab.classList.toggle("report-tab--active", tab.dataset.panel === panel);
    });
    document.getElementById("usersPanel").hidden = panel !== "users";
    document.getElementById("highlightsPanel").hidden = panel !== "highlights";
    if (panel === "highlights" && !gamesLoaded) loadGames();
  }

  function initTabs() {
    document.getElementById("adminTabs").addEventListener("click", (e) => {
      const tab = e.target.closest(".report-tab");
      if (!tab) return;
      showPanel(tab.dataset.panel);
      history.replaceState(null, "", tab.dataset.panel === "highlights" ? "#highlights" : "#");
    });
    if (window.location.hash === "#highlights") showPanel("highlights");
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.BROS.shell.isLoggedIn()) return; // admin.js 가 로그인 페이지로 보냄
    initTabs();
    initGameForm();
    initClipForm();
  });
})();
