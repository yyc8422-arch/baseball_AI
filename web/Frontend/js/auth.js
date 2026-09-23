/**
 * BROS - 로그인 / 회원가입 페이지 (login.html) 전용 스크립트
 * 아직 실제 백엔드 인증 API가 없어서, fetch 로 가짜 서버에 요청하지 않고
 * 폼 검증 + 로컬 로그인 상태 저장까지만 처리합니다. 실제 연동 지점은 TODO 로 표시합니다.
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

  /**
   * 로그인 요청.
   * @param {string} username
   * @param {string} password
   */
  function handleLogin(username, password) {
    // TODO: 백엔드 로그인 API 연동 지점
    // fetch("/api/auth/login", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ username, password }),
    // }).then(...);
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ username }));
    } catch (e) {}
    setMessage("로그인되었습니다. 홈으로 이동합니다.");
    window.location.href = "./index.html";
  }

  /**
   * 회원가입 요청. 실제로는 서버에 저장되고 관리자 승인이 필요하지만,
   * 지금은 백엔드가 없어 안내 메시지만 보여줍니다.
   * @param {string} name
   * @param {string} username
   * @param {string} password
   */
  function handleSignup(name, username, password) {
    // TODO: 백엔드 회원가입 API 연동 지점 (승인 대기 상태로 저장)
    // fetch("/api/auth/signup", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ name, username, password }),
    // }).then(...);
    setMessage("가입 신청이 완료되었습니다. 관리자 승인 후 로그인하실 수 있습니다.");
    document.getElementById("signupForm").reset();
    lastCheckedUsername = null;
    setUsernameHint("");
  }

  // ===== 아이디 중복확인 =====
  // 백엔드가 아직 없어서 데모용으로 이 목록만 "이미 사용 중"으로 처리합니다.
  // TODO: 실제로는 서버에 조회 요청을 보내고 그 결과로 판단해야 합니다.
  // fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}`)
  const TAKEN_USERNAMES_DEMO = ["admin", "test", "bros"];

  let lastCheckedUsername = null; // 중복확인을 통과한 아이디 (submit 시 재확인용)

  function setUsernameHint(text, status) {
    const hint = document.getElementById("usernameCheckHint");
    if (!hint) return;
    hint.textContent = text;
    hint.classList.toggle("auth-field__hint--ok", status === "ok");
    hint.classList.toggle("auth-field__hint--error", status === "error");
  }

  function checkUsernameAvailability(username) {
    if (!username) {
      setUsernameHint("아이디를 먼저 입력해주세요.", "error");
      return;
    }
    const isTaken = TAKEN_USERNAMES_DEMO.includes(username.toLowerCase());
    if (isTaken) {
      lastCheckedUsername = null;
      setUsernameHint("이미 사용 중인 아이디입니다.", "error");
    } else {
      lastCheckedUsername = username;
      setUsernameHint("사용 가능한 아이디입니다.", "ok");
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
