/**
 * BROS - 목(mock) 데이터
 * 실제 서비스에서는 이 파일 대신 API 응답을 types.js 의 타입 형태로 매핑해서 사용합니다.
 */

/** @type {NavItem[]} */
const NAV_ITEMS = [
  { key: "pitching", icon: "pitching", label: "AI 투구폼 분석", href: "./pitching.html" },
  { key: "batting", icon: "batting", label: "AI 타격폼 분석", href: "./batting.html" },
  { key: "highlight", icon: "highlight", label: "경기 하이라이트", href: "./highlight.html" },
  { key: "mypage", icon: "mypage", label: "마이페이지", href: "./mypage.html" },
];

/** @type {DailyReport} */
const DAILY_REPORT = {
  id: "report-2024-06-10",
  // 오늘의 AI 리포트: 투수/타자 탭으로 전환해서 보여줄 분석 종류별 데이터
  reportsByType: {
    pitching: {
      analysisType: { icon: "pitching", label: "투구폼 분석" },
      overallStatus: { icon: "smile", label: "좋음", description: "전체적으로 안정적인 폼입니다." },
      recentAnalysisDate: "2024.06.08",
      improvementPoints: { count: 2, items: ["릴리스 포인트", "팔꿈치 각도"] },
      aiSummaryComment:
        "릴리스 포인트가 이전보다 일관적입니다. 팔꿈치 각도를 조금 더 낮추면 구속 향상에 도움이 될 거예요.",
    },
    batting: {
      analysisType: { icon: "batting", label: "타격폼 분석" },
      overallStatus: { icon: "smile", label: "좋음", description: "전체적으로 안정적인 폼입니다." },
      recentAnalysisDate: "2024.06.10",
      improvementPoints: { count: 2, items: ["스윙 타이밍", "하체 밸런스"] },
      aiSummaryComment:
        "스윙 타이밍이 이전보다 안정적입니다. 하체 밸런스를 조금 더 유지하면 더 좋은 결과를 기대할 수 있어요.",
    },
  },
};

/** @type {FeatureMenuItem[]} */
const FEATURE_ITEMS = [
  {
    id: "f1",
    icon: "pitching",
    title: "AI 투구폼 분석",
    description: "투구 영상을 업로드하면 폼을 분석해드립니다.",
    href: "./pitching.html",
    accent: "navy",
  },
  {
    id: "f2",
    icon: "batting",
    title: "AI 타격폼 분석",
    description: "타격 영상을 업로드하면 스윙을 분석해드립니다.",
    href: "./batting.html",
    accent: "navy",
  },
  {
    id: "f3",
    icon: "highlight",
    title: "경기 하이라이트",
    description: "경기 영상을 분석해 주요 장면을 찾아드립니다.",
    href: "./highlight.html",
    accent: "navy",
  },
  {
    id: "f4",
    icon: "mypage",
    title: "마이페이지",
    description: "내 업로드 영상과 분석 기록을 관리합니다.",
    href: "./mypage.html",
    accent: "navy",
  },
];

/** @type {HowItWorksStep[]} */
const HOW_IT_WORKS_STEPS = [
  { step: 1, icon: "upload", title: "영상 업로드", description: "야구 영상을 업로드합니다." },
  { step: 2, icon: "analyze", title: "AI 분석", description: "최신 AI가 투구, 타격, 경기 장면을 분석합니다." },
  { step: 3, icon: "result", title: "결과 확인", description: "분석 리포트와 하이라이트를 확인합니다." },
];

window.BROS = window.BROS || {};
window.BROS.data = {
  NAV_ITEMS,
  DAILY_REPORT,
  FEATURE_ITEMS,
  HOW_IT_WORKS_STEPS,
};
