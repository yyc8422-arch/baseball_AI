/**
 * BROS - 회원 승인 관리 (admin.html, 관리자 전용)
 * - GET  /api/admin/users?status=PENDING   목록
 * - POST /api/admin/users/{id}/approve     승인
 * - POST /api/admin/users/{id}/reject      거절
 * 관리자가 아니면 서버가 403 을 주므로, 안내 문구만 보여줍니다.
 */
(function () {
  const STATUS_LABEL = {
    PENDING: "승인 대기",
    APPROVED: "승인됨",
    REJECTED: "거절됨",
  };

  const EMPTY_TEXT = {
    PENDING: "승인을 기다리는 가입 신청이 없어요.",
    APPROVED: "승인된 회원이 없어요.",
    REJECTED: "거절된 회원이 없어요.",
    "": "가입한 회원이 없어요.",
  };

  let currentStatus = "PENDING";

  function renderMessage(text) {
    const list = document.getElementById("adminUserList");
    list.innerHTML = "";
    const p = document.createElement("p");
    p.className = "record-list__message";
    p.textContent = text;
    list.appendChild(p);
  }

  function createActionButton(label, action, user, variant) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `admin-action admin-action--${variant}`;
    btn.textContent = label;
    btn.addEventListener("click", () => changeStatus(user, action, btn));
    return btn;
  }

  function createUserItem(user) {
    const item = document.createElement("div");
    item.className = "record-item record-item--static";

    const main = document.createElement("div");
    main.className = "record-item__main";

    const name = document.createElement("p");
    name.className = "record-item__name";
    name.textContent = `${user.name} (${user.username})`;

    const meta = document.createElement("p");
    meta.className = "record-item__meta";
    const reviewed = user.reviewedAt ? ` · 처리 ${user.reviewedAt}` : "";
    meta.textContent = `가입 신청 ${user.createdAt}${reviewed}${user.role === "ADMIN" ? " · 관리자" : ""}`;

    main.append(name, meta);

    const side = document.createElement("div");
    side.className = "record-item__side";

    const badge = document.createElement("span");
    badge.className = `record-item__badge record-item__badge--${user.status.toLowerCase()}`;
    badge.textContent = STATUS_LABEL[user.status] || user.status;
    side.appendChild(badge);

    // 관리자 계정은 서버에서도 상태 변경을 막고 있어서 버튼을 보여주지 않음
    if (user.role !== "ADMIN") {
      if (user.status !== "APPROVED") side.appendChild(createActionButton("승인", "approve", user, "approve"));
      if (user.status !== "REJECTED") side.appendChild(createActionButton("거절", "reject", user, "reject"));
    }

    item.append(main, side);
    return item;
  }

  async function loadUsers() {
    const status = currentStatus;
    const query = status ? `?status=${status}` : "";
    let users;
    try {
      users = await window.BROS.api.request(`/api/admin/users${query}`, { fallbackError: "회원 목록을 불러오지 못했어요." });
    } catch (e) {
      if (e.status === 401) {
        window.BROS.shell.clearLocalAuth();
        window.location.href = "./login.html";
        return;
      }
      renderMessage(e.message);
      return;
    }
    if (status !== currentStatus) return; // 응답 도착 전에 다른 탭을 누른 경우

    const list = document.getElementById("adminUserList");
    list.innerHTML = "";
    if (users.length === 0) {
      renderMessage(EMPTY_TEXT[status]);
      return;
    }
    users.forEach((user) => list.appendChild(createUserItem(user)));
  }

  async function changeStatus(user, action, btn) {
    const verb = action === "approve" ? "승인" : "거절";
    if (!window.confirm(`${user.name}(${user.username}) 님의 가입을 ${verb}할까요?`)) return;

    btn.disabled = true;
    try {
      await window.BROS.api.request(`/api/admin/users/${user.id}/${action}`, {
        method: "POST",
        fallbackError: `${verb}하지 못했어요.`,
      });
      window.BROS.ui.showToast(`${user.name} 님을 ${verb}했어요.`);
      loadUsers();
    } catch (e) {
      window.BROS.ui.showToast(e.message);
      btn.disabled = false;
    }
  }

  function initFilter() {
    const filter = document.getElementById("adminFilter");
    filter.addEventListener("click", (e) => {
      const btn = e.target.closest(".admin-filter__btn");
      if (!btn) return;
      filter.querySelectorAll(".admin-filter__btn").forEach((b) => {
        b.classList.toggle("admin-filter__btn--active", b === btn);
      });
      currentStatus = btn.dataset.status;
      loadUsers();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!window.BROS.shell.requireLogin()) return;
    window.BROS.shell.init();
    initFilter();
    loadUsers();
  });
})();
