/**
 * BROS - 홈(index.html) 전용 엔트리 포인트
 * 사이드바/테마/로그인 등 모든 페이지 공통 동작은 js/shell.js 가 담당합니다.
 * 여기서는 홈 화면에만 있는 것들(메인 비주얼, 스크롤 등장 효과, 오늘의 AI 리포트 탭, 4대 기능 메뉴, 3단계 안내 바)만 다룹니다.
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

  // 메인 비주얼이 상단바 뒤까지 올라가도록 CSS(.home-hero)에 상단바 높이를 알려줌
  function syncTopbarHeight() {
    const topbar = document.getElementById("topbar");
    if (!topbar) return;
    const update = () => document.documentElement.style.setProperty("--topbar-h", `${topbar.offsetHeight}px`);
    update();
    window.addEventListener("resize", update);
  }

  // 메인 비주얼은 화면에 고정(sticky)되어 있고, 스크롤한 정도(0~1)를 --hero-cover 로 넘겨
  // 배경을 어둡게 하고 슬로건을 흐리게 함 (화면 높이의 70% 만큼 스크롤하면 1)
  function bindHeroCover() {
    const hero = document.getElementById("homeHero");
    if (!hero) return;
    let ticking = false;
    const update = () => {
      const progress = Math.min(Math.max(window.scrollY / (window.innerHeight * 0.7), 0), 1);
      hero.style.setProperty("--hero-cover", progress.toFixed(3));
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  // ===== 첫 화면 제목 글씨 쓰기 =====
  // "함께라서, 더 멀리" 를 글자마다 span 으로 나눠 순서대로 써지게 함 (애니메이션 자체는 CSS .write-char).
  // 붓글씨 폰트가 늦게 받아지면 다른 글씨체로 써졌다가 바뀌어 보이므로, 폰트를 받은 뒤(최대 1.5초 대기) 시작.
  function initHeroWriting() {
    const title = document.getElementById("heroTitle");
    if (!title || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // 줄바꿈(<br />)도 띄어쓰기로 읽히도록 화면낭독기용 이름을 따로 붙임
    title.setAttribute("aria-label", title.innerHTML.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim());
    let index = 0;
    [...title.childNodes].forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return; // <br /> 는 그대로 둠
      const frag = document.createDocumentFragment();
      [...node.textContent].forEach((ch) => {
        const span = document.createElement("span");
        span.className = "write-char";
        span.setAttribute("aria-hidden", "true");
        span.textContent = ch;
        span.style.setProperty("--i", String(index++));
        frag.appendChild(span);
      });
      node.replaceWith(frag);
    });
    document.documentElement.classList.add("writing-ready");

    const fontReady = document.fonts ? document.fonts.load('1em "Nanum Brush Script"') : Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([fontReady, timeout]).then(() => {
      // 폰트를 받은 다음 프레임에 시작해야 첫 글자가 바뀐 폰트로 그려짐
      requestAnimationFrame(() => title.classList.add("is-writing"));
    });
  }

  // ===== 스크롤하면 섹션이 아래에서 떠오르는 효과 =====
  // data-reveal 이 붙은 요소는 화면에 들어올 때 is-visible 클래스를 받아 나타납니다.
  // JS 가 실행된 경우에만(html.reveal-ready) 숨기므로, JS 가 실패해도 내용은 그대로 보입니다.
  function initScrollReveal() {
    // 기능 카드 4개는 한 번에 말고 순서대로 하나씩 올라오게
    document.querySelectorAll("#featureGrid > *").forEach((card, i) => {
      card.setAttribute("data-reveal", "");
      card.style.setProperty("--reveal-delay", `${i * 90}ms`);
    });

    const targets = document.querySelectorAll("[data-reveal]");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!("IntersectionObserver" in window) || reduceMotion) return;

    document.documentElement.classList.add("reveal-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add("is-visible");
          observer.unobserve(el); // 한 번 나타나면 다시 숨기지 않음
          // 다 나타난 뒤에는 등장용 스타일을 떼서, 카드에 마우스를 올릴 때의 떠오르는 효과(transform)와 겹치지 않게 함
          el.addEventListener(
            "transitionend",
            () => {
              el.removeAttribute("data-reveal");
              el.classList.remove("is-visible");
              el.style.removeProperty("--reveal-delay");
            },
            { once: true }
          );
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    targets.forEach((el) => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    mount();
    syncTopbarHeight();
    initHeroWriting();
    bindHeroCover();
    initScrollReveal();
    bindInteractions();
    window.BROS.shell.init(); // 홈 화면은 사이드바에서 특정 메뉴를 활성 표시하지 않음
  });
})();
