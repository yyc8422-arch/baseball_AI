/**
 * BROS - 모든 페이지가 공유하는 "셸" (사이드바, 상단바, 다크모드, 로그인, 토스트)
 * 페이지별 스크립트(main.js 등)는 window.BROS.shell.init(currentNavKey) 하나만 호출하면 됩니다.
 */
(function () {
  const THEME_KEY = "bros-theme";
  const AUTH_KEY = "bros-auth";

  // ===== 사이드바 내비게이션 렌더 + 열고 닫기 =====
  function renderSidebarNav(currentKey) {
    const navEl = document.getElementById("sidebarNav");
    if (!navEl) return;
    const { NAV_ITEMS } = window.BROS.data;
    const { renderNavItem } = window.BROS.render;
    NAV_ITEMS.forEach((item) => navEl.appendChild(renderNavItem(item, currentKey)));
  }

  function bindSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.getElementById("overlay");
    const menuToggle = document.getElementById("menuToggle");
    const sidebarClose = document.getElementById("sidebarClose");
    if (!sidebar || !overlay || !menuToggle || !sidebarClose) return;

    function openSidebar() {
      sidebar.classList.add("sidebar--open");
      overlay.classList.add("overlay--visible");
    }
    function closeSidebar() {
      sidebar.classList.remove("sidebar--open");
      overlay.classList.remove("overlay--visible");
    }

    menuToggle.addEventListener("click", () => {
      sidebar.classList.contains("sidebar--open") ? closeSidebar() : openSidebar();
    });
    overlay.addEventListener("click", closeSidebar);
    sidebarClose.addEventListener("click", closeSidebar);

    // 모바일에서 메뉴 항목을 누르면 다음 페이지로 이동하기 전에 메뉴부터 닫아줌
    const navEl = document.getElementById("sidebarNav");
    if (navEl) {
      navEl.addEventListener("click", (e) => {
        if (e.target.closest(".nav-item")) closeSidebar();
      });
    }
  }

  // 히어로 영역을 지나 스크롤하면 상단바에 유리 배경 + 축약 타이틀이 떠오르는 효과.
  // 홈은 화면 전체 메인 비주얼(.home-hero)을 기준으로 하고, 그 위에 있는 동안은 상단바를 흰 글씨로(topbar--on-hero).
  // .hero 가 없는 페이지에서는 조용히 아무 일도 하지 않습니다.
  function bindScrollHeader() {
    const topbar = document.getElementById("topbar");
    const title = document.getElementById("topbarTitle");
    const photoHero = document.querySelector(".home-hero");
    const hero = photoHero || document.querySelector(".hero");
    if (!topbar || !title || !hero) return;

    const FADE_RANGE = 60;
    let ticking = false;

    function computeProgress() {
      const topbarHeight = topbar.getBoundingClientRect().height;
      const heroBottom = hero.getBoundingClientRect().bottom;
      const raw = topbarHeight - heroBottom;
      return Math.min(Math.max(raw / FADE_RANGE, 0), 1);
    }

    function applyProgress(progress) {
      topbar.style.backgroundColor = `rgba(var(--bg-rgb), ${(0.82 * progress).toFixed(3)})`;
      topbar.style.backdropFilter = `blur(${(10 * progress).toFixed(2)}px)`;
      topbar.style.webkitBackdropFilter = topbar.style.backdropFilter;
      topbar.style.borderBottomColor = `rgba(var(--border-rgb), ${progress.toFixed(3)})`;
      topbar.style.boxShadow = `0 6px 18px rgba(var(--shadow-rgb), ${(0.06 * progress).toFixed(3)})`;

      title.style.opacity = progress.toFixed(3);
      title.style.transform = `translateY(${(-10 * (1 - progress)).toFixed(2)}px)`;
      title.style.pointerEvents = progress > 0.5 ? "auto" : "none";
      if (photoHero) topbar.classList.toggle("topbar--on-hero", progress < 0.5);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        applyProgress(computeProgress());
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  // ===== 다크모드 / 라이트모드 =====
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const ICONS = window.BROS.render.ICONS;
    btn.innerHTML = theme === "dark" ? ICONS.sun : ICONS.moon;
    btn.setAttribute("aria-label", theme === "dark" ? "라이트모드로 전환" : "다크모드로 전환");
  }

  function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    applyTheme(saved === "dark" ? "dark" : "light");

    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    btn.addEventListener("click", () => {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }

  // ===== 로그인 =====
  // login.html(js/auth.js)에서 로그인 성공 시 같은 키로 localStorage 에 저장하므로,
  // 페이지가 달라도 로그인 상태가 공유됩니다.
  function isLoggedIn() {
    try {
      return !!localStorage.getItem(AUTH_KEY);
    } catch (e) {
      return false;
    }
  }

  function updateLoginButton() {
    const btn = document.getElementById("loginBtn");
    if (!btn) return;
    const loggedIn = isLoggedIn();
    btn.textContent = loggedIn ? "로그아웃" : "로그인";
    btn.classList.toggle("login-btn--active", loggedIn);
  }

  function clearLocalAuth() {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch (e) {}
  }

  /** 저장해 둔 로그인 사용자 정보 { username, name, role } (없으면 null) */
  function getAuthUser() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  /** 서버 세션까지 끊는 로그아웃. 서버가 꺼져 있어도 화면에서는 로그아웃 처리합니다. */
  async function logout() {
    try {
      await window.BROS.api.request("/api/auth/logout", { method: "POST" });
    } catch (e) {}
    clearLocalAuth();
    updateLoginButton();
  }

  /**
   * localStorage 에는 로그인 표시가 남아 있는데 서버 세션이 만료(30분)됐거나 승인이 취소된 경우를 맞춰줌.
   * 서버에 연결이 안 될 때(status 0)는 판단할 수 없으니 그대로 둡니다.
   */
  async function syncSession() {
    if (!isLoggedIn()) return;
    try {
      const user = await window.BROS.api.request("/api/auth/me");
      localStorage.setItem(AUTH_KEY, JSON.stringify(user));
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        clearLocalAuth();
        updateLoginButton();
      }
    }
  }

  function initAuth() {
    updateLoginButton();
    syncSession();
    const btn = document.getElementById("loginBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (isLoggedIn()) {
        await logout();
        return;
      }
      window.location.href = "./login.html";
    });
  }

  /** 로그인하지 않은 사용자가 마이페이지 등 보호된 페이지에 들어오면 로그인 페이지로 돌려보냄 */
  function requireLogin() {
    if (isLoggedIn()) return true;
    window.location.href = "./login.html";
    return false;
  }

  // ===== 공용 토스트 안내 메시지 =====
  let toastTimer = null;

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("toast--visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("toast--visible"), 3200);
  }

  /**
   * 모든 페이지 공통 초기화. body 에 <body data-page="pitching"> 처럼 표시해두면
   * 그 값을 그대로 사이드바 active 표시에 사용합니다 (currentKey 를 생략해도 됨).
   * @param {string} [currentKey]
   */
  /**
   * 상단바 다크모드 버튼 옆에 마이페이지 바로가기 아이콘을 붙임 (모든 페이지 공통이라 HTML 대신 여기서 생성).
   * 로그인하지 않았으면 마이페이지가 알아서 로그인 페이지로 보내줍니다.
   */
  function renderMypageButton(currentKey) {
    const themeBtn = document.getElementById("themeToggle");
    if (!themeBtn || document.getElementById("mypageBtn")) return;
    const link = document.createElement("a");
    link.id = "mypageBtn";
    link.href = "./mypage.html";
    link.className = "icon-btn icon-btn--neon";
    link.classList.toggle("icon-btn--active", currentKey === "mypage");
    link.setAttribute("aria-label", "마이페이지");
    link.title = "마이페이지";
    link.innerHTML = window.BROS.render.ICONS.mypage;
    themeBtn.after(link);
  }

  function init(currentKey) {
    const key = currentKey || document.body.dataset.page || null;
    renderSidebarNav(key);
    bindSidebar();
    bindScrollHeader();
    initTheme();
    renderMypageButton(key);
    initAuth();
    if (window.BROS.capture) window.BROS.capture.initCaptureFeature();
  }

  window.BROS = window.BROS || {};
  window.BROS.shell = { init, isLoggedIn, requireLogin, getAuthUser, clearLocalAuth, logout };
  window.BROS.ui = { showToast };
})();
