/**
 * BROS - 프로필 카드 / 내 정보 공통 (mypage.html, account.html)
 * - 프로필 카드: 사진(누르면 사진 선택), 이름, 아이디·회원 구분, 관리자 링크, 로그아웃
 * - 내 정보 목록(#accountInfo 가 있는 페이지만): 이름, 아이디, 회원 구분, 가입 상태, 가입일, 승인일, 사진 변경/삭제
 * GET /api/auth/me 로 채우고, /api/mypage/profile-image 로 사진을 등록/삭제합니다.
 * 세션이 없거나(401) 승인이 취소된(403) 경우 로그인 페이지로 돌려보냅니다.
 */
(function () {
  const ROLE_LABEL = { USER: "일반 회원", ADMIN: "관리자" };
  const ACCOUNT_STATUS_LABEL = { PENDING: "승인 대기", APPROVED: "승인 완료", REJECTED: "거절됨" };
  const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 백엔드 ProfileImageService 와 같은 기준
  const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const $ = (id) => document.getElementById(id);

  function goToLogin() {
    window.BROS.shell.clearLocalAuth();
    window.location.href = "./login.html";
  }

  function renderAvatar(user) {
    const img = $("avatarImg");
    if (!img) return;
    const hasImage = !!user.profileImageUrl;
    img.hidden = !hasImage;
    document.querySelector(".profile-card__avatar-icon").hidden = hasImage;
    if ($("avatarDeleteBtn")) $("avatarDeleteBtn").hidden = !hasImage;
    if (hasImage) {
      img.src = window.BROS.api.API_BASE_URL + user.profileImageUrl;
      img.alt = `${user.name || user.username}님 프로필 사진`;
    } else {
      img.removeAttribute("src");
    }
  }

  /** 내 정보 목록. 저장해 둔 옛 로그인 정보에는 없는 필드도 있어서 없으면 "-" */
  function renderAccountInfo(user) {
    const list = $("accountInfo");
    if (!list) return;
    const values = {
      name: user.name,
      username: user.username,
      role: ROLE_LABEL[user.role] || user.role,
      status: ACCOUNT_STATUS_LABEL[user.status] || user.status,
      createdAt: user.createdAt,
      // 처음 자동으로 만들어진 관리자 계정은 승인 절차가 없었으므로 기록이 없음
      reviewedAt: user.reviewedAt || (user.status === "APPROVED" && user.createdAt ? "자동 승인" : null),
    };
    list.querySelectorAll("[data-field]").forEach((dd) => {
      dd.textContent = values[dd.dataset.field] || "-";
    });
  }

  function renderProfile(user) {
    $("profileName").textContent = `${user.name || user.username}님`;
    const isAdmin = user.role === "ADMIN";
    $("profileMeta").textContent = `${user.username} · ${isAdmin ? "관리자" : "BROS 회원"}`;
    if ($("adminLink")) $("adminLink").hidden = !isAdmin;
    renderAvatar(user);
    renderAccountInfo(user);
  }

  /** 서버의 최신 정보로 화면과 저장된 로그인 정보를 다시 맞춤 */
  async function refreshProfile() {
    const user = await window.BROS.api.request("/api/auth/me");
    try {
      localStorage.setItem("bros-auth", JSON.stringify(user));
    } catch (e) {}
    renderProfile(user);
    return user;
  }

  async function uploadAvatar(file) {
    const { showToast } = window.BROS.ui;
    if (!AVATAR_TYPES.includes(file.type)) return showToast("JPG, PNG, WEBP, GIF 사진만 올릴 수 있어요.");
    if (file.size > MAX_AVATAR_BYTES) return showToast("사진은 5MB 이하만 올릴 수 있어요.");

    const formData = new FormData();
    formData.append("image", file, file.name);
    try {
      const result = await window.BROS.api.request("/api/mypage/profile-image", {
        method: "POST",
        formData,
        fallbackError: "사진을 올리지 못했어요.",
      });
      await refreshProfile();
      showToast(result.message);
    } catch (e) {
      if (e.status === 401) return goToLogin();
      showToast(e.message);
    }
  }

  async function deleteAvatar() {
    const { showToast } = window.BROS.ui;
    if (!window.confirm("프로필 사진을 삭제할까요?")) return;
    try {
      const result = await window.BROS.api.request("/api/mypage/profile-image", {
        method: "DELETE",
        fallbackError: "사진을 삭제하지 못했어요.",
      });
      await refreshProfile();
      showToast(result.message);
    } catch (e) {
      if (e.status === 401) return goToLogin();
      showToast(e.message);
    }
  }

  function initAvatar() {
    const input = $("avatarInput");
    if (!input) return;
    const openPicker = () => input.click();
    $("avatarBtn").addEventListener("click", openPicker);
    if ($("avatarChangeBtn")) $("avatarChangeBtn").addEventListener("click", openPicker);
    if ($("avatarDeleteBtn")) $("avatarDeleteBtn").addEventListener("click", deleteAvatar);
    input.addEventListener("change", () => {
      const file = input.files[0];
      input.value = ""; // 같은 사진을 다시 골라도 change 가 발생하도록
      if (file) uploadAvatar(file);
    });
    // 사진 파일이 서버에서 사라진 경우 깨진 이미지 대신 기본 아이콘
    $("avatarImg").addEventListener("error", () => {
      $("avatarImg").hidden = true;
      document.querySelector(".profile-card__avatar-icon").hidden = false;
    });
  }

  /**
   * 페이지 시작 시 호출: 저장된 정보로 먼저 그리고, 서버에서 최신 정보를 받아 다시 그림.
   * @returns {Promise<object|null>} 로그인 사용자 (로그인 페이지로 보냈으면 null)
   */
  async function init() {
    const cached = window.BROS.shell.getAuthUser();
    if (cached && cached.username) renderProfile(cached);

    $("logoutBtn").addEventListener("click", async () => {
      await window.BROS.shell.logout();
      window.location.href = "./index.html";
    });
    initAvatar();

    try {
      return await refreshProfile();
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        goToLogin();
        return null;
      }
      window.BROS.ui.showToast(e.message);
      return null;
    }
  }

  window.BROS = window.BROS || {};
  window.BROS.profile = { init, goToLogin };
})();
