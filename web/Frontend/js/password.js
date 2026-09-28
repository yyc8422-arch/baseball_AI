/**
 * BROS - 비밀번호 변경 (password.html, 마이페이지 "내 정보"의 "비밀번호 변경" 버튼으로 들어옴)
 * POST /api/auth/password. 바꾼 뒤에도 로그인은 유지되고, 잠시 후 마이페이지로 돌아갑니다.
 */
(function () {
  const MIN_PASSWORD_LENGTH = 8; // 백엔드 AuthService 와 같은 기준

  function setMessage(text, isError) {
    const el = document.getElementById("passwordMessage");
    el.textContent = text;
    el.classList.toggle("auth-message--error", !!isError);
  }

  function goToLogin() {
    window.BROS.shell.clearLocalAuth();
    window.location.href = "./login.html";
  }

  function initForm() {
    const form = document.getElementById("passwordForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const currentPassword = form.currentPassword.value;
      const newPassword = form.newPassword.value;
      if (newPassword.length < MIN_PASSWORD_LENGTH) {
        return setMessage(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`, true);
      }
      if (newPassword !== form.confirmPassword.value) {
        return setMessage("새 비밀번호 확인이 일치하지 않습니다.", true);
      }

      const btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      try {
        const result = await window.BROS.api.request("/api/auth/password", {
          method: "POST",
          json: { currentPassword, newPassword },
          fallbackError: "비밀번호를 변경하지 못했어요.",
        });
        form.reset();
        setMessage(`${result.message} 마이페이지로 돌아갑니다.`);
        setTimeout(() => {
          window.location.href = "./mypage.html";
        }, 1500);
      } catch (err) {
        if (err.status === 401) return goToLogin();
        setMessage(err.message, true);
        btn.disabled = false;
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.BROS.shell.requireLogin()) return;
    // 마이페이지의 하위 화면이라 사이드바/상단바에서는 마이페이지를 활성으로 표시
    window.BROS.shell.init("mypage");
    initForm();
  });
})();
