/**
 * BROS - 렌더링 함수 모음
 * data.js 의 타입 데이터(types.js 참고)를 받아 DOM 을 생성/갱신합니다.
 */

const ICONS = {
  pitching:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M6 5.5c2.2 2 2.2 11 0 13"/><path d="M18 5.5c-2.2 2-2.2 11 0 13"/></svg>',
  batting:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="10.6" y="2" width="3" height="14" rx="1.5" transform="rotate(35 12 9)"/><circle cx="6" cy="18" r="2.4"/></svg>',
  highlight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none"/></svg>',
  mypage:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="9.8" r="2.6"/><path d="M6.5 18c1.3-2.6 3.4-3.8 5.5-3.8s4.2 1.2 5.5 3.8"/></svg>',
  bell:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  menu:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  chevron:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  chevronDown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/></svg>',
  warn:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16" r="0.6" fill="currentColor"/></svg>',
  release:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/></svg>',
  timing:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2"/><path d="M9 2h6"/></svg>',
  play:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  expand:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3H3v6M15 3h6v6M21 15v6h-6M3 15v6h6"/></svg>',
  bulb:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3z"/></svg>',
  file:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M9 12h6M9 16h6M9 8h3"/></svg>',
  upload:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>',
  analyze:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3a3 3 0 0 0-3 3v1a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2v1a3 3 0 0 0 3 3"/><path d="M15 3a3 3 0 0 1 3 3v1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2v1a3 3 0 0 1-3 3"/><path d="M9 3h6v18H9z"/></svg>',
  result:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l3 3v15H6z"/><path d="M9.5 13l2 2 4-4.5"/></svg>',
  video:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/></svg>',
  moon:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  sun:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>',
  smile:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="0.9" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="0.9" fill="currentColor" stroke="none"/><path d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8"/></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17"/><path d="M8 3v4M16 3v4"/></svg>',
  chart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V13"/><path d="M10 20V8"/><path d="M16 20v-5"/><path d="M20 20V4"/></svg>',
  quote:
    '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M7 8c-2.2 0-4 1.8-4 4 0 2 1.5 3.6 3.4 3.9-.2 1-1 1.8-2 2.1v1.6c2.6-.3 4.6-2.5 4.6-5.3V12c0-2.2-1.8-4-4-4zM17 8c-2.2 0-4 1.8-4 4 0 2 1.5 3.6 3.4 3.9-.2 1-1 1.8-2 2.1v1.6c2.6-.3 4.6-2.5 4.6-5.3V12c0-2.2-1.8-4-4-4z"/></svg>',
  arrowRight:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16M13 5l7 7-7 7"/></svg>',
};

/**
 * "오늘의 AI 리포트": 투수/타자 탭에서 고른 분석 종류 1건에 대한
 * 4칸 정보 박스 + AI 코멘트 박스 + 상세 리포트 보기 버튼
 * @param {TypeReport} report
 */
function renderReportOverview(report) {
  const wrap = document.createElement("div");
  wrap.className = "report-overview-wrap";
  wrap.innerHTML = `
    <div class="report-overview">
      <div class="info-box info-box--type">
        <span class="info-box__icon">${ICONS[report.analysisType.icon] || ICONS.pitching}</span>
        <span class="info-box__label">분석 유형</span>
        <span class="info-box__value">${report.analysisType.label}</span>
      </div>
      <div class="info-box info-box--status">
        <span class="info-box__icon info-box__icon--mood">${ICONS.smile}</span>
        <span class="info-box__label">AI 종합 상태</span>
        <span class="info-box__value info-box__value--gold">${report.overallStatus.label}</span>
        <span class="info-box__sub">${report.overallStatus.description}</span>
      </div>
      <div class="info-box info-box--date">
        <span class="info-box__icon">${ICONS.calendar}</span>
        <span class="info-box__label">최근 분석</span>
        <span class="info-box__value">${report.recentAnalysisDate}</span>
      </div>
      <div class="info-box info-box--points">
        <span class="info-box__icon">${ICONS.chart}</span>
        <span class="info-box__label">주요 개선 포인트</span>
        <span class="info-box__value">${report.improvementPoints.count}개</span>
        <span class="info-box__sub">${report.improvementPoints.items.join(", ")}</span>
      </div>
      <div class="comment-box">
        <div class="comment-box__body">
          <span class="comment-box__quote">${ICONS.quote}</span>
          <div>
            <p class="comment-box__title">AI 코멘트</p>
            <p class="comment-box__text">${report.aiSummaryComment}</p>
          </div>
        </div>
        <button type="button" id="viewDetailedReportBtn" class="report-cta">상세 리포트 보기 ${ICONS.arrowRight}</button>
      </div>
    </div>
  `;
  return wrap;
}

/** @param {FeatureMenuItem} item */
function renderFeatureCard(item) {
  const a = document.createElement("a");
  a.className = `feature-card feature-card--${item.accent}`;
  a.href = item.href;
  a.innerHTML = `
    <span class="feature-card__icon-badge"><span class="feature-card__icon">${ICONS[item.icon] || ICONS.pitching}</span></span>
    <span class="feature-card__title">${item.title}</span>
    <span class="feature-card__desc">${item.description}</span>
    <span class="feature-card__chevron">${ICONS.chevron}</span>
  `;
  return a;
}

/**
 * 하단의 압축된 가로형 "3단계 안내 바"에 들어갈 스텝들 (아이콘 배지 + 제목 + 설명, 화살표로 연결)
 * @param {HowItWorksStep[]} steps
 */
function renderHowBarSteps(steps) {
  const wrap = document.createElement("div");
  wrap.className = "how-bar__steps";
  steps.forEach((step, i) => {
    const item = document.createElement("div");
    item.className = "how-bar__step";
    item.innerHTML = `
      <span class="how-bar__step-icon">${ICONS[step.icon] || ICONS.upload}</span>
      <div class="how-bar__step-text">
        <p class="how-bar__step-title">${step.title}</p>
        <p class="how-bar__step-desc">${step.description}</p>
      </div>
    `;
    wrap.appendChild(item);
    if (i < steps.length - 1) {
      const arrow = document.createElement("span");
      arrow.className = "how-bar__arrow";
      arrow.innerHTML = ICONS.chevron;
      wrap.appendChild(arrow);
    }
  });
  return wrap;
}

/**
 * @param {NavItem} item
 * @param {string} [currentKey] 지금 보고 있는 페이지의 key. 일치하면 active 표시.
 */
function renderNavItem(item, currentKey) {
  const a = document.createElement("a");
  a.className = `nav-item${item.key === currentKey ? " nav-item--active" : ""}`;
  a.href = item.href;
  a.dataset.key = item.key;
  a.innerHTML = `<span class="nav-item__icon">${ICONS[item.icon] || ICONS.pitching}</span><span>${item.label}</span>`;
  return a;
}

window.BROS = window.BROS || {};
window.BROS.render = {
  ICONS,
  renderReportOverview,
  renderFeatureCard,
  renderHowBarSteps,
  renderNavItem,
};
