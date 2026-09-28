/**
 * BROS - 홈(index.html) 전용 엔트리 포인트
 * 사이드바/테마/로그인 등 모든 페이지 공통 동작은 js/shell.js 가 담당합니다.
 * 여기서는 홈 화면에만 있는 것들(메인 비주얼, 스크롤 등장 효과, 오늘의 AI 리포트 탭, 4대 기능 메뉴, 3단계 안내 바)만 다룹니다.
 */
(function () {
  const { FEATURE_ITEMS, HOW_IT_WORKS_STEPS } = window.BROS.data;
  const { renderReportOverview, renderFeatureCard, renderHowBarSteps } = window.BROS.render;

  const DEFAULT_REPORT_TYPE = "pitching";

  // ===== 오늘의 AI 리포트 (GET /api/mypage/report-summary) =====
  // 리포트는 자세를 평가하지 않고 측정값만 보여주는 방향이라, 지금은 실제로 있는 값(분석 수, 최근 영상, 상태)만 보여주고
  // 관절 각도·움직임 수치 칸은 AI 측정 기능이 연결될 때까지 "준비 중" 으로 표시합니다.
  const REPORT_TYPE_META = {
    pitching: { icon: "pitching", label: "투구폼 분석", noun: "투구", page: "./pitching.html" },
    batting: { icon: "batting", label: "타격폼 분석", noun: "타격", page: "./batting.html" },
  };

  const STATUS_TEXT = {
    uploading: { label: "업로드 중", sentence: "업로드되고 있어요" },
    queued: { label: "분석 대기", sentence: "분석을 기다리고 있어요" },
    processing: { label: "분석 중", sentence: "분석 중이에요" },
    done: { label: "분석 완료", sentence: "분석이 끝났어요" },
    failed: { label: "분석 실패", sentence: "분석에 실패했어요" },
  };

  const MEASUREMENT_PENDING = { value: "준비 중", description: "관절 각도·움직임 수치 측정을 준비하고 있어요" };

  /** 서버 응답을 받기 전/로그인 전/연결 실패 시에 보여줄 안내용 리포트 */
  function buildNoticeReport(type, notice) {
    const meta = REPORT_TYPE_META[type];
    return {
      analysisType: { icon: meta.icon, label: meta.label },
      overallStatus: { label: notice.status, description: notice.statusDesc },
      recentAnalysisDate: "-",
      improvementPoints: MEASUREMENT_PENDING,
      aiSummaryComment: notice.comment,
      cta: notice.cta,
    };
  }

  /** @param {string} type @param {object} summary 서버의 ReportSummaryView */
  function buildReport(type, summary) {
    const meta = REPORT_TYPE_META[type];
    if (!summary || !summary.totalCount) {
      return buildNoticeReport(type, {
        status: "기록 없음",
        statusDesc: `아직 분석한 ${meta.noun} 영상이 없어요`,
        comment: `아직 ${meta.noun} 영상을 분석하지 않았어요. 첫 영상을 올리면 이곳에 분석 결과가 쌓여요.`,
        cta: { label: `${meta.label} 시작하기`, href: meta.page },
      });
    }

    const status = STATUS_TEXT[summary.latestStatus] || { label: summary.latestStatus, sentence: summary.latestStatus };
    const frames =
      summary.detectedFrames != null && summary.analyzedFrames != null
        ? `선수 검출 ${summary.detectedFrames} / ${summary.analyzedFrames} 프레임`
        : `지금까지 ${summary.totalCount}개 분석`;
    return {
      analysisType: { icon: meta.icon, label: meta.label },
      overallStatus: { label: status.label, description: frames },
      recentAnalysisDate: summary.latestDate || "-",
      improvementPoints: MEASUREMENT_PENDING,
      aiSummaryComment:
        `최근 올린 "${summary.latestFileName}" 영상은 ${status.sentence}. ` +
        `지금까지 ${meta.noun} 영상 ${summary.totalCount}개를 분석했어요. 관절 각도·움직임 수치와 이전 영상 비교는 분석 페이지 리포트에서 볼 수 있어요.`,
      cta: { label: "내 분석 기록 보기", href: "./mypage.html" },
    };
  }

  let reportsByType = {};
  let activeReportType = DEFAULT_REPORT_TYPE;

  // 오늘의 AI 리포트: 투수/타자 탭에 맞는 데이터로 #reportOverviewSlot 을 다시 그림
  function renderReportSection(type) {
    activeReportType = type;
    const slot = document.getElementById("reportOverviewSlot");
    const report = reportsByType[type];
    if (!slot || !report) return;
    slot.innerHTML = "";
    slot.appendChild(renderReportOverview(report));
  }

  function setAllReports(makeReport) {
    reportsByType = {};
    Object.keys(REPORT_TYPE_META).forEach((type) => {
      reportsByType[type] = makeReport(type);
    });
    renderReportSection(activeReportType);
  }

  async function loadReports() {
    const guest = {
      status: "로그인 필요",
      statusDesc: "로그인하면 내 분석 결과가 보여요",
      comment: "로그인하면 최근에 올린 영상의 분석 결과를 이곳에서 바로 확인할 수 있어요.",
      cta: { label: "로그인하고 시작하기", href: "./login.html" },
    };
    if (!window.BROS.shell.isLoggedIn()) {
      setAllReports((type) => buildNoticeReport(type, guest));
      return;
    }

    setAllReports((type) =>
      buildNoticeReport(type, { ...guest, status: "불러오는 중", statusDesc: "내 분석 기록을 확인하고 있어요", comment: "잠시만 기다려주세요.", cta: { label: "내 분석 기록 보기", href: "./mypage.html" } })
    );
    try {
      const summary = await window.BROS.api.request("/api/mypage/report-summary", {
        fallbackError: "분석 기록을 불러오지 못했어요.",
      });
      setAllReports((type) => buildReport(type, summary[type]));
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        // 세션이 만료된 경우: 로그인 전 화면으로 (shell.js 가 로그인 표시도 풀어줌)
        setAllReports((type) => buildNoticeReport(type, guest));
        return;
      }
      setAllReports((type) =>
        buildNoticeReport(type, { ...guest, status: "연결 실패", statusDesc: "서버에 연결할 수 없어요", comment: e.message, cta: { label: "내 분석 기록 보기", href: "./mypage.html" } })
      );
    }
  }

  function mount() {
    loadReports();

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
  }

  // 메인 비주얼이 상단바 뒤까지 올라가도록 CSS(.home-hero)에 상단바 높이를 알려줌
  function syncTopbarHeight() {
    const topbar = document.getElementById("topbar");
    if (!topbar) return;
    // 상단바 없이 버튼만 떠 있으면(topbar--floating) 가려지는 영역이 없으므로 0
    const update = () => {
      const h = topbar.classList.contains("topbar--floating") ? 0 : topbar.offsetHeight;
      document.documentElement.style.setProperty("--topbar-h", `${h}px`);
    };
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

      // 영문 줄 양옆의 짧은 선: 앞 선은 글자보다 먼저, 뒤 선(--end)은 글자를 다 쓴 뒤
      const leadLine = block.querySelector(".home-hero__eyebrow-line:not(.home-hero__eyebrow-line--end)");
      const endLine = block.querySelector(".home-hero__eyebrow-line--end");
      if (leadLine) {
        leadLine.style.animationDelay = `${time}s`;
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
      time += count * step + duration;
      if (endLine) {
        endLine.style.animationDelay = `${time - duration}s`;
        time += LINE_DRAW_TIME - duration;
      }
      time += GAP_BETWEEN_BLOCKS;

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

  // ===== 스크롤 위치에 계속 연동되는 장면 등장/퇴장 효과 =====
  // 한 번 재생하고 끝나는 애니메이션이 아니라, 스크롤할 때마다(내릴 때도 올릴 때도) 위치에 맞춰 다시 계산:
  //   - 화면 아래에서 들어올 때: 아래에서 떠오르며 나타남 (팀 사진은 작은 카드 → 화면 가득)
  //   - 위로 빠져나갈 때: 살짝 위로 올라가며 사라짐
  // 결과는 CSS 변수(--p 보이는 정도, --ty 세로 이동 px, --s 크기)로 넘기고 모양은 CSS 가 담당.
  // 카드에 마우스를 올릴 때의 떠오르는 효과(transform)와 겹치지 않도록 CSS 에서는 translate/scale 속성을 씀.
  // JS 가 실행된 경우에만(html.reveal-ready) 숨기므로, JS 가 실패해도 내용은 그대로 보입니다.
  function initScrollReveal() {
    // 기능 카드 4개는 스크롤에 맞춰 하나씩 차례로 (카드마다 조금씩 늦게 시작)
    document.querySelectorAll("#featureGrid > *").forEach((card, i) => {
      card.setAttribute("data-reveal", "");
      card.dataset.revealOffset = String(i * 50);
    });

    const targets = [...document.querySelectorAll("[data-reveal]")];
    if (!targets.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    document.documentElement.classList.add("reveal-ready");

    const topbar = document.getElementById("topbar");
    const ENTER_DISTANCE = 0.3; // 화면 높이의 30% 만큼 올라오는 동안 다 나타남
    const EXIT_DISTANCE = 0.22; // 위로 빠져나갈 때 화면 높이의 22% 동안 사라짐
    const RISE_PX = 160; // 들어올 때 아래에서 "확" 올라오는 거리
    const LEAVE_PX = 50; // 나갈 때 위로 올라가는 거리
    const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
    // 들어오는 초반에 빠르게 올라오고 끝에서 부드럽게 멈추도록 (easeOutCubic)
    const easeOut = (t) => 1 - Math.pow(1 - t, 3);

    function update() {
      const vh = window.innerHeight;
      const top = topbar && !topbar.classList.contains("topbar--floating") ? topbar.offsetHeight : 0;
      // 페이지 맨 끝이면 더 내려갈 수 없으므로, 화면 안에 들어온 요소는 끝까지 다 나타난 것으로 처리
      const atBottom = window.scrollY + vh >= document.documentElement.scrollHeight - 4;
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const offset = Number(el.dataset.revealOffset || 0);
        let enter = easeOut(clamp01((vh - rect.top - offset) / (vh * ENTER_DISTANCE)));
        if (atBottom && rect.top < vh) enter = 1;
        const exit = clamp01((rect.bottom - top) / (vh * EXIT_DISTANCE));
        const shown = Math.min(enter, exit);
        const shift = enter < 1 ? (1 - enter) * RISE_PX : -(1 - exit) * LEAVE_PX;
        el.style.setProperty("--p", shown.toFixed(3));
        el.style.setProperty("--ty", shift.toFixed(1));
        el.style.setProperty("--enter", enter.toFixed(3));
      });
      ticking = false;
    }

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
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
