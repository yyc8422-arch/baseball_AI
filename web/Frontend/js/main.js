/**
 * BROS - 홈(index.html) 전용 엔트리 포인트
 * 사이드바/테마/로그인 등 모든 페이지 공통 동작은 js/shell.js 가 담당합니다.
 * 여기서는 홈 화면에만 있는 것들(오늘의 AI 리포트 탭, 4대 기능 메뉴, 3단계 안내 바)만 다룹니다.
 */
(function () {
  const { DAILY_REPORT, FEATURE_ITEMS, HOW_IT_WORKS_STEPS } = window.BROS.data;
  const { renderReportOverview, renderFeatureCard, renderHowBarSteps } = window.BROS.render;

  const DEFAULT_REPORT_TYPE = "pitching";

  // 오늘의 AI 리포트: 투수/타자 탭에 맞는 데이터로 #reportOverviewSlot 을 다시 그림
  function renderReportSection(type) {
    const slot = document.getElementById("reportOverviewSlot");
    const report = DAILY_REPORT.reportsByType[type];
    if (!slot || !report) return;
    slot.innerHTML = "";
    slot.appendChild(renderReportOverview(report));
  }

  function mount() {
    renderReportSection(DEFAULT_REPORT_TYPE);

    const featureGrid = document.getElementById("featureGrid");
    if (featureGrid) FEATURE_ITEMS.forEach((item) => featureGrid.appendChild(renderFeatureCard(item)));

    const howBar = document.getElementById("howBar");
    if (howBar) howBar.appendChild(renderHowBarSteps(HOW_IT_WORKS_STEPS));
  }

  function bindInteractions() {
    // 오늘의 AI 리포트: 투수 / 타자 탭 전환
    const reportTabs = document.getElementById("reportTabs");
    if (reportTabs) {
      reportTabs.addEventListener("click", (e) => {
        const tab = e.target.closest(".report-tab");
        if (!tab) return;
        reportTabs
          .querySelectorAll(".report-tab")
          .forEach((el) => el.classList.remove("report-tab--active"));
        tab.classList.add("report-tab--active");
        renderReportSection(tab.dataset.type);
      });
    }

    // "상세 리포트 보기" 버튼 (render.js 가 탭 전환마다 다시 그리므로 위임 방식으로 연결)
    document.addEventListener("click", (e) => {
      if (e.target.closest("#viewDetailedReportBtn")) {
        goToDetailedReport();
      }
    });
  }

  // ===== 마이페이지 / 상세 리포트 연결 =====
  function goToDetailedReport() {
    if (!window.BROS.shell.isLoggedIn()) {
      window.BROS.ui.showToast("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
      window.location.href = "./login.html";
      return;
    }
    window.location.href = "./mypage.html";
  }

  document.addEventListener("DOMContentLoaded", () => {
    mount();
    bindInteractions();
    window.BROS.shell.init(); // 홈 화면은 사이드바에서 특정 메뉴를 활성 표시하지 않음
  });
})();
