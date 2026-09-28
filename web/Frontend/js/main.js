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
    // 장면 단위 스크롤 맞춤(CSS scroll-snap)은 홈에서만
    document.documentElement.classList.add("home-snap");
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

  // ===== 첫 화면 문구 글씨 쓰기 =====
  // data-write 가 붙은 문구(영문 한 줄 → 제목 → 설명)를 글자마다 span 으로 나눠, 문구 순서대로 이어서 써지게 함.
  // 글자마다 시작 시각(--d)과 쓰는 시간(--dur)을 계산해서 넘기고, 애니메이션 자체는 CSS(.write-char)가 담당.
  // 붓글씨 폰트가 늦게 받아지면 다른 글씨체로 써졌다가 바뀌어 보이므로, 폰트를 받은 뒤(최대 1.5초 대기) 시작.
  function initHeroWriting() {
    const blocks = [...document.querySelectorAll("[data-write]")];
    if (!blocks.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const GAP_BETWEEN_BLOCKS = 0.15; // 한 문구가 끝나고 다음 문구를 시작하기까지(초)
    const LINE_DRAW_TIME = 0.35; // 영문 줄 앞 짧은 선을 긋는 시간(초)
    let time = 0.1;

    blocks.forEach((block) => {
      const step = parseFloat(block.dataset.writeStep) || 0.05;
      const duration = Math.max(step * 3, 0.3);
      // 화면낭독기에는 쪼개기 전 원래 문장을 그대로 읽어줌
      const readable = block.innerHTML
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const line = block.querySelector(".home-hero__eyebrow-line");
      if (line) {
        line.style.animationDelay = `${time}s`;
        time += LINE_DRAW_TIME;
      }

      let count = 0;
      [...block.childNodes].forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) return; // <br />, 짧은 선 등은 그대로 둠
        const text = node.textContent.replace(/\s+/g, " ").trim();
        if (!text) {
          node.remove();
          return;
        }
        // 글자들을 하나로 묶어야 flex 인 영문 줄에서 글자 사이가 벌어지지 않음
        const wrap = document.createElement("span");
        wrap.setAttribute("aria-hidden", "true");
        [...text].forEach((ch) => {
          const span = document.createElement("span");
          span.className = "write-char";
          span.textContent = ch;
          span.style.setProperty("--d", `${(time + count * step).toFixed(3)}s`);
          span.style.setProperty("--dur", `${duration}s`);
          wrap.appendChild(span);
          count += 1;
        });
        node.replaceWith(wrap);
      });
      time += count * step + duration + GAP_BETWEEN_BLOCKS;

      const srText = document.createElement("span");
      srText.className = "sr-only";
      srText.textContent = readable;
      block.appendChild(srText);
    });
    document.documentElement.classList.add("writing-ready");

    const fontReady = document.fonts ? document.fonts.load('1em "Nanum Brush Script"') : Promise.resolve();
    const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
    Promise.race([fontReady, timeout]).then(() => {
      // 폰트를 받은 다음 프레임에 시작해야 첫 글자가 바뀐 폰트로 그려짐
      requestAnimationFrame(() => blocks.forEach((block) => block.classList.add("is-writing")));
    });
  }

  // ===== 스크롤하면 섹션이 아래에서 떠오르는 효과 =====
  // data-reveal 이 붙은 요소는 화면에 들어올 때 is-visible 클래스를 받아 나타납니다.
  // JS 가 실행된 경우에만(html.reveal-ready) 숨기므로, JS 가 실패해도 내용은 그대로 보입니다.
  function initScrollReveal() {
    // 기능 카드 4개는 한 번에 말고 순서대로 하나씩 올라오게
    document.querySelectorAll("#featureGrid > *").forEach((card, i) => {
      card.setAttribute("data-reveal", "");
      card.style.setProperty("--reveal-delay", `${i * 150}ms`);
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
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
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
