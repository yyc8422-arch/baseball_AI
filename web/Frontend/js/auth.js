/**
 * BROS - 로그인 / 회원가입 페이지 (login.html) 전용 스크립트
 * Spring 백엔드의 /api/auth/* 를 호출합니다 (js/api.js 가 먼저 로드되어 있어야 함).
 * 로그인 상태의 진짜 기준은 서버 세션이고, localStorage("bros-auth")는 화면 표시용 사본입니다.
 */
(function () {
  const AUTH_KEY = "bros-auth";

  function setMessage(text, isError) {
    const el = document.getElementById("authMessage");
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("auth-message--error", !!isError);
  }

  function switchMode(mode) {
    document.querySelectorAll(".auth-tab").forEach((btn) => {
      btn.classList.toggle("auth-tab--active", btn.dataset.mode === mode);
    });
    document.querySelectorAll(".auth-form").forEach((form) => {
      form.hidden = form.dataset.modePanel !== mode;
    });
    setMessage("");
  }

  function initTabs() {
    const tabs = document.getElementById("authTabs");
    if (!tabs) return;
    tabs.addEventListener("click", (e) => {
      const btn = e.target.closest(".auth-tab");
      if (!btn) return;
      switchMode(btn.dataset.mode);
    });
  }

  /** 요청 중에는 제출 버튼을 잠가서 두 번 눌러도 한 번만 요청되게 함 */
  function setBusy(form, busy) {
    const btn = form && form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = busy;
  }

  /**
   * 로그인 요청. 승인 대기/거절 계정이면 서버가 403 과 안내 문구를 돌려줍니다.
   * @param {string} username
   * @param {string} password
   */
  async function handleLogin(username, password) {
    const form = document.getElementById("loginForm");
    setBusy(form, true);
    try {
      const user = await window.BROS.api.request("/api/auth/login", {
        method: "POST",
        json: { username, password },
        fallbackError: "로그인하지 못했어요.",
      });
      try {
        localStorage.setItem(AUTH_KEY, JSON.stringify(user)); // { username, name, role }
      } catch (e) {}
      setMessage("로그인되었습니다. 홈으로 이동합니다.");
      window.location.href = "./index.html";
    } catch (e) {
      setMessage(e.message, true);
      setBusy(form, false);
    }
  }

  /**
   * 회원가입 요청. 서버에 "승인 대기(PENDING)" 상태로 저장되고, 관리자가 승인해야 로그인할 수 있습니다.
   * @param {string} name
   * @param {string} username
   * @param {string} password
   */
  async function handleSignup(name, username, password) {
    const form = document.getElementById("signupForm");
    setBusy(form, true);
    try {
      const result = await window.BROS.api.request("/api/auth/signup", {
        method: "POST",
        json: { name, username, password },
        fallbackError: "가입 신청을 처리하지 못했어요.",
      });
      setMessage(result.message);
      form.reset();
      lastCheckedUsername = null;
      setUsernameHint("");
    } catch (e) {
      setMessage(e.message, true);
    } finally {
      setBusy(form, false);
    }
  }

  // ===== 아이디 중복확인 =====
  let lastCheckedUsername = null; // 중복확인을 통과한 아이디 (submit 시 재확인용)

  function setUsernameHint(text, status) {
    const hint = document.getElementById("usernameCheckHint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle("auth-field__hint--ok", status === "ok");
    hint.classList.toggle("auth-field__hint--error", status === "error");
  }

  async function checkUsernameAvailability(username) {
    if (!username) {
      setUsernameHint("아이디를 먼저 입력해주세요.", "error");
      return;
    }
    lastCheckedUsername = null;
    try {
      const result = await window.BROS.api.request(
        `/api/auth/check-username?username=${encodeURIComponent(username)}`,
        { fallbackError: "중복확인을 하지 못했어요." }
      );
      // 응답이 오는 사이에 아이디를 다시 고쳤으면 이 결과는 버림
      if (document.getElementById("signupUsername").value.trim() !== username) return;
      if (result.available) lastCheckedUsername = username;
      setUsernameHint(result.message, result.available ? "ok" : "error");
    } catch (e) {
      setUsernameHint(e.message, "error");
    }
  }

  function initUsernameCheck() {
    const input = document.getElementById("signupUsername");
    const checkBtn = document.getElementById("checkUsernameBtn");
    if (!input || !checkBtn) return;

    checkBtn.addEventListener("click", () => {
      checkUsernameAvailability(input.value.trim());
    });

    // 확인 후 아이디를 다시 수정하면, 이전 확인 결과는 무효화하고 재확인을 요구함
    input.addEventListener("input", () => {
      if (lastCheckedUsername !== null && input.value.trim() !== lastCheckedUsername) {
        lastCheckedUsername = null;
        setUsernameHint("");
      }
    });
  }

  function initForms() {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (loginForm) {
      loginForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const username = loginForm.username.value.trim();
        const password = loginForm.password.value;
        if (!username || !password) {
          setMessage("아이디와 비밀번호를 입력해주세요.", true);
          return;
        }
        handleLogin(username, password);
      });
    }

    if (signupForm) {
      signupForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const name = signupForm.name.value.trim();
        const username = signupForm.username.value.trim();
        const password = signupForm.password.value;
        if (!name || !username || !password) {
          setMessage("이름, 아이디, 비밀번호를 모두 입력해주세요.", true);
          return;
        }
        if (username !== lastCheckedUsername) {
          setMessage("아이디 중복확인을 먼저 진행해주세요.", true);
          return;
        }
        handleSignup(name, username, password);
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initTabs();
    initForms();
    initUsernameCheck();
  });
})();
